<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Sparkles, Leaf, Award, Bell, ChevronRight } from '@lucide/vue'
import { getMyProfile, updateNotificationSettings } from '@/api/mypageApi'

const router = useRouter()
const auth = useAuthStore()

interface EsgLevel {
  level: number
  name: string
  minPoints: number
  maxPoints: number
  emoji: string
  description: string
}

const ESG_LEVELS: EsgLevel[] = [
  { level: 1, name: '아기 북극곰', minPoints: 0, maxPoints: 100, emoji: '🐻‍❄️', description: 'ESG 여정을 시작한 당신! 작은 발걸음이 큰 변화를 만듭니다.' },
  { level: 2, name: '성장하는 북극곰', minPoints: 101, maxPoints: 300, emoji: '🐻‍❄️', description: '지식을 나누며 성장하고 있어요. 북극의 얼음도 조금씩 회복 중!' },
  { level: 3, name: '건강한 북극곰', minPoints: 301, maxPoints: 700, emoji: '🐻‍❄️', description: '활발한 기여로 북극 생태계가 안정을 찾아가고 있습니다!' },
  { level: 4, name: '북극의 수호자', minPoints: 701, maxPoints: Infinity, emoji: '🐻‍❄️', description: '당신은 진정한 ESG 챔피언! 북극이 건강하게 빛나고 있어요.' },
]

const currentPoint = ref(0)
const esgScore = ref(0)
const issuedTicketCount = ref(0)

const notifications = ref({ all: true, ticket: true, board: true, manual: true })

async function handleNotification(type: 'all' | 'ticket' | 'board' | 'manual', value: boolean) {
  if (type === 'all') {
    notifications.value = { all: value, ticket: value, board: value, manual: value }
  } else {
    notifications.value[type] = value
    notifications.value.all = notifications.value.ticket && notifications.value.board && notifications.value.manual
  }
  const { all, ticket, board, manual } = notifications.value
  try {
    await updateNotificationSettings({
      allEnabled: all,
      ticketEnabled: ticket,
      workiEnabled: board,
      manualEnabled: manual,
    })
  } catch { /* 실패 시 UI 상태 유지 */ }
}

const currentLevel = computed<EsgLevel>(() => {
  for (const l of ESG_LEVELS) {
    if (esgScore.value >= l.minPoints && esgScore.value <= l.maxPoints) return l
  }
  return ESG_LEVELS[ESG_LEVELS.length - 1]!
})

const isMaxLevel = computed(() => currentLevel.value.level === 4)

const levelProgress = computed(() => {
  if (isMaxLevel.value) return 100
  const { minPoints, maxPoints } = currentLevel.value
  return ((esgScore.value - minPoints) / (maxPoints - minPoints)) * 100
})

onMounted(async () => {
  try {
    const res = await getMyProfile()
    const d = res.data
    currentPoint.value = d.point.currentPoint
    esgScore.value = d.point.esgScore
    issuedTicketCount.value = d.ticket.createdTicketCount
    const s = d.notificationSettings
    notifications.value = {
      all: s.allEnabled,
      ticket: s.ticketEnabled,
      board: s.workiEnabled,
      manual: s.manualEnabled,
    }
  } catch { /* keep defaults */ }
})
</script>

<template>
  <div class="content-inner mp-wrap">

    <!-- Welcome -->
    <div class="welcome-card">
      <div class="welcome-title">
        안녕하세요, {{ auth.nickname ?? '...' }}님
        <Sparkles :size="20" />
      </div>
      <p class="welcome-sub">오늘도 워키와 함께 지식을 공유하고 성장하세요!</p>
    </div>

    <!-- Stats -->
    <div class="stat-row">
      <button
        type="button"
        class="card stat-card stat-card--link"
        aria-label="내 발행 티켓 목록으로 이동"
        @click="router.push('/my/tickets')"
      >
        <ChevronRight class="stat-link-icon" :size="18" aria-hidden="true" />
        <div class="stat-val" style="color:#2b7fff;">{{ issuedTicketCount ?? 0 }}</div>
        <div class="stat-lbl">내 발행 티켓 확인 🎟️</div>
      </button>
      <div class="card stat-card">
        <div class="stat-val" style="color:#f97316;">{{ currentPoint.toLocaleString() }}P</div>
        <div class="stat-lbl">현재 포인트 ⭐</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val" style="color:#00a63e;">{{ esgScore.toLocaleString() }}P</div>
        <div class="stat-lbl">ESG 점수 🌱</div>
      </div>
    </div>

    <!-- Level Progress -->
    <div class="card lv-card">
      <div class="lv-top">
        <span class="lv-name">{{ currentLevel.emoji }} Lv.{{ currentLevel.level }} {{ currentLevel.name }}</span>
        <span v-if="isMaxLevel" class="badge solid-orange">최고 레벨 달성!</span>
        <span v-else class="lv-pts">{{ esgScore.toLocaleString() }} / {{ currentLevel.maxPoints }}P</span>
      </div>
      <div class="bar-wrap">
        <div class="bar-fill" :style="{ width: `${levelProgress}%` }"></div>
      </div>
      <p class="lv-hint">
        <template v-if="isMaxLevel">최고 레벨에 도달했습니다! 이제 리더보드 상위권을 노려보세요 🏆</template>
        <template v-else>다음 레벨까지 {{ (currentLevel.maxPoints - esgScore).toLocaleString() }}P 남았어요</template>
      </p>
    </div>

    <!-- Notification Settings -->
    <div class="card notif-card">
      <div class="notif-head">
        <div class="notif-title"><Bell :size="18" color="#2b7fff" /> 알림 설정</div>
        <p class="notif-sub">받고 싶은 알림 유형을 선택하세요</p>
      </div>
      <div class="notif-body">
        <div class="notif-row notif-row--master">
          <div>
            <div class="notif-name">전체 알림</div>
            <div class="notif-desc">모든 알림을 한번에 켜거나 끌 수 있습니다</div>
          </div>
          <label class="toggle">
            <input type="checkbox" :checked="notifications.all"
              @change="(e) => handleNotification('all', (e.target as HTMLInputElement).checked)" />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="notif-indent">
          <div class="notif-row">
            <div>
              <div class="notif-name">티켓 알림</div>
              <div class="notif-desc">티켓 배정, 답변 등록 시 알림</div>
            </div>
            <label class="toggle">
              <input type="checkbox" :checked="notifications.ticket"
                @change="(e) => handleNotification('ticket', (e.target as HTMLInputElement).checked)" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="notif-row">
            <div>
              <div class="notif-name">게시판 알림</div>
              <div class="notif-desc">워키 게시판 답변 채택 시 알림</div>
            </div>
            <label class="toggle">
              <input type="checkbox" :checked="notifications.board"
                @change="(e) => handleNotification('board', (e.target as HTMLInputElement).checked)" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="notif-row">
            <div>
              <div class="notif-name">매뉴얼 알림</div>
              <div class="notif-desc">새 매뉴얼 등록 및 업데이트 시 알림</div>
            </div>
            <label class="toggle">
              <input type="checkbox" :checked="notifications.manual"
                @change="(e) => handleNotification('manual', (e.target as HTMLInputElement).checked)" />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- ESG 현황 -->
    <section class="esg-section">
      <h2 class="esg-heading"><Leaf :size="22" color="#00a63e" /> ESG 현황</h2>

      <!-- Current level -->
      <div class="card esg-cur" :class="`esg-bg-${currentLevel.level}`">
        <div class="esg-cur-emoji">{{ currentLevel.emoji }}</div>
        <div class="esg-cur-info">
          <div>
            <span class="badge solid-blue" style="margin-bottom: 8px; display: inline-flex;">LV {{ currentLevel.level }}</span>
            <h3 class="esg-cur-name">{{ currentLevel.name }}</h3>
            <p class="esg-cur-desc">{{ currentLevel.description }}</p>
          </div>
          <div class="esg-score-wrap">
            <div class="esg-score-row">
              <span class="esg-score-label">ESG 점수</span>
              <span class="esg-score-val">{{ esgScore.toLocaleString() }}P</span>
            </div>
            <template v-if="!isMaxLevel">
              <div class="bar-wrap bar-wrap--white">
                <div class="bar-fill bar-fill--plain" :style="{ width: `${levelProgress}%` }"></div>
              </div>
              <div class="esg-score-range">
                <span>현재: {{ esgScore.toLocaleString() }}P</span>
                <span>다음 레벨: {{ currentLevel.maxPoints.toLocaleString() }}P</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Level progression -->
      <div class="card lp-card">
        <div class="lp-head">
          <div class="lp-title">레벨 진행 과정</div>
          <div class="lp-sub">ESG 레벨별 북극곰의 성장 과정</div>
        </div>
        <div class="lp-list">
          <div
            v-for="lv in ESG_LEVELS"
            :key="lv.level"
            class="lp-item"
            :class="{
              'lp-item--current': lv.level === currentLevel.level,
              'lp-item--future': lv.level > currentLevel.level,
            }"
          >
            <span class="lp-emoji">{{ lv.emoji }}</span>
            <div class="lp-body">
              <div class="lp-meta">
                <span class="badge" :class="lv.level === currentLevel.level ? 'solid-blue' : 'gray'">LV {{ lv.level }}</span>
                <span class="lp-name">{{ lv.name }}</span>
                <Award v-if="lv.level < currentLevel.level" :size="14" color="#00a63e" />
              </div>
              <p class="lp-desc">{{ lv.description }}</p>
              <p class="lp-range">{{ lv.minPoints.toLocaleString() }}P ~ {{ lv.maxPoints === Infinity ? '∞' : `${lv.maxPoints.toLocaleString()}P` }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.mp-wrap { display: flex; flex-direction: column; gap: 16px; padding-bottom: 40px; }

/* ── Welcome ── */
.welcome-card {
  padding: 28px 32px; border-radius: 14px;
  background: linear-gradient(135deg, #1f2430 0%, #2b3650 100%);
  color: #fff;
}
.welcome-title {
  font-size: 22px; font-weight: 800; margin-bottom: 6px;
  display: flex; align-items: center; gap: 8px;
}
.welcome-sub { font-size: 14px; color: rgba(255,255,255,0.8); margin: 0; }

/* ── Stats ── */
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 16px; }
.stat-card--link {
  position: relative;
  border: 1px solid var(--line);
  width: 100%;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.stat-card--link:hover {
  border-color: #93c5fd;
  box-shadow: 0 6px 18px rgba(43,127,255,0.14);
  transform: translateY(-1px);
}
.stat-card--link:focus-visible {
  outline: 3px solid rgba(43,127,255,0.25);
  outline-offset: 2px;
}
.stat-link-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  color: #2b7fff;
  transition: transform 0.15s;
}
.stat-card--link:hover .stat-link-icon { transform: translateX(2px); }
.stat-val { font-size: 28px; font-weight: 800; }
.stat-lbl { font-size: 13px; color: #aeb2bb; }

/* ── Level progress ── */
.lv-card { padding: 20px 24px; }
.lv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.lv-name { font-size: 16px; font-weight: 700; }
.lv-pts { font-size: 13px; font-weight: 600; color: #717182; }
.bar-wrap { height: 8px; background: #eceef2; border-radius: 4px; overflow: hidden; }
.bar-wrap--white { height: 12px; background: rgba(255,255,255,0.4); border-radius: 6px; overflow: hidden; }
.bar-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, #7c3aed, #ec4899, #06b6d4);
  transition: width 0.4s ease;
}
.bar-fill--plain { background: #1d4ed8; }
.lv-hint { font-size: 12px; color: #aeb2bb; margin: 8px 0 0; }

/* ── Notification ── */
.notif-card { padding: 0; overflow: hidden; }
.notif-head { padding: 20px 24px 14px; border-bottom: 1px solid var(--line); }
.notif-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.notif-sub { font-size: 13px; color: #717182; margin: 0; }
.notif-body { padding: 16px 24px; }
.notif-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 10px; }
.notif-row--master { background: #f7f8fa; border: 1px solid var(--line); margin-bottom: 14px; }
.notif-indent { padding-left: 18px; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
.notif-indent .notif-row { border: 1px solid var(--line); }
.notif-name { font-size: 14px; font-weight: 600; color: #1f2430; margin-bottom: 2px; }
.notif-desc { font-size: 12.5px; color: #aeb2bb; }

/* ── Toggle switch ── */
.toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-track { position: absolute; inset: 0; border-radius: 12px; background: #d1d5db; transition: background 0.2s; }
.toggle-track::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle input:checked + .toggle-track { background: #2b7fff; }
.toggle input:checked + .toggle-track::after { transform: translateX(20px); }

/* ── ESG section ── */
.esg-section { border-top: 1px solid var(--line); padding-top: 24px; display: flex; flex-direction: column; gap: 16px; }
.esg-heading { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px; margin: 0; }

.esg-cur { display: flex; align-items: center; gap: 24px; padding: 24px; }
.esg-bg-1 { background: #dbeafe; border-color: #bfdbfe; }
.esg-bg-2 { background: #bfdbfe; border-color: #93c5fd; }
.esg-bg-3 { background: #93c5fd; border-color: #60a5fa; }
.esg-bg-4 { background: #60a5fa; border-color: #3b82f6; }
.esg-cur-emoji { font-size: 72px; line-height: 1; flex-shrink: 0; }
.esg-cur-info { flex: 1; display: flex; flex-direction: column; gap: 14px; }
.esg-cur-name { font-size: 20px; font-weight: 800; margin: 6px 0 4px; }
.esg-cur-desc { font-size: 13.5px; color: #374151; margin: 0; }
.esg-score-wrap { display: flex; flex-direction: column; gap: 8px; }
.esg-score-row { display: flex; align-items: center; justify-content: space-between; }
.esg-score-label { font-size: 13px; font-weight: 500; }
.esg-score-val { font-size: 18px; font-weight: 800; color: #1e3a5f; }
.esg-score-range { display: flex; justify-content: space-between; font-size: 11px; color: #374151; }

/* ── Level progression ── */
.lp-card { padding: 0; overflow: hidden; }
.lp-head { padding: 20px 24px 14px; border-bottom: 1px solid var(--line); }
.lp-title { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
.lp-sub { font-size: 12.5px; color: #aeb2bb; }
.lp-list { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
.lp-item {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px; border-radius: 10px; border: 1px solid var(--line);
  transition: opacity 0.2s;
}
.lp-item--current { background: #eff6ff; border-color: #93c5fd; }
.lp-item--future { opacity: 0.4; }
.lp-emoji { font-size: 36px; line-height: 1; flex-shrink: 0; }
.lp-body { flex: 1; }
.lp-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.lp-name { font-size: 14px; font-weight: 700; }
.lp-desc { font-size: 13px; color: #717182; margin: 0 0 4px; }
.lp-range { font-size: 11px; color: #aeb2bb; margin: 0; }
</style>
