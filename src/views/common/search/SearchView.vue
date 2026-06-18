<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// 통합 검색 뷰. 워키·매뉴얼·지식화·수기 지식 4개 도메인을 병렬로 검색해 섹션별로 표시한다.
//
// 핵심 구현 포인트
//   1. 첫 검색: searchIntegrated(워키+매뉴얼)와 searchKnowledge·searchDirectData를 Promise.all로
//      병렬 호출해 왕복 횟수를 최소화한다.
//   2. 도메인별 페이지 이동: 각 섹션 독립 seq 토큰으로 race condition을 방지한다.
//   3. 페이지 base 혼용: 워키·매뉴얼은 0-based(Spring Pageable), 지식화·수기 지식은 1-based(BasePageRequest).
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, MessageCircle, BookOpen, Library, BookMarked } from '@lucide/vue'
import { searchIntegrated, searchWorki, searchManuals, searchKnowledge, searchDirectData, autocompleteSearch } from '@/api/searchApi'
import BasePagination from '@/components/common/BasePagination.vue'
import type { WorkiSearchResponse, QuestionStatus } from '@/types/worki'
import type { ManualSearchResponse } from '@/types/search'
import type { ManualStatus } from '@/types/manual'
import type { KnowledgeDataResponse } from '@/types/knowledge'
import type { DirectDataResponse } from '@/api/directDataApi'

const router = useRouter()
const query = ref('')

// 도메인별 한 페이지에 보여줄 건수.
const PAGE_SIZE = 10

const workiResults = ref<WorkiSearchResponse[]>([])
const workiPage = ref(1) // 1-based(UI 기준)
const workiTotalPages = ref(0)
const workiTotal = ref(0)

const manualResults = ref<ManualSearchResponse[]>([])
const manualPage = ref(1)
const manualTotalPages = ref(0)
const manualTotal = ref(0)

const knowledgeResults = ref<KnowledgeDataResponse[]>([])
const knowledgePage = ref(1)
const knowledgeTotalPages = ref(0)
const knowledgeTotal = ref(0)

const directDataResults = ref<DirectDataResponse[]>([])
const directDataPage = ref(1)
const directDataTotalPages = ref(0)
const directDataTotal = ref(0)

const loading = ref(false)
const error = ref('')
const searched = ref(false) // 한 번이라도 검색을 시도했는지
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)

// 빠른 타이핑/연속 클릭 시 늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록 하는 토큰.
// 새 검색은 모든 섹션을 무효화하고, 페이지 이동은 해당 섹션만 무효화한다.
let searchSeq = 0
let workiSeq = 0
let manualSeq = 0
let knowledgeSeq = 0
let directDataSeq = 0
let suppressNext = false

const workiStatusLabel: Record<QuestionStatus, string> = {
  WAITING: '답변 대기',
  IN_PROGRESS: '답변 진행 중',
  ANSWERED: '해결됨',
  TICKETED: '티켓 전환',
  DELETED: '삭제됨',
}

const manualStatusLabel: Record<ManualStatus, string> = {
  DRAFT: '작성 중',
  PUBLISHED: '게시됨',
  ARCHIVED: '보관됨',
  DELETED: '삭제됨',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 새 키워드 검색: 4개 도메인을 병렬로 조회해 각 섹션 1페이지를 채운다.
// 워키·매뉴얼은 통합 검색 API 한 번, 지식화·수기 지식은 개별 엔드포인트를 호출한다.
async function runSearch(keyword: string) {
  // BE는 keyword 2~100자만 허용.
  if (keyword.length < 2) {
    workiResults.value = []
    manualResults.value = []
    knowledgeResults.value = []
    directDataResults.value = []
    searched.value = false
    return
  }
  const mySeq = ++searchSeq
  // 이전 키워드의 페이지 이동 응답이 남아 덮어쓰지 않도록 무효화.
  workiSeq++
  manualSeq++
  knowledgeSeq++
  directDataSeq++
  loading.value = true
  error.value = ''
  try {
    const [integratedRes, knowledgeRes, directRes] = await Promise.all([
      searchIntegrated(keyword, PAGE_SIZE),
      searchKnowledge(keyword, { page: 1, size: PAGE_SIZE }),
      searchDirectData(keyword, { page: 1, size: PAGE_SIZE }),
    ])
    if (mySeq !== searchSeq) return
    workiResults.value = integratedRes.data.worki.content
    workiTotal.value = integratedRes.data.worki.pageInfo.totalElements
    workiTotalPages.value = integratedRes.data.worki.pageInfo.totalPages
    workiPage.value = 1
    manualResults.value = integratedRes.data.manuals.content
    manualTotal.value = integratedRes.data.manuals.pageInfo.totalElements
    manualTotalPages.value = integratedRes.data.manuals.pageInfo.totalPages
    manualPage.value = 1
    knowledgeResults.value = knowledgeRes.data.content
    knowledgeTotal.value = knowledgeRes.data.pageInfo.totalElements
    knowledgeTotalPages.value = knowledgeRes.data.pageInfo.totalPages
    knowledgePage.value = 1
    directDataResults.value = directRes.data.content
    directDataTotal.value = directRes.data.pageInfo.totalElements
    directDataTotalPages.value = directRes.data.pageInfo.totalPages
    directDataPage.value = 1
    searched.value = true
  } catch {
    if (mySeq === searchSeq) error.value = '검색에 실패했습니다.'
  } finally {
    if (mySeq === searchSeq) loading.value = false
  }
}

// 워키 섹션 페이지 이동(0-based).
async function goWorkiPage(p: number) {
  const mySeq = ++workiSeq
  try {
    const res = await searchWorki(query.value.trim(), { page: p - 1, size: PAGE_SIZE })
    if (mySeq !== workiSeq) return
    workiResults.value = res.data.content
    workiTotalPages.value = res.data.pageInfo.totalPages
    workiPage.value = p
  } catch {
    if (mySeq === workiSeq) error.value = '검색에 실패했습니다.'
  }
}

async function goManualPage(p: number) {
  const mySeq = ++manualSeq
  try {
    const res = await searchManuals(query.value.trim(), { page: p - 1, size: PAGE_SIZE })
    if (mySeq !== manualSeq) return
    manualResults.value = res.data.content
    manualTotalPages.value = res.data.pageInfo.totalPages
    manualPage.value = p
  } catch {
    if (mySeq === manualSeq) error.value = '검색에 실패했습니다.'
  }
}

// 지식화·수기 지식 섹션 페이지 이동(1-based).
async function goKnowledgePage(p: number) {
  const mySeq = ++knowledgeSeq
  try {
    const res = await searchKnowledge(query.value.trim(), { page: p, size: PAGE_SIZE })
    if (mySeq !== knowledgeSeq) return
    knowledgeResults.value = res.data.content
    knowledgeTotalPages.value = res.data.pageInfo.totalPages
    knowledgePage.value = p
  } catch {
    if (mySeq === knowledgeSeq) error.value = '검색에 실패했습니다.'
  }
}

async function goDirectDataPage(p: number) {
  const mySeq = ++directDataSeq
  try {
    const res = await searchDirectData(query.value.trim(), { page: p, size: PAGE_SIZE })
    if (mySeq !== directDataSeq) return
    directDataResults.value = res.data.content
    directDataTotalPages.value = res.data.pageInfo.totalPages
    directDataPage.value = p
  } catch {
    if (mySeq === directDataSeq) error.value = '검색에 실패했습니다.'
  }
}

async function loadSuggestions(keyword: string) {
  if (!keyword) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  try {
    const res = await autocompleteSearch(keyword)
    suggestions.value = res.data
    showSuggestions.value = res.data.length > 0
  } catch {
    suggestions.value = []
    showSuggestions.value = false
  }
}

function selectSuggestion(word: string) {
  suppressNext = true
  query.value = word
  showSuggestions.value = false
  suggestions.value = []
  clearTimeout(debounce)
  runSearch(word.trim())
}

function hideSuggestionsSoon() {
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

let debounce: ReturnType<typeof setTimeout>
watch(query, () => {
  if (suppressNext) {
    suppressNext = false
    return
  }
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    const kw = query.value.trim()
    runSearch(kw)
    loadSuggestions(kw)
  }, 300)
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Search :size="28" color="#1f2430" />
        통합 검색
      </h1>
      <p class="page-sub">워키·매뉴얼·지식화·수기 지식을 키워드로 검색해보세요. (2자 이상)</p>
    </div>

    <div class="search-bar" style="max-width: 620px; margin-bottom: 24px; position: relative;">
      <Search :size="18" />
      <input
        v-model="query"
        placeholder="키워드 입력"
        autofocus
        @focus="showSuggestions = suggestions.length > 0"
        @blur="hideSuggestionsSoon"
      />
      <ul v-if="showSuggestions && suggestions.length" class="autocomplete">
        <li
          v-for="word in suggestions"
          :key="word"
          @mousedown.prevent="selectSuggestion(word)"
        >
          <Search :size="13" /> {{ word }}
        </li>
      </ul>
    </div>

    <div v-if="loading && !searched" class="empty-ph" style="height: 240px;">
      검색 중...
    </div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">
      {{ error }}
    </div>
    <div v-else-if="!searched" class="empty-ph" style="height: 240px;">
      검색어를 입력하면 결과가 표시됩니다
    </div>
    <div v-else-if="workiResults.length === 0 && manualResults.length === 0 && knowledgeResults.length === 0 && directDataResults.length === 0" class="empty-ph" style="height: 240px;">
      '{{ query.trim() }}'에 대한 검색 결과가 없습니다
    </div>
    <template v-else>
      <!-- 워키 -->
      <section v-if="workiTotal" class="result-section">
        <div class="section-head" style="color: #7c3aed;">
          <MessageCircle :size="16" />
          워키 <span class="section-count">{{ workiTotal }}</span>
        </div>
        <div class="result-list">
          <div
            v-for="r in workiResults"
            :key="r.questionId"
            class="card result-item"
            @click="router.push(`/worki/${r.questionId}`)"
          >
            <h3 class="result-title">{{ r.title }}</h3>
            <div class="result-meta">{{ workiStatusLabel[r.status] }} · 조회 {{ r.viewCount }} · {{ formatDate(r.createdAt) }}</div>
          </div>
        </div>
        <BasePagination :page="workiPage" :total-pages="workiTotalPages" @change="goWorkiPage" />
      </section>

      <!-- 매뉴얼 -->
      <section v-if="manualTotal" class="result-section">
        <div class="section-head" style="color: #10b981;">
          <BookOpen :size="16" />
          매뉴얼 <span class="section-count">{{ manualTotal }}</span>
        </div>
        <div class="result-list">
          <div
            v-for="m in manualResults"
            :key="m.manualId"
            class="card result-item"
            @click="router.push(`/manuals/${m.manualId}`)"
          >
            <h3 class="result-title">{{ m.title }}</h3>
            <div class="result-meta">{{ manualStatusLabel[m.status] }} · v{{ m.version }} · {{ formatDate(m.createdAt) }}</div>
          </div>
        </div>
        <BasePagination :page="manualPage" :total-pages="manualTotalPages" @change="goManualPage" />
      </section>

      <!-- 지식화 게시판 -->
      <section v-if="knowledgeTotal" class="result-section">
        <div class="section-head" style="color: #2b7fff;">
          <Library :size="16" />
          지식화 게시판 <span class="section-count">{{ knowledgeTotal }}</span>
        </div>
        <div class="result-list">
          <div
            v-for="k in knowledgeResults"
            :key="k.knowledgeDataId"
            class="card result-item"
            @click="router.push(`/knowledge/${k.knowledgeDataId}`)"
          >
            <h3 class="result-title">{{ k.question }}</h3>
            <div class="result-meta">{{ k.departmentName ?? '부서 미지정' }} · {{ formatDate(k.approvedAt) }}</div>
          </div>
        </div>
        <BasePagination :page="knowledgePage" :total-pages="knowledgeTotalPages" @change="goKnowledgePage" />
      </section>

      <!-- 수기 지식 게시판 -->
      <section v-if="directDataTotal" class="result-section">
        <div class="section-head" style="color: #f59e0b;">
          <BookMarked :size="16" />
          수기 지식 <span class="section-count">{{ directDataTotal }}</span>
        </div>
        <div class="result-list">
          <div
            v-for="d in directDataResults"
            :key="d.directDataId"
            class="card result-item"
            @click="router.push(`/direct-data/${d.directDataId}`)"
          >
            <h3 class="result-title">{{ d.title }}</h3>
            <div class="result-meta">{{ d.category ?? '카테고리 없음' }} · {{ formatDate(d.updatedAt) }}</div>
          </div>
        </div>
        <BasePagination :page="directDataPage" :total-pages="directDataTotalPages" @change="goDirectDataPage" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.result-section { margin-bottom: 28px; }
.section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
}
.section-count {
  font-size: 12.5px;
  font-weight: 600;
  color: #aeb2bb;
}
.result-list { display: flex; flex-direction: column; gap: 12px; }
.result-item { padding: 20px 24px; cursor: pointer; transition: box-shadow 0.15s; }
.result-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.result-title { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 6px; }
.result-meta { font-size: 12.5px; color: #aeb2bb; }

.autocomplete {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  max-height: 280px;
  overflow-y: auto;
}
.autocomplete li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 7px;
  font-size: 14px;
  color: #1f2430;
  cursor: pointer;
}
.autocomplete li:hover { background: #f3f0ff; color: #7c3aed; }
</style>
