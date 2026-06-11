<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Search, ChevronRight } from '@lucide/vue'
import { getManuals } from '@/api/manualApi'
import { useDeptStore } from '@/stores/deptStore'
import type { ManualSummaryResponse } from '@/types/manual'

const router = useRouter()
const deptStore = useDeptStore()
const query = ref('')

const PAGE_SIZE = 20
const manuals = ref<ManualSummaryResponse[]>([])
const page = ref(1) // BasePageRequest 기반(1-based)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return manuals.value
  return manuals.value.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
})

async function fetchPage(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''
  try {
    const res = await getManuals({ page: pageNum, size: PAGE_SIZE })
    manuals.value = append ? [...manuals.value, ...res.data.content] : res.data.content
    hasNext.value = res.data.pageInfo.hasNext
    page.value = pageNum
  } catch {
    error.value = '매뉴얼을 불러오지 못했습니다.'
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return
  fetchPage(page.value + 1, true)
}

onMounted(() => fetchPage(1, false))
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <BookOpen :size="28" color="#ff6900" />
        매뉴얼
      </h1>
      <p class="page-sub">업무 가이드와 규정을 확인하세요</p>
    </div>

    <div class="search-bar" style="max-width: 480px; margin-bottom: 28px;">
      <Search :size="16" />
      <input v-model="query" placeholder="매뉴얼 검색" />
    </div>

    <div v-if="loading && manuals.length === 0" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error && manuals.length === 0" class="empty-ph" style="height: 240px;">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
      {{ query.trim() ? '검색 결과가 없습니다' : '등록된 매뉴얼이 없습니다' }}
    </div>

    <div v-else class="manual-list">
      <div
        v-for="m in filtered"
        :key="m.manualId"
        class="card manual-row"
        @click="router.push(`/manuals/${m.manualId}`)"
      >
        <div class="manual-icon"><BookOpen :size="18" color="#ff6900" /></div>
        <div class="manual-info">
          <div class="manual-title">{{ m.title }}</div>
          <div class="manual-meta">
            <span class="dept-tag">{{ deptStore.getName(m.departmentId) }}</span>
            <span v-if="m.version">v{{ m.version }}</span>
            <span>최종 수정 {{ formatDate(m.updatedAt) }}</span>
          </div>
        </div>
        <ChevronRight :size="18" color="#aeb2bb" />
      </div>

      <div v-if="hasNext && !query.trim()" class="load-more">
        <button class="btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '불러오는 중...' : '더 보기' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manual-list { display: flex; flex-direction: column; gap: 12px; }
.manual-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.manual-row:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.manual-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: #fff3e9;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.manual-info { flex: 1; min-width: 0; }
.manual-title { font-size: 15.5px; font-weight: 700; color: #1f2430; }
.manual-meta { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #aeb2bb; margin-top: 3px; }
.dept-tag {
  font-size: 11.5px; font-weight: 600; color: #2b7fff;
  background: #eff6ff; border-radius: 4px; padding: 1px 7px;
}
.load-more { text-align: center; padding: 8px; }
</style>
