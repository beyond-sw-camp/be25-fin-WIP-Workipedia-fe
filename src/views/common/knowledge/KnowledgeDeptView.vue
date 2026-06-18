<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, ChevronRight, Library, Clock, Search } from '@lucide/vue'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'

const router = useRouter()
const route = useRoute()
const deptId = Number(route.params.deptId)

const knowledgeStore = useKnowledgeStore()
const query = ref('')

// store 전체 항목 중 현재 부서 것만 필터링하고 승인일 내림차순으로 정렬한다.
const items = computed(() =>
  [...knowledgeStore.items]
    .filter(i => i.departmentId === deptId)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt)),
)

const deptName = computed(() => {
  const first = items.value[0]
  return first !== undefined ? (first.departmentName ?? `부서 #${deptId}`) : `부서 #${deptId}`
})

const filteredItems = computed(() => {
  const q = query.value.trim()
  if (!q) return items.value
  return items.value.filter(i =>
    i.question.includes(q) || i.answer.includes(q),
  )
})

const PAGE_SIZE = 5
const currentPage = ref(0)
watch(query, () => { currentPage.value = 0 })

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() =>
  filteredItems.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE),
)

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

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

onMounted(() => { knowledgeStore.load() })
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <button class="btn" style="margin-bottom: 12px;" @click="router.push('/knowledge')">
        <ChevronLeft :size="16" /> 부서 목록
      </button>
      <h1 class="page-title">
        <Library :size="28" color="#2b7fff" />
        {{ deptName }}
      </h1>
      <p class="page-sub">{{ items.length }}건의 지식화 문서</p>
    </div>

    <div v-if="knowledgeStore.loading || (!knowledgeStore.loaded && !knowledgeStore.error)" class="empty-ph" style="height: 200px;">
      불러오는 중...
    </div>

    <template v-else>
    <div class="search-bar" style="margin-bottom: 20px;">
      <Search :size="16" />
      <input v-model="query" placeholder="질문 또는 답변 내용으로 검색" />
    </div>

    <div v-if="filteredItems.length === 0" class="empty-ph" style="height: 200px;">
      {{ query ? '검색 결과가 없습니다' : '이 부서에 등록된 지식이 없습니다' }}
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
            <h3 class="item-question">{{ item.question }}</h3>
            <span
              class="badge"
              :class="ageBadgeClass(daysSince(item.approvedAt))"
              :style="ageBadgeStyle(daysSince(item.approvedAt))"
            >
              <Clock :size="11" />
              {{ daysSince(item.approvedAt) }}일 전
            </span>
          </div>
          <p class="item-preview">{{ truncate(item.answer) }}</p>
          <div class="item-footer">
            <span class="item-date">{{ formatDate(item.approvedAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage === 0"
          @click="currentPage--"
        >
          <ChevronLeft :size="15" />
        </button>
        <span class="page-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages - 1"
          @click="currentPage++"
        >
          <ChevronRight :size="15" />
        </button>
      </div>
    </template>
    </template>
  </div>
</template>

<style scoped>
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

.item-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.item-question { font-size: 15px; font-weight: 700; color: #1f2430; margin: 0; flex: 1; line-height: 1.4; }
.item-preview { font-size: 13.5px; color: #717182; line-height: 1.6; margin: 0; }
.item-footer { display: flex; align-items: center; justify-content: space-between; }
.item-date { font-size: 12px; color: #aeb2bb; }
.item-author { font-size: 12px; color: #aeb2bb; }

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
