<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// 지식화 게시판 목록 뷰. 부서 카테고리 선택 없이 전체 지식을 단일 평탄 목록으로 표시한다.
//
// 핵심 구현 포인트
//   1. 데이터 소스: useKnowledgeStore에서 공유 캐시를 참조한다. 최초 마운트 시 load()를 호출하고
//      이후 라우터 이동으로 재진입해도 API를 중복 호출하지 않는다(loaded 플래그).
//   2. 정렬: approvedAt 내림차순 — 가장 최근 승인된 지식이 맨 위에 표시된다.
//   3. 부서 표시: 카테고리 탐색 대신 각 카드에 Building2 아이콘 + departmentName 배지로 소속을 표시.
//   4. 경과일 색상: 7일 이내 초록 → 30일 이내 파랑 → 90일 이내 주황 → 초과 빨강으로 정보 신선도를 표현.
//   5. 프론트엔드 페이지네이션: PAGE_SIZE=8, query 변경 시 currentPage를 0으로 초기화한다.
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Library, Search, Clock, Building2, ChevronLeft, ChevronRight, Trash2 } from '@lucide/vue'
import BaseToast from '@/components/common/BaseToast.vue'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'
import { deleteKnowledgeData, deleteKnowledgeDataAsAdmin } from '@/api/knowledgeApi'
import { useAuthStore } from '@/stores/authStore'
import { ROLES } from '@/constants/roles'
import type { KnowledgeDataResponse } from '@/types/knowledge'

const router = useRouter()
const knowledgeStore = useKnowledgeStore()
const auth = useAuthStore()
const query = ref('')

// 전체 항목을 최근 업데이트(approvedAt) 내림차순으로 정렬해 즉시 표시한다.
// 부서별 카테고리 선택 화면 없이 단일 목록으로 진입하는 것이 이 뷰의 핵심이다.
const sortedItems = computed(() =>
  [...knowledgeStore.items].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt)),
)

const filteredItems = computed(() => {
  const q = query.value.trim()
  if (!q) return sortedItems.value
  return sortedItems.value.filter(i =>
    i.question.includes(q) || i.answer.includes(q),
  )
})

const PAGE_SIZE = 8
const currentPage = ref(0)
watch(query, () => { currentPage.value = 0 })

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() =>
  filteredItems.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE),
)

const deptCount = computed(() => new Set(knowledgeStore.items.map(i => i.departmentId)).size)

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

// 경과일: 초록(7일 이내) → 파랑(30일 이내) → 주황(90일 이내) → 빨강(90일 초과)
function ageBadgeClass(days: number) {
  if (days <= 7) return 'green'
  if (days <= 30) return 'blue'
  return ''
}

function ageBadgeStyle(days: number) {
  if (days <= 30) return {}
  if (days <= 90) return { background: '#fff4e5', color: '#e25c1e', borderColor: '#fcd4b0' }
  return { background: '#fff0f0', color: '#e03131', borderColor: '#ffc0c0' }
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

function truncate(text: string, max = 120) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// SYSTEM_ADMIN: 전체 삭제 가능 / TEAM_ADMIN: 자기 부서(departmentId 일치)만 삭제 가능
function canDelete(item: KnowledgeDataResponse): boolean {
  if (auth.role === ROLES.SYSTEM_ADMIN) return true
  if (auth.role === ROLES.TEAM_ADMIN) return item.departmentId === auth.departmentId
  return false
}

// 삭제 대상을 ref에 보관해 확인 모달을 먼저 띄운 뒤 confirmDelete에서 실행한다.
// 카드 클릭 이벤트와 충돌하지 않도록 삭제 버튼에 @click.stop을 적용한다.
const deleteTarget = ref<KnowledgeDataResponse | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const showDeleteToast = ref(false)

// SYSTEM_ADMIN은 전용 엔드포인트, TEAM_ADMIN은 팀 스코프 엔드포인트를 호출한다.
// API 성공 직후 store에서도 항목을 제거해 목록이 새로고침 없이 즉시 갱신되도록 한다.
async function confirmDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    const id = deleteTarget.value.knowledgeDataId
    await (auth.role === ROLES.SYSTEM_ADMIN ? deleteKnowledgeDataAsAdmin(id) : deleteKnowledgeData(id))
    knowledgeStore.remove(deleteTarget.value.knowledgeDataId)
    deleteTarget.value = null
    showDeleteToast.value = true
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { message?: string } } }
    deleteError.value = err.response?.data?.message ?? `삭제 실패 (${err.response?.status ?? '네트워크 오류'})`
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => { knowledgeStore.load() })
</script>

<template>
  <div class="content-inner">
    <div class="page-head-row">
      <div>
        <h1 class="page-title">
          <Library :size="28" color="#2b7fff" />
          지식화 게시판
        </h1>
        <p class="page-sub">티켓 답변에서 축적된 조직 지식을 탐색합니다.</p>
      </div>
      <div v-if="knowledgeStore.loaded" class="card summary-card">
        <div class="summary-item">
          <div class="summary-value">{{ knowledgeStore.items.length }}</div>
          <div class="summary-label">전체 지식</div>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <div class="summary-value">{{ deptCount }}</div>
          <div class="summary-label">참여 부서</div>
        </div>
      </div>
    </div>

    <div v-if="knowledgeStore.loading || (!knowledgeStore.loaded && !knowledgeStore.error)" class="empty-ph" style="height: 200px;">
      불러오는 중...
    </div>
    <div v-else-if="knowledgeStore.error" class="empty-ph" style="height: 200px;">
      목록을 불러올 수 없습니다
    </div>

    <template v-else>
      <div class="search-bar" style="margin-bottom: 20px;">
        <Search :size="16" />
        <input v-model="query" placeholder="질문 또는 답변 내용으로 검색" />
      </div>

      <div v-if="filteredItems.length === 0" class="empty-ph" style="height: 200px;">
        {{ query ? '검색 결과가 없습니다' : '등록된 지식이 없습니다' }}
      </div>

      <template v-else>
        <div class="item-list">
          <div
            v-for="item in pagedItems"
            :key="item.knowledgeDataId"
            class="card item-card"
            @click="router.push(`/knowledge/${item.knowledgeDataId}`)"
          >
            <div class="item-top">
              <div class="item-badges">
                <span class="badge gray">
                  <Building2 :size="11" />
                  {{ item.departmentName ?? '부서 미지정' }}
                </span>
                <span
                  class="badge"
                  :class="ageBadgeClass(daysSince(item.approvedAt))"
                  :style="ageBadgeStyle(daysSince(item.approvedAt))"
                >
                  <Clock :size="11" />
                  {{ daysSince(item.approvedAt) }}일 전
                </span>
              </div>
              <div class="item-actions">
                <span class="item-date">{{ formatDate(item.approvedAt) }}</span>
                <button
                  v-if="canDelete(item)"
                  class="btn-delete"
                  title="삭제"
                  @click.stop="deleteTarget = item"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
            <h3 class="item-question">{{ item.question }}</h3>
            <p class="item-preview">{{ truncate(item.answer) }}</p>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :disabled="currentPage === 0" @click="currentPage--">
            <ChevronLeft :size="15" />
          </button>
          <span class="page-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage >= totalPages - 1" @click="currentPage++">
            <ChevronRight :size="15" />
          </button>
        </div>
      </template>
    </template>
  </div>

  <BaseToast v-model="showDeleteToast" title="지식이 삭제됐습니다" type="success" />

  <!-- 삭제 확인 모달 -->
  <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
    <div class="modal-box">
      <p class="modal-msg">이 지식을 삭제할까요?</p>
      <p class="modal-sub">{{ deleteTarget.question }}</p>
      <div class="modal-actions">
        <p v-if="deleteError" class="delete-error">{{ deleteError }}</p>
        <button class="btn" :disabled="isDeleting" @click="deleteTarget = null">취소</button>
        <button class="btn btn-danger" :disabled="isDeleting" @click="confirmDelete">
          {{ isDeleting ? '삭제 중...' : '삭제' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.summary-card {
  display: flex;
  align-items: center;
  padding: 16px 36px;
  flex-shrink: 0;
  min-width: 280px;
}
.summary-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.summary-value { font-size: 26px; font-weight: 900; color: #2b7fff; }
.summary-label { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }
.summary-divider { width: 1px; height: 40px; background: var(--line); margin: 0 28px; }

.item-list { display: flex; flex-direction: column; gap: 12px; }
.item-card {
  padding: 20px 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.15s;
}
.item-card:hover { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }

.item-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.item-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.item-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.item-date { font-size: 12px; color: #aeb2bb; white-space: nowrap; }
.btn-delete {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; color: #aeb2bb; cursor: pointer; transition: background 0.12s, color 0.12s;
}
.btn-delete:hover { background: #fee2e2; color: #e03131; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal-box {
  background: #fff; border-radius: 14px; padding: 28px 32px;
  min-width: 320px; max-width: 440px; display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
}
.modal-msg { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0; }
.modal-sub { font-size: 13.5px; color: #717182; margin: 0; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn-danger { background: #e03131; color: #fff; border-color: #e03131; }
.btn-danger:hover:not(:disabled) { background: #c92a2a; }
.delete-error { font-size: 13px; color: #e03131; margin: 0; }
.item-question { font-size: 15px; font-weight: 700; color: #1f2430; margin: 0; line-height: 1.4; }
.item-preview { font-size: 13.5px; color: #717182; line-height: 1.6; margin: 0; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  color: #1f2430;
  transition: background 0.1s;
}
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.page-btn:not(:disabled):hover { background: #f1f5f9; }
.page-info { font-size: 13.5px; color: #717182; min-width: 48px; text-align: center; }
</style>
