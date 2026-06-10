import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { ROLES } from '@/constants/roles'

export const ROLE_HOME: Record<string, string> = {
  [ROLES.USER]: '/knowit',
  [ROLES.TEAM_ADMIN]: '/dashboard/department',
  [ROLES.SYSTEM_ADMIN]: '/dashboard/admin',
}

export function setupGuards(router: Router): void {
  router.beforeEach((to) => {
    const auth = useAuthStore()

    // 로그인 상태에서 public 페이지 접근 → 역할별 홈으로
    if ((to.name === 'login' || to.name === 'register') && auth.isLoggedIn) {
      return auth.role ? ROLE_HOME[auth.role] : ROLE_HOME[ROLES.USER]
    }

    // 미인증 → 로그인 페이지로 (redirect 쿼리 유지)
    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    // role 불일치 → 역할별 홈으로
    if (to.meta.roles?.length && auth.role && !to.meta.roles.includes(auth.role)) {
      return auth.role ? ROLE_HOME[auth.role] : ROLE_HOME[ROLES.USER]
    }

    // / 접근 → 역할별 홈으로 분기
    if (to.name === 'home' && auth.isLoggedIn && auth.role) {
      return ROLE_HOME[auth.role]
    }
  })
}
