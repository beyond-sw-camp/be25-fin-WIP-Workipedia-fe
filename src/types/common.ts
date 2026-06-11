// BE 공통 페이지 응답(common.response.PageResponse<T>). 여러 도메인이 공유한다.
// 주의: pageInfo.page 는 1-based (BE에서 page.getNumber() + 1).
export interface PageInfo {
  page: number // 1-based
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface PageResponse<T> {
  content: T[]
  pageInfo: PageInfo
}

// 페이지 요청 파라미터.
// 주의: 엔드포인트마다 page 의 base 가 다르다.
//  - BasePageRequest 기반(manuals, tickets): page 는 1-based (기본 1).
//  - Spring Pageable 기반(notifications, points, search, /me/tickets): page 는 0-based (기본 0).
// 각 api 함수 주석에 명시한다.
export interface PageParams {
  page?: number
  size?: number
}
