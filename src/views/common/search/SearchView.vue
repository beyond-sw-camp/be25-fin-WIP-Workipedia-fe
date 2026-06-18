<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// 통합 검색 뷰. 워키·매뉴얼·지식화·수기 지식 4개 도메인을 병렬로 검색해 섹션별로 표시한다.
//
// 핵심 구현 포인트
//   1. 워키·매뉴얼: searchIntegrated 통합 API + allSettled(부분 실패 허용)
//   2. 지식화·수기 지식: BE keyword 미지원 → 스토어 캐시 클라이언트 필터링
//   3. 띄어쓰기 정규화: 검색어·문서 모두 공백 제거 후 비교 ("법인카드" ↔ "법인 카드" 동일 취급)
//   4. 검색 상태 유지: URL ?q= 쿼리로 동기화 — 상세 → 뒤로가기 시 결과 복원
//   5. 워키·매뉴얼 seq 토큰으로 race condition 방지
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search, MessageCircle, BookOpen, Library, BookMarked } from '@lucide/vue'
import { searchIntegrated, searchWorki, searchManuals, autocompleteSearch } from '@/api/searchApi'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'
import { useDirectDataStore } from '@/stores/useDirectDataStore'
import BasePagination from '@/components/common/BasePagination.vue'
import type { WorkiSearchResponse, QuestionStatus } from '@/types/worki'
import type { ManualSearchResponse } from '@/types/search'
import type { ManualStatus } from '@/types/manual'
import type { KnowledgeDataResponse } from '@/types/knowledge'
import type { DirectDataResponse } from '@/api/directDataApi'

const router = useRouter()
const route = useRoute()
const knowledgeStore = useKnowledgeStore()
const directDataStore = useDirectDataStore()
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
// 클라이언트 필터 전체 결과를 보관해 페이지 이동 시 store 재조회 없이 슬라이싱만 한다.
const allFilteredKnowledge = ref<KnowledgeDataResponse[]>([])

const directDataResults = ref<DirectDataResponse[]>([])
const directDataPage = ref(1)
const directDataTotalPages = ref(0)
const directDataTotal = ref(0)
// 동일 이유로 수기 지식 전체 필터 결과를 보관한다.
const allFilteredDirectData = ref<DirectDataResponse[]>([])

const loading = ref(false)
const error = ref('')
const searched = ref(false) // 한 번이라도 검색을 시도했는지
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)

// 빠른 타이핑/연속 클릭 시 늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록 하는 토큰.
let searchSeq = 0
let workiSeq = 0
let manualSeq = 0
let suppressNext = false

// 공백을 제거한 소문자 — "법인카드" ↔ "법인 카드" 등 띄어쓰기 차이를 무시한다.
const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()

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

// 새 키워드 검색: 워키·매뉴얼은 BE API(원본 키워드), 지식화·수기 지식은 스토어 클라이언트 필터링.
// normalize()는 클라이언트 필터 비교에만 사용 — BE에는 원본 키워드를 전달해야 검색이 정상 작동한다.
async function runSearch(keyword: string) {
  const trimmed = keyword.trim()
  const kw = normalize(trimmed) // 클라이언트 필터용(공백 제거 + 소문자)
  if (trimmed.length < 2) {
    workiResults.value = []
    manualResults.value = []
    knowledgeResults.value = []
    directDataResults.value = []
    searched.value = false
    return
  }
  const mySeq = ++searchSeq
  workiSeq++
  manualSeq++
  loading.value = true
  error.value = ''

  // 워키·매뉴얼: 통합 API (원본 trimmed 키워드 전달 — BE가 직접 검색)
  const integratedResult = await Promise.allSettled([
    searchIntegrated(trimmed, PAGE_SIZE),
  ])
  if (mySeq !== searchSeq) { loading.value = false; return }

  if (integratedResult[0].status === 'fulfilled') {
    const d = integratedResult[0].value.data
    workiResults.value = d.worki.content
    workiTotal.value = d.worki.pageInfo.totalElements
    workiTotalPages.value = d.worki.pageInfo.totalPages
    workiPage.value = 1
    manualResults.value = d.manuals.content
    manualTotal.value = d.manuals.pageInfo.totalElements
    manualTotalPages.value = d.manuals.pageInfo.totalPages
    manualPage.value = 1
  }

  // 지식화: 스토어 캐시 클라이언트 필터링
  await knowledgeStore.load()
  const kFiltered = knowledgeStore.items.filter(k =>
    normalize(k.question).includes(kw) || normalize(k.answer).includes(kw)
  )
  allFilteredKnowledge.value = kFiltered
  knowledgeResults.value = kFiltered.slice(0, PAGE_SIZE)
  knowledgeTotal.value = kFiltered.length
  knowledgeTotalPages.value = Math.max(1, Math.ceil(kFiltered.length / PAGE_SIZE))
  knowledgePage.value = 1

  // 수기 지식: 스토어 캐시 클라이언트 필터링
  await directDataStore.load()
  const dFiltered = directDataStore.items.filter(d =>
    normalize(d.title).includes(kw) || normalize(d.content).includes(kw)
  )
  allFilteredDirectData.value = dFiltered
  directDataResults.value = dFiltered.slice(0, PAGE_SIZE)
  directDataTotal.value = dFiltered.length
  directDataTotalPages.value = Math.max(1, Math.ceil(dFiltered.length / PAGE_SIZE))
  directDataPage.value = 1

  searched.value = true
  loading.value = false
}

// 워키·매뉴얼 페이지 이동: Spring Pageable은 0-based이므로 UI 1-based 페이지에서 -1 변환.
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

// 지식화 페이지 이동 — 클라이언트 필터 결과에서 슬라이싱(동기).
function goKnowledgePage(p: number) {
  const start = (p - 1) * PAGE_SIZE
  knowledgeResults.value = allFilteredKnowledge.value.slice(start, start + PAGE_SIZE)
  knowledgePage.value = p
}

// 수기 지식 페이지 이동 — 클라이언트 필터 결과에서 슬라이싱(동기).
function goDirectDataPage(p: number) {
  const start = (p - 1) * PAGE_SIZE
  directDataResults.value = allFilteredDirectData.value.slice(start, start + PAGE_SIZE)
  directDataPage.value = p
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

// 자동완성 항목 클릭: query 변경이 watch를 트리거해 debounce 검색이 이중 실행되므로
// suppressNext=true로 watch의 첫 사이클을 건너뛰고 아래 runSearch 직접 호출만 실행한다.
function selectSuggestion(word: string) {
  suppressNext = true
  query.value = word
  showSuggestions.value = false
  suggestions.value = []
  clearTimeout(debounce)
  runSearch(word.trim())
}

// blur 이벤트는 mousedown보다 먼저 발생하므로 즉시 숨기면 목록 클릭이 소실된다.
// 150ms 지연으로 mousedown(→click) 완료 후 닫히도록 한다.
function hideSuggestionsSoon() {
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

// 엔터 키: 자동완성을 닫고 즉시 검색 실행
function handleEnter() {
  const kw = query.value.trim()
  showSuggestions.value = false
  clearTimeout(debounce)
  runSearch(kw)
}

let debounce: ReturnType<typeof setTimeout>
// query 변경 감지: debounce 300ms 후 검색 실행.
// suppressNext=true이면 자동완성 클릭·onMounted 복원처럼 외부에서 이미 runSearch를 호출한 경우이므로 건너뛴다.
watch(query, () => {
  if (suppressNext) {
    suppressNext = false
    return
  }
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    const kw = query.value.trim()
    // URL ?q= 동기화 — 상세 → 뒤로가기 시 검색 상태를 복원하기 위함
    router.replace({ path: '/search', query: kw.length >= 2 ? { q: kw } : {} })
    runSearch(kw)
    loadSuggestions(kw)
  }, 300)
})

// 뒤로가기 재진입 시 URL의 ?q= 값으로 검색 상태 복원
onMounted(() => {
  const q = route.query.q as string | undefined
  if (q && q.length >= 2) {
    suppressNext = true   // watch가 debounce를 이중 실행하지 않도록 억제
    query.value = q
    runSearch(q)
  }
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

    <div class="search-bar" style="margin-bottom: 24px; position: relative;">
      <Search :size="18" />
      <input
        v-model="query"
        placeholder="키워드 입력"
        autofocus
        @focus="showSuggestions = suggestions.length > 0"
        @blur="hideSuggestionsSoon"
        @keyup.enter="handleEnter"
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
          워키 게시판 <span class="section-count">{{ workiTotal }}</span>
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
            @click="router.push(`/manuals/${m.manualId}?from=search`)"
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
