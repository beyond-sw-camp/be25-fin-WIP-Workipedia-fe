<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Star, X } from '@lucide/vue'
import { getMyPoint, getPointHistories } from '@/api/pointApi'
import type { PointHistoryResponse } from '@/types/point'

const emit = defineEmits<{ close: [] }>()

// 전체 / 적립(pointAmount >= 0) / 소모(pointAmount < 0) 세 탭을 FE에서 필터링한다.
// 사이드바 패널은 초기 10건만 로드하므로 탭별 별도 API 호출 없이 메모리 필터로 처리한다.
type Tab = 'all' | 'earn' | 'use'
const activeTab = ref<Tab>('all')

const currentPoint = ref(0)
const histories = ref<PointHistoryResponse[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(0)
const hasNext = ref(false)
const error = ref(false)

// BE PointReasonType enum 코드를 화면 표시용 한국어로 변환한다.
// 맵에 없는 코드(관리자 자유 입력 차감, 미래 추가 사유 등)는 ?? 연산자로 원본 코드를 그대로 노출한다.
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

// activeTab에 따라 전체 이력을 메모리 필터링한다.
const filtered = computed(() =>
  histories.value.filter(h =>
    activeTab.value === 'all'  ? true :
    activeTab.value === 'earn' ? h.pointAmount >= 0 :
                                  h.pointAmount < 0,
  ),
)

function formatDate(iso: string) {
  // "2025-05-22T14:30:00" → "2025.05.22 14:30"
  return iso.slice(0, 16).replace('T', ' ').replace(/-/g, '.')
}

// 패널이 열릴 때 현재 포인트와 첫 페이지 이력을 병렬 요청한다.
// 둘 중 하나라도 실패하면 error 상태로 전환해 재시도 버튼을 표시한다.
async function loadInitial() {
  loading.value = true
  error.value = false
  try {
    const [pointRes, histRes] = await Promise.all([
      getMyPoint(),
      getPointHistories({ page: 0, size: 10 }),
    ])
    currentPoint.value = pointRes.data.currentPoint
    histories.value = histRes.data.content
    hasNext.value = histRes.data.pageInfo.hasNext
    page.value = 0
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// 중복 호출 방지를 위해 loadingMore / hasNext를 확인한 뒤 다음 페이지를 이어붙인다.
async function loadMore() {
  if (loadingMore.value || !hasNext.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await getPointHistories({ page: next, size: 10 })
    histories.value.push(...res.data.content)
    hasNext.value = res.data.pageInfo.hasNext
    page.value = next
  } finally {
    loadingMore.value = false
  }
}

onMounted(loadInitial)
</script>

<template>
  <div class="panel">
    <!-- 헤더 -->
    <div class="panel-header">
      <span class="panel-title"><Star :size="15" class="star-icon" /> 포인트 내역</span>
      <button class="close-btn" @click="emit('close')"><X :size="16" /></button>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="state-ph">불러오는 중...</div>

    <!-- 에러 -->
    <div v-else-if="error" class="state-ph error-ph">
      불러오지 못했습니다
      <button class="retry-btn" @click="loadInitial">다시 시도</button>
    </div>

    <template v-else>
      <!-- 현재 보유 포인트 -->
      <div class="point-summary">
        <span class="summary-label">현재 보유 포인트</span>
        <span class="summary-value">{{ currentPoint.toLocaleString() }}P</span>
      </div>

      <!-- 탭 -->
      <div class="tab-bar">
        <button
          v-for="tab in (['all', 'earn', 'use'] as Tab[])"
          :key="tab"
          class="tab-btn"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab === 'all' ? '전체' : tab === 'earn' ? '적립' : '소모' }}
        </button>
      </div>

      <!-- 이력 목록 -->
      <div class="history-list">
        <div v-if="filtered.length === 0" class="state-ph">내역이 없습니다</div>

        <div
          v-for="h in filtered"
          :key="h.pointHistoryId"
          class="history-item"
        >
          <div class="item-left">
            <span class="item-reason">{{ REASON_LABEL[h.reasonType] ?? h.reasonType }}</span>
            <span class="item-date">{{ formatDate(h.createdAt) }}</span>
          </div>
          <span class="item-amount" :class="h.pointAmount >= 0 ? 'earn' : 'use'">
            {{ h.pointAmount >= 0 ? '+' : '' }}{{ h.pointAmount }}P
          </span>
        </div>

        <button
          v-if="hasNext && activeTab === 'all'"
          class="more-btn"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? '불러오는 중...' : '더 보기' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  left: var(--sidebar-width);
  top: 0;
  width: 320px;
  height: 100vh;
  background: #fff;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.star-icon { color: #f59e0b; }

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.15s;
}

.close-btn:hover { background: #f1f5f9; color: #475569; }

/* 보유 포인트 바 */
.point-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.25rem;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  flex-shrink: 0;
}

.summary-label { font-size: 0.82rem; color: #92400e; }
.summary-value { font-size: 1.1rem; font-weight: 800; color: #ea580c; }

/* 탭 */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 0;
  background: none;
  border: none;
  font-size: 0.85rem;
  color: #94a3b8;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn.active {
  color: #f97316;
  border-bottom-color: #f97316;
  font-weight: 700;
}

/* 이력 목록 */
.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.1s;
}

.history-item:hover { background: #f8fafc; }

.item-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.item-reason { font-size: 0.85rem; font-weight: 500; color: #1e293b; }
.item-date { font-size: 0.75rem; color: #94a3b8; }

.item-amount { font-size: 0.9rem; font-weight: 700; flex-shrink: 0; margin-left: 12px; }
.item-amount.earn { color: #ea580c; }
.item-amount.use { color: #3b82f6; }

/* 상태 공통 */
.state-ph {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.875rem;
  color: #94a3b8;
  padding: 2rem;
}

.error-ph { color: #ef4444; }

.retry-btn {
  font-size: 0.8rem;
  padding: 6px 14px;
  border: 1px solid #ef4444;
  border-radius: 8px;
  background: none;
  color: #ef4444;
  cursor: pointer;
}

.retry-btn:hover { background: #fff0f0; }

/* 더 보기 */
.more-btn {
  margin: 12px auto;
  display: block;
  font-size: 0.82rem;
  color: #64748b;
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.more-btn:hover:not(:disabled) { background: #f8fafc; }
.more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
