<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, MessageCircle, CheckCircle2, Clock, Plus } from '@lucide/vue'

const router = useRouter()

interface WikiItem {
  id: number
  title: string
  team: string
  tags: string[]
  views: number
  answers: number
  solved: boolean
  time: string
}

const tab = ref<'all' | 'unsolved' | 'solved'>('all')
const query = ref('')

const items = ref<WikiItem[]>([
  { id: 1, title: '연차 신청은 며칠 전까지 해야 하나요?', team: '인사팀', tags: ['연차', 'HR'], views: 142, answers: 3, solved: true, time: '2일 전' },
  { id: 2, title: '재택근무 신청 절차가 어떻게 되나요?', team: '인사팀', tags: ['재택', '근무'], views: 98, answers: 1, solved: true, time: '5일 전' },
  { id: 3, title: '노트북 화면이 안 나와요 — 어떻게 하죠?', team: 'IT지원팀', tags: ['노트북', 'HW'], views: 57, answers: 0, solved: false, time: '1일 전' },
  { id: 4, title: '점심 법인카드 한도가 얼마인가요?', team: '재무팀', tags: ['법인카드', '점심'], views: 210, answers: 2, solved: true, time: '1주 전' },
  { id: 5, title: '팀 채널에 외부 협력사를 초대할 수 있나요?', team: 'IT지원팀', tags: ['채팅', '권한'], views: 34, answers: 0, solved: false, time: '3시간 전' },
])

const filtered = computed(() => {
  let list = items.value
  if (tab.value === 'unsolved') list = list.filter(i => !i.solved)
  if (tab.value === 'solved') list = list.filter(i => i.solved)
  if (query.value.trim()) list = list.filter(i => i.title.includes(query.value.trim()))
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

      <button class="btn primary" @click="router.push('/worki/new')">
        <Plus :size="16" /> 질문 올리기
      </button>
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 260px; margin-top: 20px;">
      검색 결과가 없습니다
    </div>

    <div v-else class="wiki-list">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="card wiki-item"
        @click="router.push(`/worki/${item.id}`)"
      >
        <div class="wiki-left">
          <span class="badge" :class="item.solved ? 'green' : 'gray'">
            <CheckCircle2 v-if="item.solved" :size="11" />
            <Clock v-else :size="11" />
            {{ item.solved ? '해결됨' : '미해결' }}
          </span>
          <h3 class="wiki-title">{{ item.title }}</h3>
          <div class="wiki-meta">
            <span class="badge gray">{{ item.team }}</span>
            <span v-for="t in item.tags" :key="t" class="chip" style="padding: 3px 10px; font-size: 13px;">{{ t }}</span>
            <span style="color: #aeb2bb; font-size: 13px; margin-left: auto;">{{ item.time }}</span>
          </div>
        </div>
        <div class="wiki-stats">
          <div class="stat"><span>조회</span><strong>{{ item.views }}</strong></div>
          <div class="stat"><span>답변</span><strong>{{ item.answers }}</strong></div>
        </div>
      </div>
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
</style>
