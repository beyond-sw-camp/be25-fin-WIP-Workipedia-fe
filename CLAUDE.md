# Workipedia FE

AI 기반 사내 지식 공유 플랫폼. 요청(티켓) / 질문(워키) / 채팅(Flash Chat) 3채널 구조로 반복 업무 문의를 줄이고 처리 결과를 조직 지식으로 축적하는 B2B SI 솔루션. 5인 팀 프로젝트 — 프론트엔드.

## Tech Stack

- Vue 3 + TypeScript
- Vite
- Tailwind CSS v4
- Pinia (전역 상태 관리)
- Vue Router
- Axios (API 통신)

## 디렉토리 구조

```
src/
├── api/          # axios 인스턴스, API 호출 함수
├── assets/       # 이미지, 폰트, 전역 CSS
├── components/   # 재사용 공통 컴포넌트
├── composables/  # 재사용 로직 (useXxx 패턴)
├── constants/    # 상수 (TicketStatus, UserRole 등)
├── layout/       # 공통 레이아웃 (헤더, 사이드바, 네비게이션)
├── router/       # Vue Router 설정
├── stores/       # Pinia store (auth, user, notification 등)
├── views/        # 페이지 컴포넌트 (라우터와 1:1)
├── App.vue
└── main.ts
```

## 네이밍 규칙

- 컴포넌트 파일: `PascalCase.vue` (예: `TicketCard.vue`)
- 페이지(views): `XxxView.vue` (예: `TicketListView.vue`)
- composable: `useXxx.ts` (예: `useTicket.ts`)
- store: `useXxxStore.ts` (예: `useAuthStore.ts`)
- 상수: `UPPER_SNAKE_CASE`

## API 통신

- base URL: `VITE_API_BASE_URL` 환경변수 사용
- `src/api/` 하위에 도메인별 파일 분리 (예: `ticket.ts`, `auth.ts`)
- 응답 포맷: `ResponseEntity<T>` 직접 반환 (BE 컨벤션)

## Key Docs

| 목적            | 경로                                    |
| --------------- | --------------------------------------- |
| API 계약        | `docs/api/api-contract.md`              |
| PRD             | `docs/reference/prd.md`                 |
| TRD             | `docs/reference/trd.md`                 |
| Git 브랜치 전략 | BE 레포 `docs/dev/git-strategy.md` 참고 |

## 브랜치 전략

```
feat/*, docs/*, chore/* → dev → main
```

작업 시작 전 `dev`에서 브랜치 따기.

## 팀원 & 담당

| 이름   | 담당                                                              |
| ------ | ----------------------------------------------------------------- |
| 황희수 | 프론트엔드 메인                                                   |
| 민정기 | 프론트엔드 (BE 완료 후 합류) — 워키 UI, CDN 챗봇 컴포넌트, 모바일 |
