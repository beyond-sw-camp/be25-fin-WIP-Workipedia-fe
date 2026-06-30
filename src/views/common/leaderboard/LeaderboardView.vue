<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trophy, TrendingUp, ChevronDown, RefreshCw } from '@lucide/vue'
import { getEsgLeaderboard } from '@/api/pointApi'
import type { EsgLeaderboardResponse } from '@/types/esg'

interface EnvironmentImpactView {
  savedWorkHours: number
  electricitySavedKwh: number
  co2SavedKg: number
  smartphoneChargeEquivalentCount: number
  minutesPerCitedAnswer: number
}

// GET /leaderboard → topRankers(상위 랭커 배열) + mySummary(로그인 사용자 순위)
const topRankers = ref<EsgLeaderboardResponse[]>([])
const myRank = ref<EsgLeaderboardResponse | null>(null)
const loading = ref(false)
const error = ref('')
const showFormula = ref(false)
const environmentImpact = ref<EnvironmentImpactView>({
  savedWorkHours: 0,
  electricitySavedKwh: 0,
  co2SavedKg: 0,
  smartphoneChargeEquivalentCount: 0,
  minutesPerCitedAnswer: 3,
})

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

// 전체 사용자 ESG 포인트 합산 (북극 회복도 카드용)
const totalEsgScore = ref(0)
const KWH_PER_HOUR = 0.08
const EMISSION_FACTOR = 0.478

const formatImpactNumber = (value: number, maximumFractionDigits = 3) =>
  value.toLocaleString(undefined, { maximumFractionDigits })

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getEsgLeaderboard()
    const impact = res.data.environmentImpact
    topRankers.value = res.data.topRankers ?? []
    myRank.value = res.data.mySummary ?? null
    totalEsgScore.value = res.data.totalEsgScore ?? 0
    environmentImpact.value = {
      savedWorkHours: impact?.savedWorkHours ?? 0,
      electricitySavedKwh: impact?.electricitySavedKwh ?? 0,
      co2SavedKg: impact?.co2SavedKg ?? 0,
      smartphoneChargeEquivalentCount: impact?.smartphoneChargeEquivalentCount ?? 0,
      minutesPerCitedAnswer: impact?.minutesPerCitedAnswer ?? 3,
    }
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

        <!-- 환경에 미친 영향 -->
        <div class="card env-card">
          <div class="env-head">
            <TrendingUp :size="17" color="#00a63e" />
            환경에 미친 영향
          </div>
          <p class="env-sub">주간 스냅샷 기준</p>
          <div class="env-grid">
            <div class="env-item env-item--sky">
              <div class="env-emoji">⏱</div>
              <div class="env-val" style="color:#0284c7;">
                {{ formatImpactNumber(environmentImpact.savedWorkHours, 1) }}시간
              </div>
              <div class="env-label">추정 업무 절감 시간</div>
            </div>
            <div class="env-item env-item--yellow">
              <div class="env-emoji">⚡</div>
              <div class="env-val" style="color:#d97706;">
                {{ formatImpactNumber(environmentImpact.electricitySavedKwh) }} kWh
              </div>
              <div class="env-label">추정 전력 절감 효과</div>
            </div>
            <div class="env-item env-item--green">
              <div class="env-emoji">🌿</div>
              <div class="env-val" style="color:#00a63e;">
                {{ formatImpactNumber(environmentImpact.co2SavedKg) }} kgCO₂e
              </div>
              <div class="env-label">추정 CO₂ 절감 효과</div>
            </div>
          </div>
          <div class="phone-equivalent">
            <div class="phone-equivalent-main">
              🌱 줄어든 탄소량은 스마트폰 약
              <strong>{{ environmentImpact.smartphoneChargeEquivalentCount.toLocaleString() }}회</strong>
              충전 시 발생하는 배출량과 같아요!
            </div>
            <div class="phone-equivalent-source">
              * 출처: U.S. EPA Greenhouse Gas Equivalencies Calculator
            </div>
          </div>
          <button class="formula-toggle" @click="showFormula = !showFormula">
            <ChevronDown :size="13" :style="{ transform: showFormula ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }" />
            계산 기준 보기
          </button>
          <div v-if="showFormula" class="formula-box">
            <div class="formula-title">📐 계산 기준</div>
            <p>
              Σ 날짜 d∈W Σ 사용자 u min(사용자 u의 d일 인용 포함 챗봇 답변 수 × {{ formatImpactNumber(environmentImpact.minutesPerCitedAnswer, 1) }}분, 37.8분) ÷ 60분 =
              <code>{{ formatImpactNumber(environmentImpact.savedWorkHours, 2) }}시간</code>
            </p>
            <p>
              추정 업무 절감 시간 <code>{{ formatImpactNumber(environmentImpact.savedWorkHours, 2) }}시간</code>
              × {{ KWH_PER_HOUR }}kW =
              <code>{{ formatImpactNumber(environmentImpact.electricitySavedKwh) }}kWh</code>
            </p>
            <p>
              추정 전력 절감 효과 <code>{{ formatImpactNumber(environmentImpact.electricitySavedKwh) }}kWh</code>
              × {{ EMISSION_FACTOR }}kgCO₂e/kWh =
              <code>{{ formatImpactNumber(environmentImpact.co2SavedKg) }}kgCO₂e</code>
            </p>
            <div class="formula-notes">
              <p>※ 답변 1건당 평균 {{ formatImpactNumber(environmentImpact.minutesPerCitedAnswer, 1) }}분의 정보 탐색 시간 절감 효과를 적용합니다.</p>
              <p>※ 사용자별 일일 최대 절감 시간은 McKinsey 연구에서 제시한 정보 탐색 시간 절감 효과 37.8분을 기준으로 제한합니다.</p>
              <p>※ 전력 절감 효과는 노트북 및 모니터 사용 환경을 기준으로 평균 소비전력 80W를 가정하여 산정합니다.</p>
              <p>※ CO₂ 절감 효과는 대한민국 전력 배출계수를 적용하여 산정합니다.</p>
            </div>
          </div>
        </div>

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
.phone-equivalent {
  padding: 12px 14px;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  background: #f0fdf4;
  color: #166534;
  font-size: 13px;
  line-height: 1.5;
}
.phone-equivalent-main { font-weight: 600; }
.phone-equivalent-source {
  margin-top: 2px;
  color: #6b7280;
  font-size: 11.5px;
}

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
.formula-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  color: #6b7280;
}
.formula-notes p { margin: 0; }

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
