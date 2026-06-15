<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, MessageCircle, BookOpen } from '@lucide/vue'
import { searchIntegrated, autocompleteSearch } from '@/api/searchApi'
import type { WorkiSearchResponse, QuestionStatus } from '@/types/worki'
import type { ManualSearchResponse } from '@/types/search'
import type { ManualStatus } from '@/types/manual'

const router = useRouter()
const query = ref('')

// 통합 검색 미리보기 크기(도메인별). 더 보려면 각 도메인 목록으로 이동한다.
const PREVIEW_SIZE = 10

const workiResults = ref<WorkiSearchResponse[]>([])
const workiTotal = ref(0)
const manualResults = ref<ManualSearchResponse[]>([])
const manualTotal = ref(0)

const loading = ref(false)
const error = ref('')
const searched = ref(false) // 한 번이라도 검색을 시도했는지
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)

// 빠른 타이핑 시 늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록 하는 토큰.
let seq = 0
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

async function runSearch(keyword: string) {
  // BE는 keyword 2~100자만 허용.
  if (keyword.length < 2) {
    workiResults.value = []
    manualResults.value = []
    searched.value = false
    return
  }
  const mySeq = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await searchIntegrated(keyword, PREVIEW_SIZE)
    if (mySeq !== seq) return
    workiResults.value = res.data.worki.content
    workiTotal.value = res.data.worki.pageInfo.totalElements
    manualResults.value = res.data.manuals.content
    manualTotal.value = res.data.manuals.pageInfo.totalElements
    searched.value = true
  } catch {
    if (mySeq === seq) error.value = '검색에 실패했습니다.'
  } finally {
    if (mySeq === seq) loading.value = false
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
      <p class="page-sub">워키 질문과 매뉴얼을 키워드로 검색하세요 (2자 이상)</p>
    </div>

    <div class="search-bar" style="max-width: 620px; margin-bottom: 24px; position: relative;">
      <Search :size="18" />
      <input
        v-model="query"
        placeholder="검색어를 입력하세요"
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
    <div v-else-if="workiResults.length === 0 && manualResults.length === 0" class="empty-ph" style="height: 240px;">
      '{{ query.trim() }}'에 대한 검색 결과가 없습니다
    </div>
    <template v-else>
      <!-- 워키 -->
      <section v-if="workiResults.length" class="result-section">
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
      </section>

      <!-- 매뉴얼 -->
      <section v-if="manualResults.length" class="result-section">
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
