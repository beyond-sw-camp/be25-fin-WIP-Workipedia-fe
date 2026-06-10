<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Trophy } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { getMyPoint, getPointHistories } from '@/api/pointApi'
import type { PointHistoryResponse } from '@/types/point'

const auth = useAuthStore()

const currentPoint = ref(0)
const histories = ref<PointHistoryResponse[]>([])
const page = ref(0) // Pageable 기반(0-based)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

const PAGE_SIZE = 20

// BE reasonType 코드 → 한글 라벨. 미정의 코드는 코드 그대로 노출.
const reasonLabel: Record<string, string> = {
  ANSWER_ACCEPTED: '답변 채택',
  ANSWER_CREATED: '답변 등록',
  QUESTION_CREATED: '질문 등록',
  TICKET_COMPLETED: '티켓 처리 완료',
  ADMIN_DEDUCT: '관리자 차감',
}

function labelOf(reasonType: string) {
  return reasonLabel[reasonType] ?? reasonType
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function fetchHistories(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  try {
    const res = await getPointHistories({ page: pageNum, size: PAGE_SIZE })
    histories.value = append ? [...histories.value, ...res.data.content] : res.data.content
    hasNext.value = res.data.pageInfo.hasNext
    page.value = pageNum
  } finally {
    if (append) loadingMore.value = false
  }
}

function loadMore() {
  if (loadingMore.value || !hasNext.value) return
  fetchHistories(page.value + 1, true)
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [pointRes] = await Promise.all([getMyPoint(), fetchHistories(0, false)])
    currentPoint.value = pointRes.data.currentPoint
  } catch {
    error.value = '포인트 정보를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner" style="max-width: 760px;">
    <div class="page-head">
      <h1 class="page-title">
        <Trophy :size="28" color="#f5c000" />
        포인트 내역
      </h1>
      <p class="page-sub">{{ auth.nickname }}님의 포인트 현황</p>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <template v-else>
      <div class="points-banner card">
        <div class="banner-pts">{{ currentPoint.toLocaleString() }}<span>pt</span></div>
        <div class="banner-label">보유 포인트</div>
      </div>

      <h3 class="hist-head">포인트 내역</h3>

      <div v-if="histories.length === 0" class="empty-ph" style="height: 160px;">내역이 없습니다</div>
      <div v-else class="hist-list">
        <div v-for="h in histories" :key="h.pointHistoryId" class="card hist-row">
          <div class="hist-reason">{{ labelOf(h.reasonType) }}</div>
          <div class="hist-date">{{ formatDate(h.createdAt) }}</div>
          <div class="hist-pts" :class="h.pointAmount >= 0 ? 'plus' : 'minus'">
            {{ h.pointAmount >= 0 ? '+' : '' }}{{ h.pointAmount }}pt
          </div>
        </div>

        <div v-if="hasNext" class="load-more">
          <button class="btn" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '불러오는 중...' : '더 보기' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.points-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 24px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #fdf6e3, #fff8e7);
}
.banner-pts { font-size: 48px; font-weight: 900; color: #f5c000; line-height: 1; }
.banner-pts span { font-size: 22px; margin-left: 4px; }
.banner-label { font-size: 14px; color: #aeb2bb; margin-top: 6px; }

.hist-head { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 12px; }
.hist-list { display: flex; flex-direction: column; gap: 8px; }
.hist-row { display: flex; align-items: center; padding: 16px 22px; gap: 12px; }
.hist-reason { flex: 1; font-size: 14.5px; font-weight: 600; color: #1f2430; }
.hist-date { font-size: 13px; color: #aeb2bb; }
.hist-pts { font-size: 16px; font-weight: 800; }
.plus { color: #00a63e; }
.minus { color: #ef4444; }
.load-more { text-align: center; padding: 8px; }
</style>
