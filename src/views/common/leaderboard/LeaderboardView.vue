<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trophy, TrendingUp, ChevronDown, RefreshCw } from '@lucide/vue'
import { getEsgLeaderboard } from '@/api/pointApi'
import type { EsgLeaderboardResponse } from '@/types/esg'

// GET /leaderboard → topRankers(상위 랭커 배열) + mySummary(로그인 사용자 순위)
const topRankers = ref<EsgLeaderboardResponse[]>([])
const myRank = ref<EsgLeaderboardResponse | null>(null)
const loading = ref(false)
const error = ref('')
const showFormula = ref(false)

// 1명 이상일 때만 포디엄 렌더. vue-tsc 배열 인덱스 타입 한계로 named property로 분리
const podiumEntries = computed(() => {
  const r = topRankers.value
  if (r.length === 0) return null
  return {
    first: r[0] as EsgLeaderboardResponse,
    second: r[1] as EsgLeaderboardResponse | undefined,
    third: r[2] as EsgLeaderboardResponse | undefined,
  }
})

// ESG 점수 1점 = 반복 질문 0.5건 절감으로 환산하여 절감 시간·전력·탄소 계산
const MINUTES_PER_QUESTION = 10
const KWH_PER_HOUR = 0.1
const EMISSION_FACTOR = 0.4781

// TODO: BE 환경 지표 API 연동 후 아래 계산 로직 복원
// const userEsgScore = computed(() => myRank.value?.esgScore ?? 0)
// const questionCount = computed(() => Math.floor(userEsgScore.value / 2))
// const savedHours = computed(() => (questionCount.value * MINUTES_PER_QUESTION) / 60)
// const savedKWh = computed(() => savedHours.value * KWH_PER_HOUR)
// const co2Saved = computed(() => savedKWh.value * EMISSION_FACTOR)
const questionCount = ref(0)
const savedHours = ref(0)
const savedKWh = ref(0)
const co2Saved = ref(0)

// 전체 사용자 ESG 포인트 합산 (북극 회복도 카드용)
const totalEsgScore = ref(0)

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getEsgLeaderboard()
    topRankers.value = res.data.topRankers ?? []
    myRank.value = res.data.mySummary ?? null
    totalEsgScore.value = res.data.totalEsgScore ?? 0
  } catch {
    error.value = '리더보드를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Trophy :size="28" color="#f5c000" />
        리더보드
      </h1>
      <p class="page-sub">조직의 지식 축적에 가장 크게 기여하고 있는 분들입니다.</p>
      <div class="update-notice">
        <RefreshCw :size="12" />
        매주 월요일 자정, 지난 주 활동 내역을 반영하여 리더보드가 새롭게 업데이트됩니다
      </div>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 300px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 300px;">{{ error }}</div>

    <template v-else>
      <div class="cards-stack">

        <!-- Top 3 포디엄: topRankers가 1명 이상일 때만 표시. 2·3위는 없을 수 있어 v-if로 보호 -->
        <div v-if="podiumEntries" class="card podium-card">
          <div class="podium">
            <!-- 2위 (왼쪽) -->
            <div v-if="podiumEntries.second" class="podium-item rank-2">
              <div class="chat-av podium-av">{{ podiumEntries.second.nickname.slice(0, 1) }}</div>
              <div class="podium-name">{{ podiumEntries.second.nickname }}</div>
              <div class="podium-dept">{{ podiumEntries.second.departmentName ?? '' }}</div>
              <span class="badge gray podium-grade">Lv.{{ podiumEntries.second.gradeId }} {{ podiumEntries.second.gradeName }}</span>
              <div class="podium-bar podium-bar--silver">
                <span class="podium-emoji">🥈</span>
                <span class="podium-rank-label">2위</span>
                <span class="podium-pts">{{ (podiumEntries.second.esgScore ?? 0).toLocaleString() }}점</span>
              </div>
            </div>

            <!-- 1위 (가운데) -->
            <div class="podium-item rank-1">
              <div class="chat-av podium-av podium-av--gold">{{ podiumEntries.first.nickname.slice(0, 1) }}</div>
              <div class="podium-name">{{ podiumEntries.first.nickname }}</div>
              <div class="podium-dept">{{ podiumEntries.first.departmentName ?? '' }}</div>
              <span class="badge podium-grade" style="background:#fef9c3;color:#a16207;border-color:#fde047;">Lv.{{ podiumEntries.first.gradeId }} {{ podiumEntries.first.gradeName }}</span>
              <div class="podium-bar podium-bar--gold">
                <span class="podium-emoji" style="font-size:2rem;">🏆</span>
                <span class="podium-rank-label" style="font-size:1.2rem;">1위</span>
                <span class="podium-pts">{{ (podiumEntries.first.esgScore ?? 0).toLocaleString() }}점</span>
              </div>
            </div>

            <!-- 3위 (오른쪽) -->
            <div v-if="podiumEntries.third" class="podium-item rank-3">
              <div class="chat-av podium-av">{{ podiumEntries.third.nickname.slice(0, 1) }}</div>
              <div class="podium-name">{{ podiumEntries.third.nickname }}</div>
              <div class="podium-dept">{{ podiumEntries.third.departmentName ?? '' }}</div>
              <span class="badge gray podium-grade">Lv.{{ podiumEntries.third.gradeId }} {{ podiumEntries.third.gradeName }}</span>
              <div class="podium-bar podium-bar--bronze">
                <span class="podium-emoji">🥉</span>
                <span class="podium-rank-label">3위</span>
                <span class="podium-pts">{{ (podiumEntries.third.esgScore ?? 0).toLocaleString() }}점</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 내 순위: mySummary가 null이면 빈 상태 메시지, 있으면 내 순위·점수·답변수 표시 -->
        <div class="card my-rank-card">
          <div class="my-rank-title">내 순위</div>
          <div v-if="myRank" class="my-rank-body">
            <div class="my-rank-left">
              <div class="my-rank-circle">{{ myRank?.rank }}</div>
              <div class="chat-av" style="width:42px;height:42px;font-size:15px;font-weight:700;">
                {{ myRank?.nickname?.slice(0, 1) }}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="my-rank-name">{{ myRank?.nickname }}</span>
                  <span class="badge gray" style="font-size:11px;padding:2px 8px;">Lv.{{ myRank?.gradeId }} {{ myRank?.gradeName }}</span>
                </div>
                <div class="my-rank-dept">{{ myRank?.departmentName ?? '' }}</div>
              </div>
            </div>
            <div class="my-rank-stats">
              <div class="my-stat">
                <div class="my-stat-val" style="color:#00a63e;">{{ myRank?.esgScore?.toLocaleString() }}점</div>
                <div class="my-stat-label">ESG 점수</div>
              </div>
              <div class="my-stat">
                <div class="my-stat-val">{{ myRank?.answerCount ?? 0 }}</div>
                <div class="my-stat-label">답변 수</div>
              </div>
              <div class="my-stat">
                <div class="my-stat-val">{{ myRank?.acceptedAnswerCount ?? 0 }}</div>
                <div class="my-stat-label">채택 수</div>
              </div>
            </div>
          </div>
          <div v-else class="my-rank-empty">아직 ESG 점수가 없습니다. 워키에서 답변을 달아보세요!</div>
        </div>

        <!--
        환경 영향: 내 ESG 점수 기반으로 절감 시간·전력·탄소를 공식으로 환산해 표시
        <div class="card env-card">
          <div class="env-head">
            <TrendingUp :size="17" color="#00a63e" />
            환경에 미친 영향
          </div>
          <p class="env-sub">당신의 지식 공유가 만든 환경적 가치</p>
          <div class="env-grid">
            <div class="env-item env-item--sky">
              <div class="env-emoji">⏱️</div>
              <div class="env-val" style="color:#0284c7;">{{ savedHours.toFixed(1) }}h</div>
              <div class="env-label">절감 업무 시간</div>
            </div>
            <div class="env-item env-item--yellow">
              <div class="env-emoji">⚡</div>
              <div class="env-val" style="color:#d97706;">{{ savedKWh.toFixed(2) }}kWh</div>
              <div class="env-label">전기 절감량</div>
            </div>
            <div class="env-item env-item--green">
              <div class="env-emoji">🌿</div>
              <div class="env-val" style="color:#00a63e;">{{ co2Saved.toFixed(2) }}kg</div>
              <div class="env-label">CO₂ 절감량</div>
            </div>
          </div>
          <button class="formula-toggle" @click="showFormula = !showFormula">
            <ChevronDown :size="13" :style="{ transform: showFormula ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }" />
            계산 기준 보기
          </button>
          <div v-if="showFormula" class="formula-box">
            <div class="formula-title">📐 계산 기준</div>
            <p>반복 질문 감소 건수 <code>{{ questionCount }}건</code> × 1건당 절감 {{ MINUTES_PER_QUESTION }}분 ÷ 60 = <code>{{ savedHours.toFixed(2) }}h</code></p>
            <p>절감 시간 <code>{{ savedHours.toFixed(2) }}h</code> × 전력 {{ KWH_PER_HOUR }}kWh/h = <code>{{ savedKWh.toFixed(3) }}kWh</code></p>
            <p>전기 절감 <code>{{ savedKWh.toFixed(3) }}kWh</code> × 배출계수 {{ EMISSION_FACTOR }} = <code>{{ co2Saved.toFixed(3) }}kgCO₂eq</code></p>
          </div>
        </div>
        -->

        <!-- 북극 회복도: topRankers ESG 합산 → 플랫폼 전체 기여 수치 표시 -->
        <div class="card arctic-card">
          <div class="arctic-head">북극 환경 회복도</div>
          <p class="arctic-sub">워키 커뮤니티 전체의 ESG 활동으로 북극이 건강해지고 있습니다</p>
          <div class="arctic-body">
            <div class="arctic-globe">🌍</div>
            <div class="arctic-text">
              <h3 class="arctic-title">북극이 더 건강해지고 있어요!</h3>
              <p class="arctic-desc">
                전체 사용자들의 ESG 점수: <strong style="color:#00a63e;">{{ totalEsgScore.toLocaleString() }}점</strong>
              </p>
            </div>
          </div>
        </div>

      </div><!-- /cards-stack -->
    </template>
  </div>
</template>

<style scoped>
/* ── 카드 간격 ────────────────────────────────────────────── */
.cards-stack { display: flex; flex-direction: column; gap: 16px; }

/* ── 업데이트 안내 ──────────────────────────────────────── */
.update-notice {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 5px 12px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 99px;
  font-size: 12px;
  color: #0369a1;
}

/* ── 포디엄 ──────────────────────────────────────────────── */
.podium-card { padding: 32px 24px 0; }
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
}
.podium-item { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
.rank-1 { order: 2; }
.rank-2 { order: 1; }
.rank-3 { order: 3; }

.podium-av { width: 52px; height: 52px; font-size: 17px; font-weight: 800; }
.podium-av--gold { box-shadow: 0 0 0 3px #f5c000; }
.podium-name { font-size: 13.5px; font-weight: 700; color: #1f2430; text-align: center; }
.podium-dept { font-size: 11.5px; color: #aeb2bb; text-align: center; }
.podium-grade { font-size: 11px; margin-bottom: 4px; }

.podium-bar {
  width: 100%;
  border-radius: 8px 8px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 14px;
  gap: 3px;
}
.podium-bar--gold   { height: 220px; background: linear-gradient(to bottom, #fde68a, #f59e0b); box-shadow: 0 4px 16px rgba(245,200,0,0.25); }
.podium-bar--silver { height: 170px; background: linear-gradient(to bottom, #e2e8f0, #94a3b8); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.podium-bar--bronze { height: 135px; background: linear-gradient(to bottom, #fed7aa, #f97316); box-shadow: 0 4px 12px rgba(249,115,22,0.2); }

.podium-emoji { font-size: 1.5rem; line-height: 1; }
.podium-rank-label { font-size: 1rem; font-weight: 800; color: #fff; }
.podium-pts { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.9); }

/* ── 내 순위 ─────────────────────────────────────────────── */
.my-rank-card { padding: 20px 24px; border-color: #2b7fff; }
.my-rank-title { font-size: 14px; font-weight: 700; color: #1f2430; margin-bottom: 14px; }
.my-rank-body { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.my-rank-left { display: flex; align-items: center; gap: 12px; }
.my-rank-circle {
  width: 46px; height: 46px; border-radius: 50%;
  background: #2b7fff; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 800; flex-shrink: 0;
}
.my-rank-name { font-size: 15px; font-weight: 700; color: #1f2430; }
.my-rank-dept { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }
.my-rank-empty { font-size: 13.5px; color: #aeb2bb; padding: 12px 0 4px; }
.my-rank-stats { display: flex; gap: 28px; }
.my-stat { text-align: center; }
.my-stat-val { font-size: 20px; font-weight: 800; color: #1f2430; }
.my-stat-label { font-size: 11.5px; color: #aeb2bb; margin-top: 2px; }

/* ── 환경 영향 ────────────────────────────────────────────── */
.env-card { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }
.env-head { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #1f2430; }
.env-sub { font-size: 13px; color: #aeb2bb; margin: -8px 0 0; }
.env-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.env-item {
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 12px; border-radius: 12px; border: 1px solid var(--line);
  gap: 6px;
}
.env-item--sky    { background: #f0f9ff; }
.env-item--yellow { background: #fffbeb; }
.env-item--green  { background: #f0fdf4; }
.env-emoji { font-size: 1.8rem; line-height: 1; }
.env-val { font-size: 1.5rem; font-weight: 800; }
.env-label { font-size: 12px; color: #6b7280; }

.formula-toggle {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: #aeb2bb; padding: 0;
  transition: color 0.15s;
}
.formula-toggle:hover { color: #6b7280; }

.formula-box {
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 10px; padding: 14px 16px;
  font-size: 12px; color: #6b7280;
  display: flex; flex-direction: column; gap: 6px;
}
.formula-title { font-size: 13px; font-weight: 700; color: #1f2430; margin-bottom: 2px; }
.formula-box code {
  font-family: 'Courier New', monospace; font-size: 11.5px;
  background: #e2e8f0; border-radius: 4px; padding: 1px 5px; color: #374151;
}

/* ── 북극 회복도 ──────────────────────────────────────────── */
.arctic-card { padding: 24px 28px; }
.arctic-head { font-size: 15px; font-weight: 700; color: #1f2430; margin-bottom: 4px; }
.arctic-sub { font-size: 13px; color: #aeb2bb; margin-bottom: 20px; }
.arctic-body { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px 0 8px; }
.arctic-globe { font-size: 5rem; line-height: 1; }
.arctic-text { text-align: center; display: flex; flex-direction: column; gap: 8px; }
.arctic-title { font-size: 18px; font-weight: 800; color: #1f2430; }
.arctic-desc { font-size: 13.5px; color: #6b7280; }
</style>
