import { createRouter, createWebHistory } from 'vue-router'
import { setupGuards } from './guards'
import { ROLES } from '@/constants/roles'
import type { Role } from '@/constants/roles'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: Role[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ── Public ──────────────────────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/auth/PasswordResetView.vue'),
    },

    // ── Authenticated (AppLayout) ────────────────────────────────────────
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // / → guards.ts에서 역할별 홈으로 분기
        {
          path: '',
          name: 'home',
          component: () => import('@/views/common/knowit/KnowItView.vue'),
        },

        // KnowIT 챗봇
        {
          path: 'knowit',
          name: 'knowit',
          component: () => import('@/views/common/knowit/KnowItView.vue'),
        },

        // 실시간 채팅 (API 미확정)
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/common/chat/ChatView.vue'),
        },

        // 워키
        {
          path: 'worki',
          name: 'worki',
          component: () => import('@/views/common/worki/WikiBoardView.vue'),
        },
        {
          path: 'worki/new',
          name: 'worki-new',
          component: () => import('@/views/common/worki/WikiCreateView.vue'),
        },
        {
          path: 'worki/:id',
          name: 'worki-detail',
          // BE 알림 targetUrl이 `/worki/questions/{id}` 형식이라 alias로 동일 화면에 매칭
          alias: '/worki/questions/:id',
          component: () => import('@/views/common/worki/WikiDetailView.vue'),
        },

        // 티켓
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/common/ticket/TicketListView.vue'),
        },
        {
          path: 'tickets/new',
          name: 'ticket-new',
          component: () => import('@/views/common/ticket/TicketCreateView.vue'),
        },
        {
          path: 'tickets/:id',
          name: 'ticket-detail',
          component: () => import('@/views/common/ticket/TicketDetailView.vue'),
        },

        // 매뉴얼
        {
          path: 'manuals',
          name: 'manuals',
          component: () => import('@/views/common/manual/ManualListView.vue'),
        },
        {
          path: 'manuals/:id',
          name: 'manual-detail',
          component: () => import('@/views/common/manual/ManualDetailView.vue'),
        },

        // 지식화 게시판 — 부서 카드 목록
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/common/knowledge/KnowledgeListView.vue'),
        },
        // 부서별 지식 목록 ('dept' 리터럴로 /:id 와 충돌 없음)
        {
          path: 'knowledge/dept/:deptId',
          name: 'knowledge-dept',
          component: () => import('@/views/common/knowledge/KnowledgeDeptView.vue'),
        },
        // 지식 상세 (숫자 id)
        {
          path: 'knowledge/:id(\\d+)',
          name: 'knowledge-detail',
          component: () => import('@/views/common/knowledge/KnowledgeDetailView.vue'),
        },

        // 검색
        {
          path: 'search',
          name: 'search',
          component: () => import('@/views/common/search/SearchView.vue'),
        },

        // FAQ
        {
          path: 'faq',
          name: 'faq',
          component: () => import('@/views/common/faq/FAQView.vue'),
        },

        // 리더보드
        {
          path: 'leaderboard',
          name: 'leaderboard',
          component: () => import('@/views/common/leaderboard/LeaderboardView.vue'),
        },

        // 마이페이지
        {
          path: 'my',
          name: 'my',
          component: () => import('@/views/common/mypage/MyPageView.vue'),
        },
        {
          path: 'my/points',
          name: 'my-points',
          component: () => import('@/views/common/point/PointView.vue'),
        },
        {
          path: 'my/tickets',
          name: 'my-tickets',
          component: () => import('@/views/common/mypage/MyIssuedTicketsView.vue'),
        },
        {
          path: 'my/tickets/:id',
          name: 'my-ticket-detail',
          // BE 알림 targetUrl이 `/me/tickets/{id}` 형식이라 alias로 동일 화면에 매칭
          alias: '/me/tickets/:id',
          component: () => import('@/views/common/mypage/MyIssuedTicketDetailView.vue'),
        },

        // 알림
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/common/notification/NotificationView.vue'),
        },

        // ── USER ────────────────────────────────────────────────────────
        {
          path: 'dashboard/team',
          name: 'dashboard-team',
          component: () => import('@/views/dashboard/TeamDashboardView.vue'),
          meta: { requiresAuth: true, roles: [ROLES.USER] },
        },

        // ── TEAM_ADMIN ──────────────────────────────────────────────────
        {
          path: 'dashboard/department',
          name: 'dashboard-department',
          component: () => import('@/views/dashboard/DepartmentAdminDashboardView.vue'),
          meta: { requiresAuth: true, roles: [ROLES.TEAM_ADMIN, ROLES.SYSTEM_ADMIN] },
        },

        // ── SYSTEM_ADMIN ────────────────────────────────────────────────
        {
          path: 'dashboard/admin',
          name: 'dashboard-admin',
          component: () => import('@/views/dashboard/AdminDashboardView.vue'),
          meta: { requiresAuth: true, roles: [ROLES.SYSTEM_ADMIN] },
        },
        {
          path: 'admin/ai',
          name: 'admin-ai',
          component: () => import('@/views/admin/AiAdminView.vue'),
          meta: { requiresAuth: true, roles: [ROLES.SYSTEM_ADMIN] },
        },
        {
          path: 'admin/settings',
          name: 'admin-settings',
          component: () => import('@/views/admin/AdminSettingsView.vue'),
          meta: { requiresAuth: true, roles: [ROLES.SYSTEM_ADMIN] },
        },
      ],
    },

    // ── catch-all ────────────────────────────────────────────────────────
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

setupGuards(router)

export default router
