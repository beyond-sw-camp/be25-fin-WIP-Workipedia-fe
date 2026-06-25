<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { ROLES } from '@/constants/roles'
import {
  MessageCircle, FileText, MessagesSquare, Trophy,
  Search, BookOpen, Library, BookMarked, HelpCircle,
  LayoutDashboard, Building2, ShieldCheck, Settings, Bot, AlertCircle,
  Bell, LogOut, Star,
} from '@lucide/vue'
import NotificationPanel from './NotificationPanel.vue'
import PointPanel from './PointPanel.vue'
import { logout as logoutApi } from '@/api/authApi'

const auth = useAuthStore()
const router = useRouter()
const currentRoute = useRoute()
const notiStore = useNotificationStore()

// Vue Router는 형제 라우트(flat children)에서 router-link-active를 자동 적용하지 않으므로
// 경로 접두사 일치 여부를 직접 체크해 상세 페이지에서도 하이라이트를 유지한다.
function isNavActive(prefix: string) {
  return currentRoute.path === prefix || currentRoute.path.startsWith(prefix + '/')
}

const showNotification = ref(false)
const showPoint = ref(false)

// 안읽음 알림 배지: 로그인 상태에서 SSE 로 실시간 갱신(끊기면 폴링 fallback).
onMounted(() => {
  if (auth.isLoggedIn) notiStore.start()
})
onUnmounted(() => notiStore.stop())

function toggleNotification() {
  showNotification.value = !showNotification.value
  if (showNotification.value) {
    showPoint.value = false
    notiStore.refreshUnreadCount()
  }
}

function togglePoint() {
  showPoint.value = !showPoint.value
  if (showPoint.value) showNotification.value = false
}

function goMyPage() {
  router.push('/my')
}

async function logout() {
  try {
    await logoutApi()
  } finally {
    notiStore.stop()
    notiStore.reset()
    auth.clearAuth()
    router.push('/login')
  }
}

const initials = computed(() =>
  (auth.nickname ?? '?').slice(0, 1).toUpperCase()
)
</script>

<template>
  <aside class="sidebar">
    <!-- 로고 + 알림 -->
    <div class="sidebar-top">
      <RouterLink to="/knowit" class="sidebar-logo">
        <img src="/workiIcon.png" alt="Workipedia" class="logo-svg" />
        <span class="logo-text">Workipedia</span>
      </RouterLink>
      <button class="bell-btn" @click="toggleNotification">
        <Bell :size="18" />
        <span v-if="notiStore.unreadCount > 0" class="bell-badge">
          {{ notiStore.unreadCount > 99 ? '99+' : notiStore.unreadCount }}
        </span>
      </button>
    </div>

    <!-- 메인 메뉴 -->
    <nav class="sidebar-nav">
      <!-- 커뮤니케이션 섹션 -->
      <div class="nav-section-label">커뮤니케이션</div>
      <RouterLink to="/knowit" class="nav-item">
        <MessageCircle :size="16" /> 노잇 (Know-it)
      </RouterLink>
      <RouterLink to="/worki" class="nav-item" :class="{ 'router-link-active': isNavActive('/worki') }">
        <FileText :size="16" /> 워키 게시판
      </RouterLink>
      <RouterLink to="/chat" class="nav-item">
        <MessagesSquare :size="16" /> 채팅
      </RouterLink>
      <RouterLink to="/leaderboard" class="nav-item">
        <Trophy :size="16" /> 리더보드
      </RouterLink>

      <!-- 문서 섹션 -->
      <div class="nav-section-label">문서</div>
      <RouterLink to="/search" class="nav-item nav-item-secondary">
        <Search :size="16" /> 통합 검색
      </RouterLink>
      <RouterLink to="/manuals" class="nav-item nav-item-secondary" :class="{ 'router-link-active': isNavActive('/manuals') }">
        <BookOpen :size="16" /> 매뉴얼
      </RouterLink>
      <RouterLink to="/knowledge" class="nav-item nav-item-secondary" :class="{ 'router-link-active': isNavActive('/knowledge') }">
        <Library :size="16" /> 지식화 게시판
      </RouterLink>
      <RouterLink to="/direct-data" class="nav-item nav-item-secondary" :class="{ 'router-link-active': isNavActive('/direct-data') }">
        <BookMarked :size="16" /> 수기 지식 게시판
      </RouterLink>
      <RouterLink to="/faq" class="nav-item nav-item-secondary">
        <HelpCircle :size="16" /> FAQ
      </RouterLink>

      <!-- 운영 섹션 -->
      <div class="nav-section-label">운영</div>
      <RouterLink v-if="auth.role === ROLES.USER" to="/dashboard/team" class="nav-item nav-item-secondary">
        <LayoutDashboard :size="16" /> 부서 대시보드
      </RouterLink>
      <RouterLink v-else-if="auth.role === ROLES.TEAM_ADMIN" to="/dashboard/department" class="nav-item nav-item-secondary">
        <Building2 :size="16" /> 부서 대시보드
      </RouterLink>
      <RouterLink v-else-if="auth.role === ROLES.SYSTEM_ADMIN" to="/dashboard/team" class="nav-item nav-item-secondary">
        <Building2 :size="16" /> 부서 대시보드
      </RouterLink>

      <!-- 관리 섹션 -->
      <template v-if="auth.role === ROLES.SYSTEM_ADMIN">
        <div class="nav-section-label">관리</div>
        <RouterLink to="/dashboard/admin" class="nav-item nav-item-secondary">
          <ShieldCheck :size="16" /> 시스템 대시보드
        </RouterLink>
        <RouterLink to="/admin/common-queue" class="nav-item nav-item-secondary">
          <AlertCircle :size="16" /> 공통 접수 티켓
        </RouterLink>
        <RouterLink to="/admin/ai" class="nav-item nav-item-secondary">
          <Bot :size="16" /> AI 관리 및 개발자 도구
        </RouterLink>
        <RouterLink to="/admin/settings" class="nav-item nav-item-secondary">
          <Settings :size="16" /> 설정
        </RouterLink>
      </template>
    </nav>

    <!-- 하단: 로그아웃 + 유저 카드 -->
    <div class="sidebar-footer">
      <button class="logout-btn" @click="logout">
        <LogOut :size="15" /> 로그아웃
      </button>
      <hr class="footer-divider" />
      <div class="user-card" @click="goMyPage">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <span class="user-name">{{ auth.nickname ?? '사용자' }}</span>
          <span class="user-team">{{ auth.team ?? '' }}</span>
        </div>
        <Star :size="16" class="user-star" @click.stop="togglePoint" />
      </div>
    </div>
  </aside>

  <NotificationPanel v-if="showNotification" @close="showNotification = false" />
  <PointPanel v-if="showPoint" @close="showPoint = false" />
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  position: relative;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0.75rem;
  flex-shrink: 0;
  overflow: hidden;
  background:
    linear-gradient(160deg, #0d1b36 0%, #1a2744 40%, #111d33 70%, #0f1a2e 100%);
}

/* 마블 베인 레이어 1 */
.sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 25%, rgba(99, 102, 241, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 65%, rgba(59, 130, 246, 0.10) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 90%, rgba(139, 92, 246, 0.07) 0%, transparent 45%);
  pointer-events: none;
}

/* 마블 베인 레이어 2 — 사선 결 */
.sidebar::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(125deg, transparent 25%, rgba(255,255,255,0.025) 30%, transparent 35%),
    linear-gradient(55deg,  transparent 45%, rgba(99, 102, 241, 0.05) 50%, transparent 55%),
    linear-gradient(170deg, transparent 60%, rgba(59, 130, 246, 0.04) 65%, transparent 70%);
  pointer-events: none;
}

/* 상단 로고 */
.sidebar-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 0 0.25rem;
  padding-left: 1.1rem
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  text-decoration: none;
}

.logo-svg {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 8px;
  filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.3));
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(90deg, #e2e8f0, #a5b4fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.bell-btn {
  position: relative;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  transition: color 0.15s, transform 0.15s;
}

.bell-btn:hover {
  color: #c7d2fe;
  transform: scale(1.2);
}

.bell-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 99px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

/* 네비게이션 */
.sidebar-nav {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1.1rem;
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.925rem;
  transition: background 0.18s, color 0.18s;
}

.nav-item:hover {
  background: rgba(99, 102, 241, 0.12);
  color: #c7d2fe;
}

.nav-item.router-link-active {
  background: rgba(255, 255, 255, 0.92);
  color: #1e293b;
  font-weight: 600;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.12);
}

.nav-item-secondary {
  color: #7a8fa8;
}

.nav-item-secondary.router-link-active {
  color: #1e293b;
}

.nav-section-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.68);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.85rem 1.1rem 0.3rem;
}

/* 하단 */
.sidebar-footer {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
}

.footer-divider {
  border: none;
  border-top: 1px solid rgba(99, 102, 241, 0.15);
  margin: 0.75rem 0;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.875rem;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  cursor: pointer;
  width: 100%;
  margin-bottom: 0;
  transition: background 0.15s, color 0.15s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 0.75rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.user-card:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.2);
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.35);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-team {
  font-size: 0.7rem;
  color: #64748b;
}

.user-star {
  color: #fbbf24;
  flex-shrink: 0;
  transition: color 0.15s, transform 0.15s;
}

.user-star:hover {
  color: #f59e0b;
  transform: scale(1.2);
}
</style>
