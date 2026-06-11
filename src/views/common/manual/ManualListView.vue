<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Search, Clock, FileText, ChevronRight } from '@lucide/vue'
import { getManuals } from '@/api/manualApi'
import { useDeptStore } from '@/stores/deptStore'
import type { ManualSummaryResponse } from '@/types/manual'

const router = useRouter()
const deptStore = useDeptStore()
const query = ref('')
const activeTab = ref<'recent' | 'all'>('recent')

const PAGE_SIZE = 20
const manuals = ref<ManualSummaryResponse[]>([])
const page = ref(1)
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

// API가 최신순 고정이므로 상위 6개가 가장 최근
const recentManuals = computed(() => filtered.value.slice(0, 6))

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

    <!-- Header -->
    <div class="page-head">
      <h1 class="page-title">
        <BookOpen :size="28" color="#10b981" />
        문서 / 매뉴얼
      </h1>
      <p class="page-sub">사내 매뉴얼과 최근 업데이트 내역을 확인하세요</p>
    </div>

    <!-- Search -->
    <div class="search-bar" style="margin-bottom: 24px;">
      <Search :size="16" />
      <input v-model="query" placeholder="매뉴얼 검색..." />
    </div>

    <!-- Tabs -->
    <div class="seg" style="margin-bottom: 24px;">
      <button :class="{ on: activeTab === 'recent' }" @click="activeTab = 'recent'">
        <Clock :size="14" /> 최근 업데이트
      </button>
      <button :class="{ on: activeTab === 'all' }" @click="activeTab = 'all'">
        <FileText :size="14" /> 전체 매뉴얼
      </button>
    </div>

    <div v-if="loading && manuals.length === 0" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error && manuals.length === 0" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <!-- 최근 업데이트 탭 -->
    <template v-else-if="activeTab === 'recent'">
      <div v-if="recentManuals.length === 0" class="empty-ph" style="height: 240px;">
        {{ query.trim() ? '검색 결과가 없습니다' : '등록된 매뉴얼이 없습니다' }}
      </div>
      <div v-else class="manual-list">
        <div
          v-for="m in recentManuals"
          :key="m.manualId"
          class="card manual-row"
          @click="router.push(`/manuals/${m.manualId}`)"
        >
          <div class="manual-icon"><BookOpen :size="18" color="#10b981" /></div>
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
      </div>
    </template>

    <!-- 전체 매뉴얼 탭 -->
    <template v-else>
      <div v-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
        {{ query.trim() ? '검색 결과가 없습니다' : '등록된 매뉴얼이 없습니다' }}
      </div>
      <div v-else class="manual-list">
        <div
          v-for="m in filtered"
          :key="m.manualId"
          class="card manual-row"
          @click="router.push(`/manuals/${m.manualId}`)"
        >
          <div class="manual-icon"><BookOpen :size="18" color="#10b981" /></div>
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
    </template>

  </div>
</template>

<style scoped>
/* ── Tabs icon alignment ── */
.seg button { display: flex; align-items: center; gap: 6px; }

/* ── All List ── */
.manual-list { display: flex; flex-direction: column; gap: 12px; }
.manual-row {
  display: flex; align-items: center; gap: 16px;
  padding: 18px 22px; cursor: pointer; transition: box-shadow 0.15s;
}
.manual-row:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.manual-icon {
  width: 42px; height: 42px; border-radius: 12px;
  background: #ecfdf5;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
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
