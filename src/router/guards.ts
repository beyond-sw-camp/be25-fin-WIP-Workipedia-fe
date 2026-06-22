import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/constants/roles'

const HOME = '/knowit'

export function setupGuards(router: Router): void {
  router.beforeEach((to) => {
    const auth = useAuthStore()

    // 로그인 상태에서 public 페이지 접근 → 홈으로
    if ((to.name === 'login' || to.name === 'register') && auth.isLoggedIn) {
      return HOME
    }

    // 미인증 → 로그인 페이지로 (redirect 쿼리 유지)
    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    // role 불일치 또는 role 미확인 → 홈으로
    // auth.role이 null이면 조건 단락을 막아 관리자 전용 라우트 우회를 방지한다.
    if (to.meta.roles?.length && !to.meta.roles.includes(auth.role as Role)) {
      return HOME
    }

    // / 접근 → 홈으로
    if (to.name === 'home' && auth.isLoggedIn) {
      return HOME
    }
  })
}
