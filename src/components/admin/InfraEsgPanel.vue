<script setup lang="ts">
// 인프라 ESG(CloudWatch 기반) 대시보드 패널.
// 시스템 대시보드의 공통 접수 큐 아래에 배치되어, 추천(RECOMMENDED) 항목 전체의
// 탄소 절감 추정치를 합산해 보여준다. 데이터는 GET /admin/esg/infra 단일 호출.
import { ref, computed, onMounted } from 'vue'
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

onMounted(load)

// ── 표시 매핑 ─────────────────────────────────────────────────
const OPTIMIZATION_LABEL: Record<OptimizationType, string> = {
  INSTANCE_DOWNSIZE: '인스턴스 다운사이징',
  ASG_SCALE_IN: 'ASG 용량 조정',
  ASG_MEMBER: 'ASG 구성원',
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
function actionLabel(action: string): string {
  return action === 'OPTIMIZE' ? 'Optimize' : 'Keep'
}

const equivalentText = computed(() => {
  const e = data.value?.equivalent
  if (!e) return ''
  return `추천된 인프라 최적화 항목을 모두 적용하면 스마트폰 충전 기준으로 시간당 약 ${e.smartphoneChargePerHour}회, `
    + `24시간 기준 약 ${e.smartphoneChargePerDay}회, 30일 기준 약 ${e.smartphoneChargePerMonth}회 충전 시 `
    + `발생하는 배출량과 같은 탄소를 줄일 수 있어요.`
})
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
          <div class="ie-summary-label">분석 대상 리소스</div>
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
              <th>리소스</th>
              <th>역할</th>
              <th>최적화 방식</th>
              <th>현재 구성</th>
              <th>권장 구성</th>
              <th>평균 CPU</th>
              <th>권장 사항</th>
              <th>예상 절감</th>
              <th>상태</th>
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
          <div class="ie-impact-value">
            {{ data.totalCarbonComparison.currentEstimatedCarbonGPerHour.toFixed(2) }} gCO₂e/h
          </div>
          <div class="ie-impact-label">현재 구성 총 배출 추정치</div>
        </div>
        <div class="ie-impact yellow">
          <div class="ie-impact-top">RECOMMENDED</div>
          <div class="ie-impact-value">
            {{ data.totalCarbonComparison.recommendedEstimatedCarbonGPerHour.toFixed(2) }} gCO₂e/h
          </div>
          <div class="ie-impact-label">권장 구성 총 배출 추정치</div>
        </div>
        <div class="ie-impact green">
          <div class="ie-impact-top">SAVING</div>
          <div class="ie-impact-value">
            {{ data.totalCarbonComparison.estimatedCarbonSavingGPerHour.toFixed(2) }} gCO₂e/h
          </div>
          <div class="ie-impact-label">총 시간당 CO₂ 절감 추정치</div>
        </div>
      </div>

      <!-- 환산 -->
      <div class="ie-equivalent">
        <div class="ie-equivalent-main">{{ equivalentText }}</div>
        <div class="ie-equivalent-sub">
          * 24시간 누적 {{ data.totalCarbonComparison.estimatedCarbonSavingGPerDay.toFixed(1) }}gCO₂e/day,
          30일 누적 {{ data.totalCarbonComparison.estimatedCarbonSavingKgPerMonth.toFixed(2) }}kgCO₂e/month
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
.infra-esg { margin-top: 20px; }

.ie-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.ie-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #1f2937; margin: 0; }
.ie-sub { font-size: 13px; color: #94a3b8; margin: 6px 0 0; line-height: 1.6; word-break: keep-all; }
.ie-kicker {
  flex-shrink: 0;
  display: inline-flex; align-items: center;
  padding: 6px 14px; border-radius: 999px;
  background: #e8f7ef; color: #15803d; font-size: 12px; font-weight: 800; white-space: nowrap;
}

/* 요약 카드 */
.ie-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
.ie-summary-card { border: 1px solid var(--line, #e5e9f2); border-radius: 14px; padding: 18px 20px; background: #fff; }
.ie-summary-label { font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 10px; }
.ie-summary-value { font-size: 28px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; }
.ie-summary-value small { font-size: 15px; font-weight: 700; margin-left: 2px; }
.ie-summary-value.dark { color: #1f2937; }
.ie-summary-value.orange { color: #d97706; }
.ie-summary-value.green { color: #159653; }
.ie-summary-sub { margin-top: 8px; color: #94a3b8; font-size: 12px; }

/* 테이블 */
.ie-table-wrap { overflow-x: auto; border: 1px solid var(--line, #e5e9f2); border-radius: 14px; margin-bottom: 22px; }
.ie-table { width: 100%; min-width: 980px; border-collapse: collapse; }
.ie-table thead th {
  background: #f8fafc; border-bottom: 1px solid var(--line, #e5e9f2);
  padding: 12px 14px; color: #64748b; font-size: 12px; font-weight: 800; text-align: left; white-space: nowrap;
}
.ie-table tbody td {
  border-bottom: 1px solid #edf1f7; padding: 14px; color: #293243; font-size: 13px; white-space: nowrap;
}
.ie-table tbody tr:last-child td { border-bottom: none; }
.ie-status {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800;
}
.ie-status.recommended { background: #dff8e7; color: #15803d; }
.ie-status.keep { background: #e8edf5; color: #5f6f86; }
.ie-status.watch { background: #fef3c7; color: #b45309; }

/* 임팩트 카드 */
.ie-impact-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
.ie-impact { border: 1px solid #d7dee9; border-radius: 14px; padding: 20px; text-align: center; }
.ie-impact.blue { background: #eef8ff; }
.ie-impact.yellow { background: #fff8e8; }
.ie-impact.green { background: #eefaf3; }
.ie-impact-top { font-size: 12px; letter-spacing: 0.1em; font-weight: 800; color: #8a99b0; margin-bottom: 10px; }
.ie-impact-value { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.ie-impact.blue .ie-impact-value { color: #1582d6; }
.ie-impact.yellow .ie-impact-value { color: #d97706; }
.ie-impact.green .ie-impact-value { color: #159653; }
.ie-impact-label { margin-top: 10px; color: #6b7c97; font-size: 13px; font-weight: 600; }

/* 환산 */
.ie-equivalent { border: 2px solid #8ce3a8; background: #f0faf3; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.ie-equivalent-main { color: #15803d; font-size: 14px; line-height: 1.7; font-weight: 700; word-break: keep-all; }
.ie-equivalent-sub { margin-top: 8px; color: #6b7c97; font-size: 12px; }

/* 계산 기준 */
.ie-calc summary { cursor: pointer; color: #94a3b8; font-size: 13px; font-weight: 700; user-select: none; }
.ie-calc-body { margin-top: 14px; background: #fafcff; border: 1px solid #dfe6f1; border-radius: 14px; padding: 18px 20px; }
.ie-calc-body p { margin: 0 0 8px; font-size: 13px; color: #53657f; line-height: 1.7; }
.ie-note { color: #6b7c97; font-size: 12px; word-break: keep-all; }

@media (max-width: 1100px) {
  .ie-summary-grid, .ie-impact-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .ie-summary-grid, .ie-impact-cards { grid-template-columns: 1fr; }
}
</style>
