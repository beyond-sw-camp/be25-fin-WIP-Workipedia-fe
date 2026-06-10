<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trophy, Medal } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { getEsgLeaderboard } from '@/api/pointApi'
import type { EsgLeaderboardResponse } from '@/types/esg'

const auth = useAuthStore()

const topRankers = ref<EsgLeaderboardResponse[]>([])
const myRank = ref<EsgLeaderboardResponse | null>(null)
const loading = ref(false)
const error = ref('')

// 내 순위가 상위 랭커 목록에 없으면 맨 아래에 별도로 덧붙인다.
const rows = computed(() => {
  const list = [...topRankers.value]
  if (myRank.value && !list.some((r) => r.userId === myRank.value!.userId)) {
    list.push(myRank.value)
  }
  return list
})

function isMe(entry: EsgLeaderboardResponse) {
  return myRank.value?.userId === entry.userId
}

function rankColor(rank: number) {
  if (rank === 1) return '#f5c000'
  if (rank === 2) return '#aeb2bb'
  if (rank === 3) return '#cd7f32'
  return '#1f2430'
}

const podium = computed(() => topRankers.value.slice(0, 3))

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getEsgLeaderboard()
    topRankers.value = res.data.topRankers
    myRank.value = res.data.myRank
  } catch {
    error.value = '리더보드를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <div class="page-head">
      <h1 class="page-title">
        <Trophy :size="28" color="#f5c000" />
        리더보드
      </h1>
      <p class="page-sub">답변·채택으로 ESG 점수를 쌓아 보세요</p>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>
    <div v-else-if="rows.length === 0" class="empty-ph" style="height: 240px;">랭킹 데이터가 없습니다</div>

    <template v-else>
      <div v-if="podium.length" class="podium">
        <div v-for="entry in podium" :key="entry.userId" class="podium-item" :class="`rank-${entry.rank}`">
          <span class="chat-av podium-av">{{ entry.nickname.slice(0, 1) }}</span>
          <div class="podium-name">{{ entry.nickname }}</div>
          <div class="podium-team">{{ entry.departmentName ?? '' }}</div>
          <div class="podium-pts" :style="{ color: rankColor(entry.rank) }">{{ entry.esgScore.toLocaleString() }}점</div>
          <div class="podium-bar" :style="{ height: `${100 - (entry.rank - 1) * 22}px`, background: rankColor(entry.rank) }"></div>
        </div>
      </div>

      <div class="leader-list">
        <div
          v-for="entry in rows"
          :key="entry.userId"
          class="card leader-row"
          :class="{ 'leader-row--me': isMe(entry) }"
        >
          <div class="rank-num" :style="{ color: rankColor(entry.rank), fontWeight: 800 }">
            <Medal v-if="entry.rank <= 3" :size="18" />
            <span v-else>{{ entry.rank }}</span>
          </div>
          <span class="chat-av" style="font-size: 13px; font-weight: 700;">{{ entry.nickname.slice(0, 1) }}</span>
          <div class="leader-info">
            <div class="leader-name">
              {{ entry.nickname }}
              <span v-if="isMe(entry)" class="badge blue" style="font-size: 11px; padding: 2px 8px;">나</span>
            </div>
            <div class="leader-team">{{ entry.departmentName ?? '' }} · {{ entry.gradeName }}</div>
          </div>
          <div class="leader-stats">
            <span style="font-size: 13px; color: #aeb2bb;">채택 {{ entry.acceptedAnswerCount }} / 답변 {{ entry.answerCount }}</span>
            <span class="leader-pts" :style="{ color: rankColor(entry.rank) }">{{ entry.esgScore.toLocaleString() }}점</span>
          </div>
        </div>
      </div>
    </template>
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
