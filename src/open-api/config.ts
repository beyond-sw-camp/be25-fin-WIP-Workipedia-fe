/**
 * 고객사 <script> 태그의 data-* 속성을 읽어 위젯 설정을 만든다.
 *
 * 사용 예:
 *   <script src="https://workipedia.wiki/widget.js"
 *           data-theme="light"
 *           data-position="bottom-right"></script>
 *
 * 인증은 위젯 내부 로그인(/auth/login → Bearer)으로 처리하므로 별도 키 속성은 없다.
 */

export type WidgetTheme = 'light' | 'dark'
export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface WidgetConfig {
  /** data-theme — 'light' | 'dark' (기본 dark) */
  theme: WidgetTheme
  /** data-position — 런처/패널이 표시될 화면 모서리 (기본 bottom-right) */
  position: WidgetPosition
  /** 챗봇 API base URL */
  apiBaseUrl: string
}

// 배포된 Workipedia 백엔드. data-api-base 나 빌드 환경변수가 없으면 이 주소로 붙는다.
const PRODUCTION_API_BASE = 'https://workipedia.wiki/api/v1'

const VALID_THEMES: WidgetTheme[] = ['light', 'dark']
const VALID_POSITIONS: WidgetPosition[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left']

// 위젯 스크립트 요소를 모듈 평가 시점(= <script> 동기 실행 시점)에 즉시 캡처한다.
// DOMContentLoaded 콜백 등 이후 시점에는 document.currentScript 가 null 이 되므로,
// 반드시 엔트리(main.ts)가 import 되어 이 모듈이 동기 평가될 때 잡아둬야 한다.
const scriptEl: HTMLScriptElement | null = (() => {
  if (document.currentScript instanceof HTMLScriptElement) return document.currentScript
  // currentScript 가 비어 있을 때(번들러 환경 등)의 폴백: widget.js 를 참조하는 마지막 스크립트
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
  return scripts.reverse().find((s) => /widget\.js|workipedia-chat/.test(s.src)) ?? null
})()

function attr(name: string): string {
  return scriptEl?.getAttribute(name)?.trim() ?? ''
}

// API base URL 도출 순서:
//   1) data-api-base 명시값 (로컬 BE 테스트 등 오버라이드용)
//   2) 빌드 시점 VITE_API_BASE_URL — 단, localhost 면 무시(로컬 dev 기본값이므로)
//   3) 배포 BE 주소 상수
// 위젯은 어디에 임베드되든(고객사 도메인) 항상 자기 백엔드로 붙어야 하므로
// "스크립트 origin 도출"에 의존하지 않고 알려진 주소로 고정한다.
function deriveApiBaseUrl(): string {
  const explicit = attr('data-api-base')
  if (explicit) return explicit.replace(/\/+$/, '')

  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''
  if (envBase && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(envBase)) {
    return envBase
  }

  return PRODUCTION_API_BASE
}

export function readWidgetConfig(): WidgetConfig {
  const themeRaw = attr('data-theme') as WidgetTheme
  const positionRaw = attr('data-position') as WidgetPosition

  return {
    theme: VALID_THEMES.includes(themeRaw) ? themeRaw : 'dark',
    position: VALID_POSITIONS.includes(positionRaw) ? positionRaw : 'bottom-right',
    apiBaseUrl: deriveApiBaseUrl(),
  }
}
