<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Trophy } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { getMyPoint, getPointHistories } from '@/api/pointApi'
import type { PointHistoryResponse } from '@/types/point'

const auth = useAuthStore()

// BE API는 type 파라미터(ALL | EARN | SPEND)로 서버 측 필터링을 지원한다.
// 탭 전환 시 page를 0으로 리셋하고 재요청해 탭별 페이지네이션이 독립적으로 동작한다.
type Tab = 'ALL' | 'EARN' | 'SPEND'
const activeTab = ref<Tab>('ALL')

const currentPoint = ref(0)
const histories = ref<PointHistoryResponse[]>([])
const page = ref(0)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

const PAGE_SIZE = 20

// BE PointReasonType enum 코드를 화면 표시용 한국어로 변환한다.
// 맵에 없는 코드는 ?? 연산자로 원본 코드를 그대로 노출한다.
const REASON_LABEL: Record<string, string> = {
  LOGIN:                                    '로그인',
  WORKI_QUESTION_CREATED:                   '워키 질문 작성',
  WORKI_FIRST_QUESTION_CREATED:             '첫 워키 질문 작성',
  WORKI_ANSWER_CREATED:                     '워키 답변 작성',
  WORKI_ANSWER_ACCEPTED:                    '워키 답변 채택',
  TICKET_ANSWER_CREATED:                    '티켓 답변 등록',
  TICKET_KNOWLEDGE_CREATED:                 '지식화 승인',
  '부적절한 워키게시글 작성으로 인한 차감': '부적절 게시물 패널티',
  YEARLY_RESET:                             '연간 포인트 초기화',
}

function formatDate(iso: string) {
  // "2025-05-22T14:30:00" → "2025.05.22 14:30"
  return iso.slice(0, 16).replace('T', ' ').replace(/-/g, '.')
}

// append=true면 더보기(이어붙이기), false면 탭 전환/초기 로드(교체).
// 두 케이스를 하나의 함수로 처리해 로딩 상태 관리를 일원화한다.
async function fetchPage(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const res = await getPointHistories({ page: pageNum, size: PAGE_SIZE, type: activeTab.value })
    histories.value = append ? [...histories.value, ...res.data.content] : res.data.content
    hasNext.value = res.data.pageInfo.hasNext
    page.value = pageNum
  } catch {
    if (!append) error.value = '포인트 내역을 불러오지 못했습니다.'
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasNext.value) return
  await fetchPage(page.value + 1, true)
}

// 탭 전환 시 에러를 초기화하고 해당 탭의 첫 페이지를 새로 요청한다.
watch(activeTab, () => {
  error.value = ''
  fetchPage(0, false)
})

// 현재 보유 포인트와 이력 첫 페이지를 병렬 요청해 초기 렌더링 시간을 줄인다.
onMounted(async () => {
  error.value = ''
  try {
    const [pointRes] = await Promise.all([getMyPoint(), fetchPage(0, false)])
    currentPoint.value = pointRes.data.currentPoint
  } catch {
    error.value = '포인트 정보를 불러오지 못했습니다.'
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

      <div class="tab-bar">
        <button
          v-for="[val, label] in ([['ALL', '전체'], ['EARN', '적립'], ['SPEND', '소모']] as [Tab, string][])"
          :key="val"
          class="tab-btn"
          :class="{ active: activeTab === val }"
          @click="activeTab = val"
        >
          {{ label }}
        </button>
      </div>

      <div v-if="histories.length === 0" class="empty-ph" style="height: 160px;">내역이 없습니다</div>
      <div v-else class="hist-list">
        <div v-for="h in histories" :key="h.pointHistoryId" class="card hist-row">
          <div class="hist-left">
            <div class="hist-reason">{{ REASON_LABEL[h.reasonType] ?? h.reasonType }}</div>
            <div class="hist-date">{{ formatDate(h.createdAt) }}</div>
          </div>
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
  margin-bottom: 16px;
  background: linear-gradient(135deg, #fdf6e3, #fff8e7);
}
.banner-pts { font-size: 48px; font-weight: 900; color: #f5c000; line-height: 1; }
.banner-pts span { font-size: 22px; margin-left: 4px; }
.banner-label { font-size: 14px; color: #aeb2bb; margin-top: 6px; }

.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}

.tab-btn {
  padding: 0.55rem 1.25rem;
  background: none;
  border: none;
  font-size: 0.9rem;
  color: #aeb2bb;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn.active {
  color: #f5c000;
  border-bottom-color: #f5c000;
  font-weight: 700;
}

.hist-list { display: flex; flex-direction: column; gap: 8px; }

.hist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  gap: 12px;
}

.hist-left { display: flex; flex-direction: column; gap: 4px; }
.hist-reason { font-size: 14.5px; font-weight: 600; color: #1f2430; }
.hist-date { font-size: 12.5px; color: #aeb2bb; }

.hist-pts { font-size: 16px; font-weight: 800; flex-shrink: 0; }
.plus { color: #00a63e; }
.minus { color: #ef4444; }

.load-more { text-align: center; padding: 8px; }
</style>
