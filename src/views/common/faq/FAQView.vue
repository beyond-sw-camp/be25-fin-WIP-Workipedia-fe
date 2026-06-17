<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { HelpCircle, MessageCircle, BookOpen, Flame, Clock, ChevronRight } from '@lucide/vue'
import { getPopularWorki, getPopularManuals, getRecentManuals } from '@/api/faqApi'
import type { PopularWorkiResponse, FaqManualSummaryResponse } from '@/types/faq'

const router = useRouter()

const popularWorki = ref<PopularWorkiResponse[]>([])
const popularManuals = ref<FaqManualSummaryResponse[]>([])
const recentManuals = ref<FaqManualSummaryResponse[]>([])
const loading = ref(false)
const error = ref('')

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 세 섹션을 순차 요청하면 최대 3× RTT가 걸리므로 Promise.all로 병렬 요청한다.
// 하나라도 실패하면 전체 에러 배너를 표시한다.
onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [worki, popMan, recMan] = await Promise.all([
      getPopularWorki(),
      getPopularManuals(),
      getRecentManuals(),
    ])
    popularWorki.value = worki.data
    popularManuals.value = popMan.data
    recentManuals.value = recMan.data
  } catch {
    error.value = '자주 찾는 항목을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <HelpCircle :size="28" color="#f5c000" />
        자주 찾는 항목
      </h1>
      <p class="page-sub">많이 보는 워키와 매뉴얼을 한눈에 확인하세요</p>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <div v-else class="faq-grid">
      <!-- 인기 워키 -->
      <div class="card faq-section">
        <h3 class="section-title"><Flame :size="16" color="#ff6900" /> 인기 워키</h3>
        <div v-if="popularWorki.length === 0" class="section-empty">데이터가 없습니다</div>
        <div v-else class="row-list">
          <div
            v-for="w in popularWorki"
            :key="w.questionId"
            class="row"
            @click="router.push(`/worki/${w.questionId}`)"
          >
            <MessageCircle :size="15" color="#7c3aed" class="row-icon" />
            <div class="row-body">
              <div class="row-title">{{ w.title }}</div>
              <div class="row-meta">좋아요 {{ w.likeCount }} · 조회 {{ w.viewCount }} · {{ formatDate(w.createdAt) }}</div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>

      <!-- 인기 매뉴얼 -->
      <div class="card faq-section">
        <h3 class="section-title"><BookOpen :size="16" color="#ff6900" /> 인기 매뉴얼</h3>
        <div v-if="popularManuals.length === 0" class="section-empty">데이터가 없습니다</div>
        <div v-else class="row-list">
          <div
            v-for="m in popularManuals"
            :key="m.manualId"
            class="row"
            @click="router.push(`/manuals/${m.manualId}`)"
          >
            <BookOpen :size="15" color="#ff6900" class="row-icon" />
            <div class="row-body">
              <div class="row-title">{{ m.title }}</div>
              <div class="row-meta">인용 {{ m.citationCount }}회 · {{ formatDate(m.createdAt) }}</div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>

      <!-- 최신 매뉴얼 -->
      <div class="card faq-section">
        <h3 class="section-title"><Clock :size="16" color="#2b7fff" /> 최신 매뉴얼</h3>
        <div v-if="recentManuals.length === 0" class="section-empty">데이터가 없습니다</div>
        <div v-else class="row-list">
          <div
            v-for="m in recentManuals"
            :key="m.manualId"
            class="row"
            @click="router.push(`/manuals/${m.manualId}`)"
          >
            <BookOpen :size="15" color="#2b7fff" class="row-icon" />
            <div class="row-body">
              <div class="row-title">{{ m.title }}</div>
              <div class="row-meta">{{ formatDate(m.createdAt) }}</div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-grid { display: flex; flex-direction: column; gap: 20px; }
.faq-section { padding: 24px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 14px; }
.section-empty { font-size: 13.5px; color: #aeb2bb; padding: 12px 6px; }
.row-list { display: flex; flex-direction: column; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 6px;
  border-top: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}
.row:first-child { border-top: none; }
.row:hover { background: #f7f8fa; }
.row-icon { flex-shrink: 0; }
.row-body { flex: 1; min-width: 0; }
.row-title { font-size: 14.5px; font-weight: 600; color: #1f2430; }
.row-meta { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }
</style>
