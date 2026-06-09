<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, MessageCircle, CheckCircle2, Clock } from '@lucide/vue'
import { getQuestions, searchQuestions } from '@/api/workiApi'
import type { QuestionStatus } from '@/types/worki'

const router = useRouter()
const PAGE_SIZE = 20

const tab = ref<'all' | 'unsolved' | 'solved'>('all')
const query = ref('')

// 목록(QuestionSummaryResponse)과 검색(WorkiSearchResponse)이 공통으로 갖는 필드만 화면에 쓴다.
interface QuestionListItem {
  questionId: number
  title: string
  status: QuestionStatus
  viewCount: number
  createdAt: string
}

const items = ref<QuestionListItem[]>([])
const page = ref(0) // 현재까지 받은 마지막 페이지 (0-based)
const hasNext = ref(false) // 다음 페이지 존재 여부
const loading = ref(false) // 초기/검색 교체 로드
const loadingMore = ref(false) // 무한스크롤 추가 로드
const error = ref('')

// 활성 검색어. 2자 이상일 때만 채워지고, 비어 있으면 전체 목록 모드.
const activeKeyword = ref('')
// 빠르게 타이핑할 때 늦게 도착한 옛 응답이 최신 결과를 덮어쓰지 않도록 하는 토큰.
let seq = 0

function isSolved(status: QuestionStatus) {
  return status === 'ANSWERED'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 한 페이지 조회. append=false면 교체(초기/새 검색), true면 이어붙임(무한스크롤).
// 교체 시에도 items를 비우지 않아, 새 데이터가 도착할 때까지 기존 목록이 화면에 남는다 → 깜빡임 방지.
async function fetchPage(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''
  const mySeq = ++seq
  try {
    let next: QuestionListItem[]
    let more: boolean
    if (activeKeyword.value) {
      const res = await searchQuestions(activeKeyword.value, { page: pageNum, size: PAGE_SIZE })
      next = res.data.content
      more = res.data.pageInfo.hasNext
    } else {
      const res = await getQuestions({ page: pageNum, size: PAGE_SIZE, sort: 'createdAt,desc' })
      next = res.data.content
      more = !res.data.last
    }
    if (mySeq !== seq) return // 더 최신 요청이 있으면 이 응답은 버린다
    items.value = append ? [...items.value, ...next] : next
    hasNext.value = more
    page.value = pageNum
  } catch {
    if (mySeq === seq) error.value = append ? '더 불러오지 못했습니다.' : '목록을 불러오지 못했습니다.'
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return
  fetchPage(page.value + 1, true)
}

// 입력이 멈추면(0.3초) 활성 검색어를 갱신하고 첫 페이지부터 다시 로드. 2자 미만이면 전체 목록.
let debounce: ReturnType<typeof setTimeout>
watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    const kw = query.value.trim()
    activeKeyword.value = kw.length >= 2 ? kw : ''
    fetchPage(0, false)
  }, 300)
})

// 무한스크롤: 목록 끝의 sentinel이 화면에 들어오면 다음 페이지 로드.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  fetchPage(0, false)
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMore()
    },
    { rootMargin: '300px' }, // 바닥 300px 전에 미리 로드
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

// sentinel은 목록이 있을 때만 렌더되므로, 나타나고 사라질 때마다 관찰 대상을 갱신.
watch(sentinel, (el, prev) => {
  if (prev) observer?.unobserve(prev)
  if (el) observer?.observe(el)
})

onUnmounted(() => {
  clearTimeout(debounce)
  observer?.disconnect()
})

// 탭(해결/미해결) 필터는 받아온 결과에 클라이언트에서 적용
const filtered = computed(() => {
  let list = items.value
  if (tab.value === 'unsolved') list = list.filter(q => !isSolved(q.status))
  if (tab.value === 'solved') list = list.filter(q => isSolved(q.status))
  return list
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <MessageCircle :size="28" color="#7c3aed" />
        워키
      </h1>
      <p class="page-sub">팀원의 질문에 답하고 조직 지식을 쌓아요</p>
    </div>

    <div class="toolbar">
      <div class="seg" style="width: 300px;">
        <button :class="{ on: tab === 'all' }" @click="tab = 'all'">전체</button>
        <button :class="{ on: tab === 'unsolved' }" @click="tab = 'unsolved'">
          <Clock :size="13" /> 미해결
        </button>
        <button :class="{ on: tab === 'solved' }" @click="tab = 'solved'">
          <CheckCircle2 :size="13" /> 해결됨
        </button>
      </div>

      <div class="search-bar" style="flex: 1; max-width: 380px;">
        <Search :size="16" />
        <input v-model="query" placeholder="질문 검색" />
      </div>
    </div>

    <!-- 플레이스홀더는 보여줄 목록이 아예 없을 때만. 재검색 중에는 기존 목록을 유지해 깜빡임을 막는다. -->
    <div v-if="loading && items.length === 0" class="empty-ph" style="height: 260px; margin-top: 20px;">
      불러오는 중...
    </div>
    <div v-else-if="error && items.length === 0" class="empty-ph" style="height: 260px; margin-top: 20px;">
      {{ error }}
    </div>
    <div v-else-if="filtered.length === 0" class="empty-ph" style="height: 260px; margin-top: 20px;">
      {{ query.trim() ? '검색 결과가 없습니다' : '등록된 질문이 없습니다' }}
    </div>

    <div v-else class="wiki-list">
      <div
        v-for="item in filtered"
        :key="item.questionId"
        class="card wiki-item"
        @click="router.push(`/worki/${item.questionId}`)"
      >
        <div class="wiki-left">
          <span class="badge" :class="isSolved(item.status) ? 'green' : 'gray'">
            <CheckCircle2 v-if="isSolved(item.status)" :size="11" />
            <Clock v-else :size="11" />
            {{ isSolved(item.status) ? '해결됨' : '미해결' }}
          </span>
          <h3 class="wiki-title">{{ item.title }}</h3>
          <div class="wiki-meta">
            <span style="color: #aeb2bb; font-size: 13px; margin-left: auto;">{{ formatDate(item.createdAt) }}</span>
          </div>
        </div>
        <div class="wiki-stats">
          <div class="stat"><span>조회</span><strong>{{ item.viewCount }}</strong></div>
        </div>
      </div>

      <!-- 무한스크롤 트리거 + 추가 로딩 표시 -->
      <div ref="sentinel" class="scroll-sentinel"></div>
      <div v-if="loadingMore" class="load-more">더 불러오는 중...</div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.wiki-list { display: flex; flex-direction: column; gap: 12px; }
.wiki-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.wiki-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.wiki-left { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.wiki-title { font-size: 16.5px; font-weight: 700; color: #1f2430; margin: 0; }
.wiki-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wiki-stats { display: flex; gap: 24px; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat span { font-size: 12px; color: #aeb2bb; }
.stat strong { font-size: 18px; font-weight: 800; color: #1f2430; }
.scroll-sentinel { height: 1px; }
.load-more { text-align: center; padding: 16px; font-size: 13px; color: #aeb2bb; }
</style>
