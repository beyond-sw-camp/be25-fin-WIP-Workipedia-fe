/**
 * 위젯 전용 챗봇 API 클라이언트.
 *
 * SPA의 src/api/chatbotApi.ts 와 동일한 엔드포인트를 호출하지만,
 * 위젯은 외부 고객사 페이지에 격리되어 동작하므로 Pinia(authStore)·axios 인터셉터를
 * 쓸 수 없다. 의존성 없는 fetch 기반으로 구현하고,
 * 인증은 위젯 자체 로그인(/auth/login)으로 받은 accessToken 을 Authorization: Bearer 로 보낸다.
 */
import type { WidgetConfig } from './config'
import { accessToken, clearAuth } from './widgetAuth'

export type SenderType = 'USER' | 'ASSISTANT' | 'SYSTEM'

// /auth/login 성공 응답 — BE는 LoginData를 래퍼 없이 직접 반환한다.
export interface LoginResponse {
  accessToken: string
  userId: number
  departmentId: number
  departmentName: string
  role: string
  nickname: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface WidgetSessionResponse {
  sessionId: number
  title: string | null
  createdAt: string
}

export interface WidgetMessageResponse {
  messageId: number
  senderType: SenderType
  content: string
  answerable: boolean // RAG가 관련 지식을 못 찾으면 false
  nextAction: string | null
  referencesJson: string | null
  createdAt: string
}

export interface StreamHandlers {
  onToken: (content: string) => void // token 이벤트마다 호출 (타자 효과)
  onDone: (message: WidgetMessageResponse) => void // done 이벤트 1회 (최종 확정값)
  onError?: (err: unknown) => void
}

export interface WidgetClient {
  login: (employeeId: string, password: string) => Promise<LoginResponse>
  createSession: () => Promise<WidgetSessionResponse>
  streamMessage: (
    sessionId: number,
    question: string,
    handlers: StreamHandlers,
    signal?: AbortSignal,
  ) => Promise<void>
}

export function createWidgetClient(config: WidgetConfig): WidgetClient {
  const base = config.apiBaseUrl.replace(/\/+$/, '')

  // 로그인된 경우에만 Bearer 헤더를 붙인다.
  function authHeaders(): Record<string, string> {
    return accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
  }

  // 토큰 만료/무효(401) 시 위젯 로그인 상태를 비워 재로그인 화면으로 돌아가게 한다.
  function guard401(status: number) {
    if (status === 401) clearAuth()
  }

  async function login(employeeId: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
      credentials: 'include',
    })
    if (!res.ok) {
      // 에러 응답은 { code, status, message, data } 래퍼 → message 우선 사용
      let message = '사번 또는 비밀번호가 올바르지 않습니다.'
      try {
        const err = await res.json()
        if (err?.message) message = err.message
      } catch {
        /* 본문 없음 — 기본 문구 유지 */
      }
      throw new Error(message)
    }
    return (await res.json()) as LoginResponse
  }

  async function createSession(): Promise<WidgetSessionResponse> {
    const res = await fetch(`${base}/chatbot/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'include',
    })
    if (!res.ok) {
      guard401(res.status)
      throw new Error(`챗봇 세션 생성 실패: ${res.status}`)
    }
    return (await res.json()) as WidgetSessionResponse
  }

  async function streamMessage(
    sessionId: number,
    question: string,
    handlers: StreamHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`${base}/chatbot/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...authHeaders(),
      },
      body: JSON.stringify({ question }),
      credentials: 'include',
      signal,
    })
    if (!res.ok || !res.body) {
      guard401(res.status)
      throw new Error(`챗봇 스트림 요청 실패: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // SSE 프레임은 빈 줄(\n\n)로 구분된다. CRLF 로 올 수도 있어 LF 로 정규화한다.
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        dispatchFrame(frame, handlers)
      }
    }
  }

  return { login, createSession, streamMessage }
}

// SSE 프레임 1건을 파싱해 token/done 핸들러로 분기한다.
function dispatchFrame(frame: string, handlers: StreamHandlers) {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue // 주석/heartbeat 무시
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return
  const data = dataLines.join('\n')

  if (event === 'token') {
    try {
      const { content } = JSON.parse(data) as { content: string }
      if (content) handlers.onToken(content)
    } catch {
      /* 깨진 토큰 프레임은 무시 */
    }
  } else if (event === 'done') {
    try {
      handlers.onDone(JSON.parse(data) as WidgetMessageResponse)
    } catch (e) {
      handlers.onError?.(e)
    }
  }
}
