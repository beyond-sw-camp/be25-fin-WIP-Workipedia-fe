<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Library, Search, BookMarked } from '@lucide/vue'

const router = useRouter()
const query = ref('')
const activeTag = ref('전체')

interface Article {
  id: number
  title: string
  summary: string
  team: string
  tags: string[]
  views: number
  saved: number
  date: string
}

const tags = ['전체', 'HR', 'IT', '재무', '보안', '운영']

const articles = ref<Article[]>([
  { id: 1, title: '연차 사용 기준 완벽 정리', summary: '신청 기한, HR 시스템 경로, 반차 신청까지 한 번에 확인하세요.', team: '인사팀', tags: ['HR'], views: 842, saved: 130, date: '2025.05.10' },
  { id: 2, title: '법인카드 사용 가능 항목과 한도', summary: '점심 한도, 교통비, 접대비 기준을 정리했습니다.', team: '재무팀', tags: ['재무'], views: 517, saved: 98, date: '2025.04.22' },
  { id: 3, title: 'VPN 설정 방법 (Windows/Mac)', summary: '재택 시 사내망 접속을 위한 VPN 설정 절차입니다.', team: 'IT지원팀', tags: ['IT'], views: 430, saved: 74, date: '2025.03.15' },
  { id: 4, title: '출장 경비 정산 절차', summary: '출장비 청구 서류, 제출 기한, 계좌 등록 방법 안내.', team: '재무팀', tags: ['재무'], views: 310, saved: 55, date: '2025.02.28' },
  { id: 5, title: '보안 USB 사용 기준', summary: '허가된 USB만 사용 가능. 승인 절차와 반납 기준 정리.', team: '보안팀', tags: ['보안'], views: 198, saved: 40, date: '2025.04.01' },
])

const filtered = computed(() => {
  let list = articles.value
  if (activeTag.value !== '전체') list = list.filter(a => a.tags.includes(activeTag.value))
  if (query.value.trim()) list = list.filter(a => a.title.includes(query.value.trim()) || a.summary.includes(query.value.trim()))
  return list
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Library :size="28" color="#2b7fff" />
        지식 베이스
      </h1>
      <p class="page-sub">티켓·워키 답변에서 축적된 조직 지식</p>
    </div>

    <div class="search-bar" style="max-width: 400px; flex: 1; margin-bottom: 16px;">
      <Search :size="16" />
      <input v-model="query" placeholder="지식 검색" />
    </div>

    <div class="tag-bar">
      <button
        v-for="t in tags"
        :key="t"
        class="chip"
        :class="{ 'chip--on': activeTag === t }"
        @click="activeTag = t"
      >
        {{ t }}
      </button>
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
      검색 결과가 없습니다
    </div>

    <div v-else class="art-grid">
      <div
        v-for="a in filtered"
        :key="a.id"
        class="card art-card"
        @click="router.push(`/knowledge/${a.id}`)"
      >
        <div class="art-top">
          <span class="badge gray">{{ a.team }}</span>
          <span v-for="t in a.tags" :key="t" class="chip" style="padding: 3px 10px; font-size: 12px;">{{ t }}</span>
        </div>
        <h3 class="art-title">{{ a.title }}</h3>
        <p class="art-summary">{{ a.summary }}</p>
        <div class="art-footer">
          <span style="font-size: 12.5px; color: #aeb2bb;">{{ a.date }}</span>
          <div class="art-stats">
            <span>조회 {{ a.views }}</span>
            <BookMarked :size="13" />
            <span>{{ a.saved }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.chip--on { background: #2b7fff; border-color: #2b7fff; color: #fff; }
.art-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.art-card { padding: 22px 24px; cursor: pointer; transition: box-shadow 0.15s; }
.art-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.art-top { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.art-title { font-size: 15.5px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.art-summary { font-size: 14px; color: #717182; line-height: 1.6; margin: 0 0 16px; }
.art-footer { display: flex; align-items: center; justify-content: space-between; }
.art-stats { display: flex; align-items: center; gap: 4px; color: #aeb2bb; font-size: 12.5px; }
</style>
