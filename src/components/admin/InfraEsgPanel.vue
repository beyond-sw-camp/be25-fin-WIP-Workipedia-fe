<script setup lang="ts">
// 인프라 ESG(CloudWatch 기반) 대시보드 패널.
// 시스템 대시보드에서 추천(RECOMMENDED) 항목 전체의
// 탄소 절감 추정치를 합산해 보여준다. 데이터는 GET /admin/esg/infra 단일 호출.
import { ref, onMounted } from 'vue'
import { getInfraEsgSummary } from '@/api/infraEsgApi'
import type {
  InfraEsgSummary,
  OptimizationType,
  RecommendationStatus,
} from '@/api/infraEsgApi'

const loading = ref(true)
const error = ref('')
const data = ref<InfraEsgSummary | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getInfraEsgSummary()
    data.value = res.data
  } catch {
    error.value = '인프라 ESG 정보를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

// 실시간 누적 카운터용 시계. 100ms마다 갱신해 누적값이 째깍째깍 올라가게 한다.
const now = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  load()
  tickTimer = setInterval(() => {
    now.value = Date.now()
  }, 100)
})
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

const HOURS_PER_YEAR = 24 * 365

// BE가 준 누적 스냅샷(computedAtEpochMs) 이후 흐른 시간(h). 누적값 자체는 각 리소스의
// 실제 가동 시작 시각(EC2 launchTime / ASG createdTime / RDS createTime)부터 BE가 합산했고,
// FE는 그 스냅샷에 시간당 비율을 곱해 이어서 라이브로 틱한다(캐시 60분과 무관하게 정확).
const hoursSinceComputed = computed(() => {
  if (!data.value) return 0
  return Math.max(0, (now.value - data.value.computedAtEpochMs) / 3_600_000)
})

// ── 표시 매핑 ─────────────────────────────────────────────────
const OPTIMIZATION_LABEL: Record<OptimizationType, string> = {
  INSTANCE_DOWNSIZE: '인스턴스 다운사이징',
  ASG_SCALE_IN: 'ASG 용량 조정',
  ASG_MEMBER: 'ASG 구성원',
  RDS_DOWNSIZE: 'DB 다운사이징',
  KEEP: '인스턴스 유지',
}
const STATUS_META: Record<RecommendationStatus, { label: string; cls: string }> = {
  RECOMMENDED: { label: '권장', cls: 'recommended' },
  WATCH: { label: '관찰', cls: 'watch' },
  KEEP: { label: '유지', cls: 'keep' },
}

function g(value: number): string {
  return `${value.toFixed(2)}gCO₂e/h`
}
// 시간당 배출/절감(g/h)의 1년 예상 누적 kg (= 시간당 × 8760h). 참고치로 표시.
function kgYear(gPerHour: number): string {
  return ((gPerHour * HOURS_PER_YEAR) / 1000).toFixed(2)
}
// 시간당 스마트폰 충전 환산(회/h)의 1년 예상 누적 횟수.
function chargeYear(chargePerHour: number): string {
  return (chargePerHour * HOURS_PER_YEAR).toFixed(0)
}
// 누적 스냅샷(kg) + 시간당 배출/절감(g/h) × 스냅샷 이후 경과시간 = 실시간 누적 kg.
function liveKg(accumKg: number, gPerHour: number): string {
  return (accumKg + (gPerHour / 1000) * hoursSinceComputed.value).toFixed(6)
}
// 누적 충전 횟수 스냅샷 + 시간당 충전 환산(회/h) × 경과시간 = 실시간 누적 충전 횟수.
function liveCharge(accumCharge: number, chargePerHour: number): string {
  return (accumCharge + chargePerHour * hoursSinceComputed.value).toFixed(4)
}
function actionLabel(action: string): string {
  return action === 'OPTIMIZE' ? 'Optimize' : 'Keep'
}
</script>

<template>
  <div class="card infra-esg">
    <div class="ie-head">
      <div>
        <h3 class="ie-title">인프라 효율 분석 및 통합 탄소 절감 추정</h3>
        <p class="ie-sub">
          CloudWatch 운영 메트릭을 기반으로 효율화 가능한 리소스를 표시하고, 추천 항목 전체를
          적용했을 때의 총 탄소 절감 효과를 계산합니다.
        </p>
      </div>
      <span class="ie-kicker">CloudWatch 기반 ESG 확장</span>
    </div>

    <div v-if="loading" class="empty-ph" style="height:140px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height:140px;color:#e03131;">{{ error }}</div>

    <template v-else-if="data">
      <!-- 요약 카드 -->
      <div class="ie-summary-grid">
        <div class="ie-summary-card">
          <div class="ie-summary-label">분석 대상 그룹</div>
          <div class="ie-summary-value dark">{{ data.summary.targetResourceCount }}개</div>
        </div>
        <div class="ie-summary-card">
          <div class="ie-summary-label">추천 항목 수</div>
          <div class="ie-summary-value orange">{{ data.summary.recommendedResourceCount }}개</div>
          <div class="ie-summary-sub">RECOMMENDED 기준</div>
        </div>
        <div class="ie-summary-card">
          <div class="ie-summary-label">권장 조치</div>
          <div class="ie-summary-value green">{{ actionLabel(data.summary.recommendedAction) }}</div>
        </div>
        <div class="ie-summary-card">
          <div class="ie-summary-label">총 예상 CO₂ 절감</div>
          <div class="ie-summary-value green">
            {{ data.summary.totalEstimatedCarbonSavingGPerHour.toFixed(2) }}<small>g/h</small>
          </div>
        </div>
      </div>

      <!-- 리소스별 권장 사항 -->
      <div class="ie-table-wrap">
        <table class="ie-table">
          <thead>
            <tr>
              <th rowspan="2">리소스</th>
              <th rowspan="2">역할</th>
              <th rowspan="2">최적화 방식</th>
              <th rowspan="2">현재 구성</th>
              <th rowspan="2">권장 구성</th>
              <th colspan="2" class="ie-th-cpu">CPU <span class="ie-th-sub">최근 24시간</span></th>
              <th rowspan="2">권장 사항</th>
              <th rowspan="2">예상 절감</th>
              <th rowspan="2">상태</th>
            </tr>
            <tr>
              <th>평균 CPU</th>
              <th>최대 CPU</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.resources" :key="r.resourceName">
              <td>{{ r.resourceName }}</td>
              <td>{{ r.role }}</td>
              <td>{{ OPTIMIZATION_LABEL[r.optimizationType] }}</td>
              <td>{{ r.currentConfiguration }}</td>
              <td>{{ r.recommendedConfiguration }}</td>
              <td>{{ r.averageCpu }}%</td>
              <td>{{ r.maxCpu }}%</td>
              <td>{{ r.recommendation }}</td>
              <td>{{ r.status === 'RECOMMENDED' ? g(r.estimatedCarbonSavingGPerHour) : '-' }}</td>
              <td>
                <span class="ie-status" :class="STATUS_META[r.status].cls">
                  {{ STATUS_META[r.status].label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 추천 항목 전체 최적화 효과 -->
      <div class="ie-impact-cards">
        <div class="ie-impact blue">
          <div class="ie-impact-top">CURRENT</div>
          <div class="ie-impact-value live">
            {{ liveKg(data.totalCarbonComparison.currentEstimatedCarbonAccumKg, data.totalCarbonComparison.currentEstimatedCarbonGPerHour) }} <small>kgCO₂e</small>
          </div>
          <div class="ie-impact-rate">
            시간당 {{ data.totalCarbonComparison.currentEstimatedCarbonGPerHour.toFixed(2) }}gCO₂e ·
            연 예상 {{ kgYear(data.totalCarbonComparison.currentEstimatedCarbonGPerHour) }}kg
          </div>
          <div class="ie-impact-label">현재 구성 배출 (가동 시작부터 누적)</div>
        </div>
        <div class="ie-impact yellow">
          <div class="ie-impact-top">RECOMMENDED</div>
          <div class="ie-impact-value live">
            {{ liveKg(data.totalCarbonComparison.recommendedEstimatedCarbonAccumKg, data.totalCarbonComparison.recommendedEstimatedCarbonGPerHour) }} <small>kgCO₂e</small>
          </div>
          <div class="ie-impact-rate">
            시간당 {{ data.totalCarbonComparison.recommendedEstimatedCarbonGPerHour.toFixed(2) }}gCO₂e ·
            연 예상 {{ kgYear(data.totalCarbonComparison.recommendedEstimatedCarbonGPerHour) }}kg
          </div>
          <div class="ie-impact-label">권장 구성 배출 (가동 시작부터 누적)</div>
        </div>
        <div class="ie-impact green">
          <div class="ie-impact-top">SAVING</div>
          <div class="ie-impact-value live">
            {{ liveKg(data.totalCarbonComparison.estimatedCarbonSavingAccumKg, data.totalCarbonComparison.estimatedCarbonSavingGPerHour) }} <small>kgCO₂e</small>
          </div>
          <div class="ie-impact-rate">
            시간당 {{ data.totalCarbonComparison.estimatedCarbonSavingGPerHour.toFixed(2) }}gCO₂e ·
            연 예상 {{ kgYear(data.totalCarbonComparison.estimatedCarbonSavingGPerHour) }}kg
          </div>
          <div class="ie-impact-label">총 CO₂ 절감 (가동 시작부터 누적)</div>
        </div>
      </div>

      <!-- 환산 -->
      <div class="ie-equivalent">
        <div class="ie-equivalent-main" v-if="data.equivalent">
          추천된 인프라 최적화 항목을 모두 적용하면 스마트폰 충전 기준으로
          시간당 약 <strong>{{ data.equivalent.smartphoneChargePerHour }}회</strong>,
          24시간 기준 약 <strong>{{ data.equivalent.smartphoneChargePerDay }}회</strong>,
          30일 기준 약 <strong>{{ data.equivalent.smartphoneChargePerMonth }}회</strong> 충전 시
          발생하는 배출량과 같은 탄소를 줄일 수 있어요.
        </div>
        <div class="ie-equivalent-sub">
          * 실시간 누적(각 리소스 실제 가동 시작 기준) · 시간당 약 {{ data.equivalent.smartphoneChargePerHour }}회 ·
          연 예상 약 {{ chargeYear(data.equivalent.smartphoneChargePerHour) }}회
          ({{ kgYear(data.totalCarbonComparison.estimatedCarbonSavingGPerHour) }}kgCO₂e/year)
        </div>
      </div>

      <!-- 계산 기준 -->
      <details class="ie-calc">
        <summary>인프라 계산 기준 보기</summary>
        <div class="ie-calc-body">
          <p>
            전력 배출계수 <b>{{ data.calculation.emissionFactorKgPerKwh }}kgCO₂e/kWh</b>,
            AWS PUE <b>{{ data.calculation.awsPue }}</b>,
            메모리 에너지 <b>{{ data.calculation.memoryEnergyKwhPerGbHour }}kWh/GB·h</b>
          </p>
          <p class="ie-note">
            ※ 본 수치는 실제 전력 계측값이 아니라 CloudWatch 운영 메트릭, 인스턴스 타입 정보,
            Cloud Carbon Footprint 공개 계수, 대한민국 전력 배출계수를 기반으로 계산한 추정치입니다.
            ({{ data.calculation.measurementType }})
          </p>
          <p class="ie-note">
            ※ 실제 인스턴스 타입 변경 또는 ASG desired capacity 변경은 자동으로 수행하지 않고,
            관리자가 검토 후 적용하는 방식으로 설계합니다.
          </p>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.infra-esg { margin: 16px 0 8px; padding: 16px 34px; }

.ie-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.ie-title { font-size: 17px; font-weight: 800; color: #1f2937; margin: 0; }
.ie-sub { font-size: 12px; color: #94a3b8; margin: 5px 0 0; line-height: 1.45; word-break: keep-all; }
.ie-kicker {
  flex-shrink: 0;
  display: inline-flex; align-items: center;
  padding: 5px 10px; border-radius: 999px;
  background: #e8f7ef; color: #15803d; font-size: 11px; font-weight: 800; white-space: nowrap;
}

/* 요약 카드 */
.ie-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.ie-summary-card { border: 1px solid var(--line, #e5e9f2); border-radius: 10px; padding: 14px 16px; background: #fff; }
.ie-summary-label { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
.ie-summary-value { font-size: 24px; font-weight: 800; line-height: 1.05; }
.ie-summary-value small { font-size: 13px; font-weight: 700; margin-left: 2px; }
.ie-summary-value.dark { color: #1f2937; }
.ie-summary-value.orange { color: #d97706; }
.ie-summary-value.green { color: #159653; }
.ie-summary-sub { margin-top: 6px; color: #94a3b8; font-size: 11px; }

/* 테이블 */
.ie-table-wrap { overflow-x: auto; border: 1px solid var(--line, #e5e9f2); border-radius: 10px; margin-bottom: 16px; }
.ie-table { width: 100%; min-width: 980px; border-collapse: collapse; }
.ie-table thead th {
  background: #f8fafc; border-bottom: 1px solid var(--line, #e5e9f2);
  padding: 9px 12px; color: #64748b; font-size: 11px; font-weight: 800; text-align: left; white-space: nowrap;
}
.ie-table thead th.ie-th-cpu { text-align: center; }
.ie-table thead th.ie-th-cpu .ie-th-sub {
  margin-left: 4px; color: #94a3b8; font-size: 10px; font-weight: 600;
}
.ie-table tbody td {
  border-bottom: 1px solid #edf1f7; padding: 11px 12px; color: #293243; font-size: 12px; white-space: nowrap;
}
.ie-table tbody tr:last-child td { border-bottom: none; }
.ie-status {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
}
.ie-status.recommended { background: #dff8e7; color: #15803d; }
.ie-status.keep { background: #e8edf5; color: #5f6f86; }
.ie-status.watch { background: #fef3c7; color: #b45309; }

/* 임팩트 카드 */
.ie-impact-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
.ie-impact { border: 1px solid #d7dee9; border-radius: 10px; padding: 16px; text-align: center; }
.ie-impact.blue { background: #eef8ff; }
.ie-impact.yellow { background: #fff8e8; }
.ie-impact.green { background: #eefaf3; }
.ie-impact-top { font-size: 11px; letter-spacing: 0.1em; font-weight: 800; color: #8a99b0; margin-bottom: 8px; }
.ie-impact-value { font-size: 22px; font-weight: 800; }
.ie-impact-value small { font-size: 12px; font-weight: 700; margin-left: 2px; }
.ie-impact-value.live { font-variant-numeric: tabular-nums; }
.ie-equivalent-main strong.live { font-variant-numeric: tabular-nums; }
.ie-impact.blue .ie-impact-value { color: #1582d6; }
.ie-impact.yellow .ie-impact-value { color: #d97706; }
.ie-impact.green .ie-impact-value { color: #159653; }
.ie-impact-rate { margin-top: 5px; color: #94a3b8; font-size: 11px; font-weight: 600; }
.ie-impact-label { margin-top: 6px; color: #6b7c97; font-size: 12px; font-weight: 600; }

/* 환산 */
.ie-equivalent { border: 1px solid #8ce3a8; background: #f0faf3; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
.ie-equivalent-main { color: #15803d; font-size: 12.5px; line-height: 1.55; font-weight: 500; word-break: keep-all; }
.ie-equivalent-main strong { font-weight: 800; }
.ie-equivalent-sub { margin-top: 6px; color: #6b7c97; font-size: 11px; }

/* 계산 기준 */
.ie-calc summary { cursor: pointer; color: #94a3b8; font-size: 12px; font-weight: 700; user-select: none; }
.ie-calc-body { margin-top: 10px; background: #fafcff; border: 1px solid #dfe6f1; border-radius: 10px; padding: 14px 16px; }
.ie-calc-body p { margin: 0 0 6px; font-size: 12px; color: #53657f; line-height: 1.6; }
.ie-note { color: #6b7c97; font-size: 11px; word-break: keep-all; }

@media (max-width: 1100px) {
  .ie-summary-grid, .ie-impact-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .ie-summary-grid, .ie-impact-cards { grid-template-columns: 1fr; }
}
</style>
