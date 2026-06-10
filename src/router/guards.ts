import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

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

    // role 불일치 → 홈으로
    if (to.meta.roles?.length && auth.role && !to.meta.roles.includes(auth.role)) {
      return HOME
    }

    // / 접근 → 홈으로
    if (to.name === 'home' && auth.isLoggedIn) {
      return HOME
    }
  })
}
