<script setup lang="ts">
import { ref } from 'vue'
import { Trophy, Medal } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()

interface LeaderEntry {
  rank: number
  name: string
  team: string
  points: number
  answers: number
  badges: string[]
  isMe?: boolean
}

const period = ref<'week' | 'month' | 'all'>('month')

const leaders = ref<LeaderEntry[]>([
  { rank: 1, name: '박이화', team: '인사팀', points: 2840, answers: 47, badges: ['🏆', '⭐'] },
  { rank: 2, name: '김동욱', team: 'IT지원팀', points: 2310, answers: 38, badges: ['🥇'] },
  { rank: 3, name: '이서연', team: '재무팀', points: 1980, answers: 31, badges: ['🥈'] },
  { rank: 4, name: '최준혁', team: '개발1팀', points: 1540, answers: 24, badges: [] },
  { rank: 5, name: '한다원', team: '인사팀', points: 1230, answers: 19, badges: [] },
  { rank: 6, name: auth.nickname ?? '나', team: auth.team ?? '', points: 890, answers: 13, badges: [], isMe: true },
  { rank: 7, name: '정미래', team: '마케팅팀', points: 760, answers: 11, badges: [] },
  { rank: 8, name: '오준석', team: '보안팀', points: 620, answers: 9, badges: [] },
])

function rankColor(rank: number) {
  if (rank === 1) return '#f5c000'
  if (rank === 2) return '#aeb2bb'
  if (rank === 3) return '#cd7f32'
  return '#1f2430'
}
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <div class="page-head">
      <h1 class="page-title">
        <Trophy :size="28" color="#f5c000" />
        리더보드
      </h1>
      <p class="page-sub">답변·티켓 처리로 포인트를 획득하세요</p>
    </div>

    <div class="seg" style="width: 280px; margin-bottom: 28px;">
      <button :class="{ on: period === 'week' }" @click="period = 'week'">이번 주</button>
      <button :class="{ on: period === 'month' }" @click="period = 'month'">이번 달</button>
      <button :class="{ on: period === 'all' }" @click="period = 'all'">전체</button>
    </div>

    <div class="podium">
      <div v-for="entry in leaders.slice(0, 3)" :key="entry.rank" class="podium-item" :class="`rank-${entry.rank}`">
        <span class="podium-badges">{{ entry.badges.join('') }}</span>
        <span class="chat-av podium-av">{{ entry.name.slice(0, 1) }}</span>
        <div class="podium-name">{{ entry.name }}</div>
        <div class="podium-team">{{ entry.team }}</div>
        <div class="podium-pts" :style="{ color: rankColor(entry.rank) }">{{ entry.points.toLocaleString() }}pt</div>
        <div class="podium-bar" :style="{ height: `${100 - (entry.rank - 1) * 22}px`, background: rankColor(entry.rank) }"></div>
      </div>
    </div>

    <div class="leader-list">
      <div
        v-for="entry in leaders"
        :key="entry.rank"
        class="card leader-row"
        :class="{ 'leader-row--me': entry.isMe }"
      >
        <div class="rank-num" :style="{ color: rankColor(entry.rank), fontWeight: 800 }">
          <Medal v-if="entry.rank <= 3" :size="18" />
          <span v-else>{{ entry.rank }}</span>
        </div>
        <span class="chat-av" style="font-size: 13px; font-weight: 700;">{{ entry.name.slice(0, 1) }}</span>
        <div class="leader-info">
          <div class="leader-name">
            {{ entry.name }}
            <span v-if="entry.isMe" class="badge blue" style="font-size: 11px; padding: 2px 8px;">나</span>
          </div>
          <div class="leader-team">{{ entry.team }}</div>
        </div>
        <div class="leader-stats">
          <span style="font-size: 13px; color: #aeb2bb;">답변 {{ entry.answers }}개</span>
          <span class="leader-pts" :style="{ color: rankColor(entry.rank) }">{{ entry.points.toLocaleString() }}pt</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.podium {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, #f0f4ff, #fdf6e3);
  border-radius: 16px;
}
.podium-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.rank-1 { order: 2; }
.rank-2 { order: 1; }
.rank-3 { order: 3; }
.podium-badges { font-size: 20px; height: 28px; }
.podium-av { width: 46px; height: 46px; font-size: 16px; font-weight: 800; }
.podium-name { font-size: 14px; font-weight: 700; color: #1f2430; }
.podium-team { font-size: 12px; color: #aeb2bb; }
.podium-pts { font-size: 15px; font-weight: 800; }
.podium-bar { width: 60px; border-radius: 6px 6px 0 0; opacity: 0.25; }

.leader-list { display: flex; flex-direction: column; gap: 8px; }
.leader-row { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }
.leader-row--me { border-color: #2b7fff; background: #eff6ff; }
.rank-num { width: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.leader-info { flex: 1; }
.leader-name { font-size: 14.5px; font-weight: 700; color: #1f2430; display: flex; align-items: center; gap: 6px; }
.leader-team { font-size: 12.5px; color: #aeb2bb; }
.leader-stats { display: flex; align-items: center; gap: 14px; }
.leader-pts { font-size: 16px; font-weight: 800; }
</style>
