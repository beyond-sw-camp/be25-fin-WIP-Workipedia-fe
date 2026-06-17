<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Search, Clock, FileText, ChevronRight } from '@lucide/vue'
import { getManuals } from '@/api/manualApi'
import { useDeptStore } from '@/stores/deptStore'
import type { ManualSummaryResponse } from '@/types/manual'

const router = useRouter()
const deptStore = useDeptStore()
const query = ref('')
const activeTab = ref<'recent' | 'all'>('recent')

// 한 페이지에 표시할 항목 수. BE PageRequest의 size 파라미터로 전달된다.
const PAGE_SIZE = 10
const manuals = ref<ManualSummaryResponse[]>([])
const page = ref(1)
const totalPages = ref(0)
const loading = ref(false)
const error = ref('')

// BE가 반환하는 버전 문자열은 "v1", "1.0", "v1.0" 등 형식이 일정하지 않다.
// 화면에 표시할 때 "vN.M"으로 통일해 일관된 UX를 제공한다.
function fmtVersion(v: string | null | undefined): string | null {
  if (!v) return null
  const withDot = v.match(/v?(\d+)\.(\d+)/)
  if (withDot) return `v${withDot[1]}.${withDot[2]}`
  const onlyMajor = v.match(/v?(\d+)/)
  if (onlyMajor) return `v${onlyMajor[1]}.0`
  return v
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 1시간 미만 → "방금 전", 24시간 미만 → "N시간 전", 7일 미만 → "N일 전", 그 이상 → 날짜 형식으로 표시한다.
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const day = Math.floor(diff / 86_400_000)
  if (h < 1) return '방금 전'
  if (h < 24) return `${h}시간 전`
  if (day < 7) return `${day}일 전`
  return formatDate(iso)
}

// 검색은 현재 페이지에 로드된 10개 안에서만 클라이언트 사이드로 필터링한다.
// 검색어가 있으면 페이지네이션을 숨겨 혼란을 줄인다 (템플릿의 v-if 조건과 연동).
const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return manuals.value
  return manuals.value.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
})

// API가 최신순 고정이므로 1페이지 상위 6개가 전체 기준 가장 최근 매뉴얼이다.
// manuals는 현재 페이지 데이터를 담으므로, 전체 탭에서 페이지를 이동하면 stale해진다.
// 아래 watch에서 최근 탭 진입 시 page !== 1이면 1페이지를 재요청해 항상 최신 데이터를 보장한다.
const recentManuals = computed(() => filtered.value.slice(0, 6))

// 최근 업데이트 탭은 항상 1페이지(가장 최신) 데이터를 기준으로 한다.
// 전체 탭에서 2페이지 이상 이동한 뒤 최근 탭으로 돌아오면 오래된 항목이 표시되는 것을 방지한다.
watch(activeTab, (tab) => {
  if (tab === 'recent' && page.value !== 1) fetchPage(1)
})

// 현재 페이지 기준으로 최대 5개의 버튼을 표시한다.
// Math.min(page-2, totalPages-4)로 마지막 페이지 근처에서도 5개를 유지하고,
// Math.max(1, ...)로 1페이지 미만으로 내려가지 않도록 양쪽을 모두 클램핑한다.
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

// 지정한 페이지를 BE에서 새로 불러온다. manuals를 해당 페이지 데이터로 교체(누적 아님)한다.
// totalPages는 BE 응답의 pageInfo.totalPages를 그대로 사용해 페이지 버튼 수를 결정한다.
async function fetchPage(pageNum: number) {
  loading.value = true
  error.value = ''
  try {
    const res = await getManuals({ page: pageNum, size: PAGE_SIZE })
    manuals.value = res.data.content
    totalPages.value = res.data.pageInfo.totalPages
    page.value = pageNum
  } catch {
    error.value = '매뉴얼을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchPage(1))
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
          <div class="rc-top">
            <div class="rc-icon"><BookOpen :size="20" color="#10b981" /></div>
            <div class="rc-badges">
              <span :class="['badge', m.departmentId != null ? 'solid-blue' : 'gray']">{{ deptStore.getName(m.departmentId) }}</span>
              <span v-if="m.version" class="badge gray">{{ fmtVersion(m.version) }}</span>
            </div>
          </div>
          <div class="rc-title">{{ m.title }}</div>
          <div v-if="m.description" class="rc-desc line-clamp-2">{{ m.description }}</div>
          <div class="rc-date">
            <Clock :size="12" />
            {{ timeAgo(m.updatedAt) }}
          </div>
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
            <div v-if="m.description" class="manual-desc line-clamp-1">{{ m.description }}</div>
            <div class="manual-meta">
              <span :class="m.departmentId != null ? 'dept-tag' : 'dept-tag dept-common'">{{ deptStore.getName(m.departmentId) }}</span>
              <span v-if="m.version">{{ fmtVersion(m.version) }}</span>
              <span>최종 수정 {{ formatDate(m.updatedAt) }}</span>
            </div>
          </div>
          <ChevronRight :size="18" color="#aeb2bb" />
        </div>

        <div v-if="totalPages > 1 && !query.trim()" class="pagination">
          <button class="btn" :disabled="page === 1 || loading" @click="fetchPage(page - 1)">이전</button>
          <button
            v-for="p in pageNumbers"
            :key="p"
            :class="['btn', 'page-btn', { on: p === page }]"
            :disabled="loading"
            @click="fetchPage(p)"
          >{{ p }}</button>
          <button class="btn" :disabled="page === totalPages || loading" @click="fetchPage(page + 1)">다음</button>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
/* ── Tabs icon alignment ── */
.seg button { display: flex; align-items: center; gap: 6px; }

/* ── Recent Grid ── */
.recent-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

.recent-card {
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px 22px; cursor: pointer; transition: box-shadow 0.15s;
}
.recent-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }

.rc-top { display: flex; align-items: center; justify-content: space-between; }
.rc-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.rc-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: #ecfdf5;
  display: flex; align-items: center; justify-content: center;
}
.rc-title { font-size: 15px; font-weight: 700; color: #1f2430; line-height: 1.4; }
.rc-desc { font-size: 12.5px; color: #7a8fa8; line-height: 1.5; }
.rc-date { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: #aeb2bb; }

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
.manual-desc { font-size: 12.5px; color: #7a8fa8; margin-top: 3px; }
.manual-meta { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #aeb2bb; margin-top: 4px; }
.dept-tag {
  font-size: 11.5px; font-weight: 600; color: #2b7fff;
  background: #eff6ff; border-radius: 4px; padding: 1px 7px;
}
.dept-tag.dept-common { color: #9ca3af; background: #f3f4f6; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 16px 0 4px; }
.page-btn { min-width: 36px; }
.page-btn.on { background: #2b7fff; color: #fff; border-color: #2b7fff; }
</style>
