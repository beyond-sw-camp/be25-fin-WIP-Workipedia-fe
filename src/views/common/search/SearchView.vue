<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Ticket, MessageCircle, BookOpen, Library } from '@lucide/vue'

const router = useRouter()
const query = ref('')
const activeTab = ref('전체')

const tabs = ['전체', '티켓', '워키', '매뉴얼', '지식 베이스']

interface Result {
  id: number
  kind: '티켓' | '워키' | '매뉴얼' | '지식 베이스'
  title: string
  snippet: string
  meta: string
  path: string
}

const mockResults: Result[] = [
  { id: 1, kind: '워키', title: '연차 신청은 며칠 전까지 해야 하나요?', snippet: '연차는 사용일 기준 72시간(3일) 전까지...', meta: '인사팀 · 2025.05.15', path: '/worki/1' },
  { id: 2, kind: '매뉴얼', title: '연차·휴가 사용 가이드', snippet: '신청 기한, HR 시스템 경로, 반차 신청까지...', meta: '인사팀 · 2025.03.10', path: '/manuals/1' },
  { id: 3, kind: '지식 베이스', title: '연차 사용 기준 완벽 정리', snippet: '신청 기한, HR 시스템 경로, 반차 신청까지 한 번에...', meta: '인사팀 · 2025.05.10', path: '/knowledge/1' },
  { id: 4, kind: '티켓', title: '노트북 화면 출력 불가', snippet: 'IT지원팀에서 처리 중입니다...', meta: 'IT지원팀 · 처리중 · 2025.05.20', path: '/tickets/101' },
]

const kindIcon: Record<string, unknown> = {
  티켓: Ticket,
  워키: MessageCircle,
  매뉴얼: BookOpen,
  '지식 베이스': Library,
}

const kindColor: Record<string, string> = {
  티켓: '#ff6900',
  워키: '#7c3aed',
  매뉴얼: '#ff6900',
  '지식 베이스': '#2b7fff',
}

const results = computed(() => {
  if (!query.value.trim()) return []
  let list = mockResults.filter(r =>
    r.title.includes(query.value.trim()) || r.snippet.includes(query.value.trim())
  )
  if (activeTab.value !== '전체') list = list.filter(r => r.kind === activeTab.value)
  return list
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Search :size="28" color="#1f2430" />
        통합 검색
      </h1>
    </div>

    <div class="search-bar" style="max-width: 620px; margin-bottom: 20px;">
      <Search :size="18" />
      <input v-model="query" placeholder="검색어를 입력하세요" autofocus />
    </div>

    <div class="tag-bar">
      <button
        v-for="t in tabs"
        :key="t"
        class="chip"
        :class="{ 'chip--on': activeTab === t }"
        @click="activeTab = t"
      >
        {{ t }}
      </button>
    </div>

    <div v-if="!query.trim()" class="empty-ph" style="height: 240px;">
      검색어를 입력하면 결과가 표시됩니다
    </div>
    <div v-else-if="results.length === 0" class="empty-ph" style="height: 240px;">
      '{{ query }}'에 대한 검색 결과가 없습니다
    </div>
    <div v-else class="result-list">
      <div
        v-for="r in results"
        :key="r.id"
        class="card result-item"
        @click="router.push(r.path)"
      >
        <div class="result-kind" :style="{ color: kindColor[r.kind] }">
          <component :is="kindIcon[r.kind]" :size="14" />
          {{ r.kind }}
        </div>
        <h3 class="result-title">{{ r.title }}</h3>
        <p class="result-snippet">{{ r.snippet }}</p>
        <div class="result-meta">{{ r.meta }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.chip--on { background: #2b7fff; border-color: #2b7fff; color: #fff; }
.result-list { display: flex; flex-direction: column; gap: 12px; }
.result-item { padding: 20px 24px; cursor: pointer; transition: box-shadow 0.15s; }
.result-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.result-kind { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; margin-bottom: 8px; }
.result-title { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 6px; }
.result-snippet { font-size: 14px; color: #717182; line-height: 1.6; margin: 0 0 10px; }
.result-meta { font-size: 12.5px; color: #aeb2bb; }
</style>
