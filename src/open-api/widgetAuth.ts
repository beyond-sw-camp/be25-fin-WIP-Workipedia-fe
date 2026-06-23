/**
 * 위젯 전용 인증 상태.
 *
 * 위젯은 고객사 사이트(SPA와 다른 origin)에서 돌기 때문에 메인 앱의 Pinia/localStorage를
 * 공유할 수 없다. 그래서 위젯 자체 토큰 저장소를 둔다(키 이름도 분리).
 * 토큰은 /auth/login 으로 받은 accessToken 이며, 챗봇 호출 시 Authorization: Bearer 로 쓴다.
 *
 * ⚠️ refresh 토큰은 httpOnly 쿠키 기반이라 서드파티 origin에서는 막힐 수 있다.
 * 따라서 위젯은 access token 만료 시 재로그인을 전제로 한다(자동 갱신 없음).
 */
import { ref, computed } from 'vue'

const STORAGE_KEY = 'workipedia-widget-auth'

interface StoredAuth {
  accessToken: string
  nickname: string
}

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

const saved = load()
export const accessToken = ref<string | null>(saved?.accessToken ?? null)
export const nickname = ref<string | null>(saved?.nickname ?? null)
export const isLoggedIn = computed(() => !!accessToken.value)

export function setAuth(token: string, nick: string) {
  accessToken.value = token
  nickname.value = nick
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: token, nickname: nick }))
  } catch {
    /* localStorage 사용 불가 환경(프라이빗 모드 등)은 메모리 상태로만 동작 */
  }
}

export function clearAuth() {
  accessToken.value = null
  nickname.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}
