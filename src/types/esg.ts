// BE: esg.dto.EsgResponse (내 ESG 등급)
export interface EsgResponse {
  userId: number
  esgScore: number
  gradeName: string
  nextGradeMinScore: number | null
  remainingScoreForNextGrade: number | null
  gradeImageUrl: string | null
}

// BE: leaderboard.dto.LeaderboardRankerResponse (topRankers 1건)
export interface EsgLeaderboardResponse {
  rank: number
  userId: number
  nickname: string
  departmentName: string | null
  gradeId: number
  gradeName: string
  gradeImageUrl: string | null
  esgScore: number
  answerCount?: number       // mySummary에만 존재, topRankers에는 없음
  acceptedAnswerCount?: number
}

export interface EnvironmentImpact {
  savedWorkHours: number | null
  electricitySavedKwh: number | null
  co2SavedKg: number | null
  smartphoneChargeEquivalentCount: number | null
}

// BE: leaderboard.dto.LeaderboardResponse (상위 랭커 + 내 순위)
export interface EsgLeaderboardPageResponse {
  rankingPeriodStart: string | null
  periodStart?: string | null
  calculatedAt: string | null
  topRankers: EsgLeaderboardResponse[]
  mySummary: EsgLeaderboardResponse | null
  totalEsgScore: number
  environmentImpact?: EnvironmentImpact | null
}
