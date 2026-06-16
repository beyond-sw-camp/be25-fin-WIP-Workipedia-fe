<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Library, Search, Building2, ChevronRight } from '@lucide/vue'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'

const router = useRouter()
const query = ref('')
const knowledgeStore = useKnowledgeStore()
const allItems = computed(() => knowledgeStore.items)

onMounted(() => { knowledgeStore.load() })

interface DeptGroup {
  departmentId: number
  departmentName: string
  count: number
  lastUpdated: string
}

// 항목(KnowledgeDataResponse) 목록을 departmentId 기준으로 집계해 부서 카드 배열로 변환한다.
// 최근 업데이트 순(lastUpdated 내림차순)으로 정렬해 활발한 부서가 상단에 오도록 한다.
const deptGroups = computed<DeptGroup[]>(() => {
  const map = new Map<number, DeptGroup>()
  for (const item of allItems.value) {
    const entry = map.get(item.departmentId)
    if (entry) {
      entry.count++
      if (item.approvedAt > entry.lastUpdated) entry.lastUpdated = item.approvedAt
    } else {
      map.set(item.departmentId, {
        departmentId: item.departmentId,
        departmentName: item.departmentName ?? `부서 #${item.departmentId}`,
        count: 1,
        lastUpdated: item.approvedAt,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.lastUpdated.localeCompare(a.lastUpdated),
  )
})

const filtered = computed(() =>
  query.value.trim()
    ? deptGroups.value.filter(d => d.departmentName.includes(query.value.trim()))
    : deptGroups.value,
)

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}
</script>

<template>
  <div class="content-inner">
    <div class="page-head-row">
      <div>
        <h1 class="page-title">
          <Library :size="28" color="#2b7fff" />
          지식화 게시판
        </h1>
        <p class="page-sub">티켓 답변에서 축적된 조직 지식을 부서별로 탐색합니다</p>
      </div>
      <div class="card summary-card">
        <div class="summary-item">
          <div class="summary-value">{{ deptGroups.length }}</div>
          <div class="summary-label">전체 부서</div>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <div class="summary-value">{{ allItems.length }}</div>
          <div class="summary-label">전체 지식 건수</div>
        </div>
      </div>
    </div>

    <div v-if="knowledgeStore.loading || (!knowledgeStore.loaded && !knowledgeStore.error)" class="empty-ph" style="height: 200px;">
      불러오는 중...
    </div>

    <template v-else>
    <div class="search-bar" style="margin-bottom: 24px;">
      <Search :size="16" />
      <input v-model="query" placeholder="부서명으로 검색" />
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 200px;">
      {{ query ? '검색 결과가 없습니다' : '등록된 지식이 없습니다' }}
    </div>

    <div v-else class="dept-grid">
      <div
        v-for="dept in filtered"
        :key="dept.departmentId"
        class="card dept-card"
        @click="router.push(`/knowledge/dept/${dept.departmentId}`)"
      >
        <div class="dept-top">
          <Building2 :size="20" color="#2b7fff" />
          <span class="badge blue">{{ dept.count }}건</span>
        </div>
        <div class="dept-name">{{ dept.departmentName }}</div>
        <div class="dept-footer">
          <span class="dept-date">최근 업데이트 {{ formatDate(dept.lastUpdated) }}</span>
          <ChevronRight :size="14" color="#aeb2bb" />
        </div>
      </div>
    </div>
    </template>
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
  min-width: 340px;
}
.summary-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.summary-value { font-size: 26px; font-weight: 900; color: #2b7fff; }
.summary-label { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }
.summary-divider { width: 1px; height: 40px; background: var(--line); margin: 0 28px; }

.dept-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.dept-card {
  padding: 22px 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s, transform 0.15s;
}
.dept-card:hover { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }

.dept-top { display: flex; align-items: center; justify-content: space-between; }
.dept-name { font-size: 16px; font-weight: 700; color: #1f2430; }
.dept-footer { display: flex; align-items: center; justify-content: space-between; }
.dept-date { font-size: 12px; color: #aeb2bb; }
</style>
