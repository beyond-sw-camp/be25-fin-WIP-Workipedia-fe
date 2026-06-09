<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, MessageCircle } from '@lucide/vue'
import { searchQuestions, autocompleteQuestions } from '@/api/workiApi'
import type { QuestionStatus } from '@/types/worki'

const router = useRouter()
const query = ref('')

// BE 통합 검색은 현재 워키 질문만 지원한다(search/worki). 매뉴얼·티켓·지식 검색은 BE 미구현.
const PAGE_SIZE = 20

interface Result {
  questionId: number
  title: string
  status: QuestionStatus
  viewCount: number
  createdAt: string
}

const results = ref<Result[]>([])
const loading = ref(false)
const error = ref('')
const searched = ref(false) // 한 번이라도 검색을 시도했는지
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)

// 빠른 타이핑 시 늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록 하는 토큰.
let seq = 0
let suppressNext = false

const statusLabel: Record<QuestionStatus, string> = {
  WAITING: '답변 대기',
  IN_PROGRESS: '답변 진행 중',
  ANSWERED: '해결됨',
  TICKETED: '티켓 전환',
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
    results.value = []
    searched.value = false
    return
  }
  const mySeq = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await searchQuestions(keyword, { page: 0, size: PAGE_SIZE })
    if (mySeq !== seq) return
    results.value = res.data.content
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
    const res = await autocompleteQuestions(keyword)
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
      <p class="page-sub">워키 질문을 키워드로 검색하세요 (2자 이상)</p>
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

    <div v-if="loading && results.length === 0" class="empty-ph" style="height: 240px;">
      검색 중...
    </div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">
      {{ error }}
    </div>
    <div v-else-if="!searched" class="empty-ph" style="height: 240px;">
      검색어를 입력하면 결과가 표시됩니다
    </div>
    <div v-else-if="results.length === 0" class="empty-ph" style="height: 240px;">
      '{{ query.trim() }}'에 대한 검색 결과가 없습니다
    </div>
    <div v-else class="result-list">
      <div
        v-for="r in results"
        :key="r.questionId"
        class="card result-item"
        @click="router.push(`/worki/${r.questionId}`)"
      >
        <div class="result-kind" style="color: #7c3aed;">
          <MessageCircle :size="14" />
          워키
        </div>
        <h3 class="result-title">{{ r.title }}</h3>
        <div class="result-meta">{{ statusLabel[r.status] }} · 조회 {{ r.viewCount }} · {{ formatDate(r.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-list { display: flex; flex-direction: column; gap: 12px; }
.result-item { padding: 20px 24px; cursor: pointer; transition: box-shadow 0.15s; }
.result-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.result-kind { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; margin-bottom: 8px; }
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
