// BE: esg.dto.EsgResponse (내 ESG 등급)
export interface EsgResponse {
  userId: number
  esgScore: number
  gradeName: string
  nextGradeMinScore: number | null
  remainingScoreForNextGrade: number | null
  gradeImageUrl: string | null
}

// BE: esg.dto.EsgLeaderboardResponse (리더보드 1건)
export interface EsgLeaderboardResponse {
  rank: number
  userId: number
  nickname: string
  departmentName: string | null
  esgScore: number
  gradeName: string
  gradeImageUrl: string | null
  answerCount: number
  acceptedAnswerCount: number
}

// BE: esg.dto.EsgLeaderboardPageResponse (상위 랭커 + 내 순위)
export interface EsgLeaderboardPageResponse {
  topRankers: EsgLeaderboardResponse[]
  myRank: EsgLeaderboardResponse | null
}
