<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  MessageCircle, FileText, MessagesSquare, Trophy,
  Search, BookOpen, Library, BookMarked, HelpCircle,
  LayoutDashboard, Building2, ShieldCheck, Settings, Bot,
  User,
} from '@lucide/vue'

const route = useRoute()

const PAGE_META: Record<string, { label: string; icon: object; color: string }> = {
  knowit:                { label: '노잇 (Know-it)',        icon: MessageCircle,   color: '#2b7fff' },
  worki:                 { label: '워키 게시판',           icon: FileText,        color: '#8b5cf6' },
  'worki-new':           { label: '워키 작성',             icon: FileText,        color: '#8b5cf6' },
  'worki-detail':        { label: '워키 상세',             icon: FileText,        color: '#8b5cf6' },
  chat:                  { label: '채팅',                  icon: MessagesSquare,  color: '#06b6d4' },
  leaderboard:           { label: '리더보드',              icon: Trophy,          color: '#f59e0b' },
  search:                { label: '통합 검색',             icon: Search,          color: '#64748b' },
  manuals:               { label: '매뉴얼',                icon: BookOpen,        color: '#10b981' },
  'manual-detail':       { label: '매뉴얼',           icon: BookOpen,        color: '#10b981' },
  knowledge:             { label: '지식화 게시판',         icon: Library,         color: '#3b82f6' },
  'knowledge-dept':      { label: '지식화 게시판',         icon: Library,         color: '#3b82f6' },
  'knowledge-detail':    { label: '지식화 상세',           icon: Library,         color: '#3b82f6' },
  'direct-data':         { label: '수기 지식 게시판',      icon: BookMarked,      color: '#10b981' },
  'direct-data-detail':  { label: '수기 지식 게시판',      icon: BookMarked,      color: '#10b981' },
  faq:                   { label: 'FAQ',                   icon: HelpCircle,      color: '#f5c000' },
  tickets:               { label: '내 티켓',              icon: FileText,        color: '#ef4444' },
  'ticket-new':          { label: '티켓 생성',             icon: FileText,        color: '#ef4444' },
  'ticket-detail':       { label: '티켓 상세',             icon: FileText,        color: '#ef4444' },
  my:                    { label: '마이페이지',            icon: User,            color: '#64748b' },
  'my-tickets':          { label: '내 발행 티켓',          icon: FileText,        color: '#ef4444' },
  'my-ticket-detail':    { label: '내 발행 티켓',          icon: FileText,        color: '#ef4444' },
  'my-points':           { label: '포인트',                icon: Trophy,          color: '#f59e0b' },
  'dashboard-team':      { label: '부서 대시보드',         icon: LayoutDashboard, color: '#3b82f6' },
  'dashboard-department':{ label: '부서 대시보드',         icon: Building2,       color: '#8b5cf6' },
  'dashboard-admin':     { label: '시스템 대시보드',       icon: ShieldCheck,     color: '#ef4444' },
  'admin-settings':      { label: '설정',           icon: Settings,        color: '#64748b' },
  'admin-ai':            { label: 'AI 관리 및 개발자 도구', icon: Bot,             color: '#6366f1' },
}

const current = computed(() => PAGE_META[route.name as string] ?? { label: '', icon: null, color: '#64748b' })
</script>

<template>
  <header class="app-header">
    <div class="header-title">
      <component
        v-if="current.icon"
        :is="current.icon"
        :size="20"
        :style="{ color: current.color }"
      />
      <span>{{ current.label }}</span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 3.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  background: #fff;
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
}
</style>
