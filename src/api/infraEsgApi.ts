import http from './index'

// 인프라 ESG(CloudWatch 기반) 대시보드 API
// BE: GET /api/v1/admin/esg/infra (SYSTEM_ADMIN, ResponseEntity<T> 직접 반환)

export type RecommendationStatus = 'RECOMMENDED' | 'WATCH' | 'KEEP'
export type OptimizationType =
  | 'INSTANCE_DOWNSIZE'
  | 'ASG_SCALE_IN'
  | 'ASG_MEMBER'
  | 'RDS_DOWNSIZE'
  | 'KEEP'

export interface InfraSummary {
  targetResourceCount: number
  recommendedResourceCount: number
  /** OPTIMIZE | KEEP */
  recommendedAction: string
  totalEstimatedCarbonSavingGPerHour: number
}

export interface ResourceRecommendation {
  resourceName: string
  role: string
  optimizationType: OptimizationType
  currentConfiguration: string
  recommendedConfiguration: string
  averageCpu: number
  maxCpu: number
  currentEstimatedCarbonGPerHour: number
  recommendedEstimatedCarbonGPerHour: number
  estimatedCarbonSavingGPerHour: number
  recommendation: string
  status: RecommendationStatus
}

export interface TotalCarbonComparison {
  currentEstimatedCarbonGPerHour: number
  recommendedEstimatedCarbonGPerHour: number
  estimatedCarbonSavingGPerHour: number
  estimatedCarbonSavingGPerDay: number
  estimatedCarbonSavingKgPerMonth: number
  /** 각 리소스 실제 가동 시작부터 computedAt까지 합산한 실시간 누적 kg(베이스라인). */
  currentEstimatedCarbonAccumKg: number
  recommendedEstimatedCarbonAccumKg: number
  estimatedCarbonSavingAccumKg: number
}

export interface Equivalent {
  smartphoneChargePerHour: number
  smartphoneChargePerDay: number
  smartphoneChargePerMonth: number
  /** 절감분 실시간 누적 스마트폰 충전 횟수(베이스라인). */
  smartphoneChargeAccum: number
}

export interface Calculation {
  emissionFactorKgPerKwh: number
  awsPue: number
  memoryEnergyKwhPerGbHour: number
  measurementType: string
  methodology: string
}

export interface InfraEsgSummary {
  period: string
  /** 누적값 기준 시각(epoch millis). FE는 (누적 + 시간당비율 × (now − computedAt))로 라이브 틱. */
  computedAtEpochMs: number
  summary: InfraSummary
  resources: ResourceRecommendation[]
  totalCarbonComparison: TotalCarbonComparison
  equivalent: Equivalent
  calculation: Calculation
}

export function getInfraEsgSummary() {
  return http.get<InfraEsgSummary>('/admin/esg/infra')
}
