<script setup lang="ts">
// 자주 찾는 항목 페이지 — 인기 워키 / 인기 매뉴얼 / 시스템 사용법 3탭 구조.
// 챗봇 화면의 물음표 아이콘이 /faq?tab=usage로 이동해 시스템 사용법 탭을 직접 열 수 있도록
// URL 쿼리 파라미터(?tab=)로 진입 탭을 결정하며, 탭 전환은 컴포넌트 상태로 관리한다.
// 시스템 사용법 탭은 정적 콘텐츠이므로 API를 호출하지 않는다.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HelpCircle, TrendingUp, ChevronRight, ChevronDown, Heart,
} from '@lucide/vue'
import { getPopularWorki, getPopularManuals } from '@/api/faqApi'
import type { PopularWorkiResponse, FaqManualSummaryResponse } from '@/types/faq'

const route = useRoute()
const router = useRouter()

type Tab = 'worki' | 'manual' | 'usage'
const activeTab = ref<Tab>('worki')

const popularWorki = ref<PopularWorkiResponse[]>([])
const popularManuals = ref<FaqManualSummaryResponse[]>([])
const loading = ref(false)
const error = ref('')

// URL 쿼리 파라미터(?tab=)로 진입 탭을 결정한다.
// 챗봇 물음표 아이콘이 /faq?tab=usage로 이동하므로 사용법 탭이 직접 열린다.
// 알 수 없는 값은 기본 탭(worki)으로 fallback한다.
function resolveTab(val: string | null | (string | null)[] | undefined): Tab {
  const s = Array.isArray(val) ? val[0] : val
  if (s === 'manual' || s === 'usage') return s
  return 'worki'
}

// ISO 날짜 문자열을 YYYY.MM.DD 형식으로 표시한다. 유효하지 않은 값은 빈 문자열 반환.
function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 인기 워키·매뉴얼 데이터를 병렬 요청한다.
// 사용법 탭은 정적 콘텐츠이므로 API 불필요.
// showSpinner=false 로 호출하면(포커스 복귀 시 백그라운드 갱신) 화면 깜빡임 없이 좋아요 수만 최신화한다.
async function loadPopular(showSpinner = true) {
  if (showSpinner) loading.value = true
  error.value = ''
  try {
    const [worki, popMan] = await Promise.all([
      getPopularWorki(),
      getPopularManuals(),
    ])
    popularWorki.value = worki.data
    popularManuals.value = popMan.data
  } catch {
    error.value = '자주 찾는 항목을 불러오지 못했습니다.'
  } finally {
    if (showSpinner) loading.value = false
  }
}

// 다른 경로에서 좋아요를 변경한 뒤 FAQ 탭으로 돌아오면 좋아요 수가 stale 상태로 남는다.
// 탭이 다시 보이거나(visibilitychange) 윈도우 포커스를 받을 때 조용히 재조회해 최신 값을 반영한다.
function refreshOnVisible() {
  if (document.visibilityState === 'visible') loadPopular(false)
}

onMounted(() => {
  activeTab.value = resolveTab(route.query.tab)
  loadPopular()
  document.addEventListener('visibilitychange', refreshOnVisible)
  window.addEventListener('focus', refreshOnVisible)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', refreshOnVisible)
  window.removeEventListener('focus', refreshOnVisible)
})

// 시스템 사용법 FAQ 항목 (정적 콘텐츠)
// 카테고리 순서: 기본 사용법 → 티켓 관리 → 게시판 활용 → 지식화 → 포인트 시스템 → ESG 시스템
const systemFAQs = [
  {
    id: 1,
    category: '기본 사용법',
    question: 'Worki-t는 어떻게 사용하나요?',
    answer: 'Worki-t는 사내 지식 공유 플랫폼입니다. AI 챗봇 \'노잇\'을 통해 질문하거나, 워키 게시판에서 지식을 공유하고, 매뉴얼을 검색할 수 있습니다. 메인 화면의 노잇 챗봇에 궁금한 점을 물어보세요!',
  },
  {
    id: 2,
    category: '기본 사용법',
    question: '통합 검색은 어떻게 사용하나요?',
    answer: '상단의 검색 아이콘을 클릭하면 통합 검색 페이지로 이동합니다. 매뉴얼, 워키, 티켓 등 모든 콘텐츠를 한 번에 검색할 수 있으며, 필터를 통해 원하는 카테고리만 선택할 수도 있습니다.',
  },
  {
    id: 3,
    category: '기본 사용법',
    question: '알림은 어떻게 확인하나요?',
    answer: '왼쪽 사이드바 상단의 종 아이콘을 클릭하면 알림 패널이 열립니다. 티켓 배정, 댓글 알림, 포인트 적립 등 다양한 알림을 실시간으로 확인할 수 있으며, \'전체\', \'티켓\', \'게시판\' 탭으로 구분되어 있습니다.',
  },
  {
    id: 4,
    category: '티켓 관리',
    question: '티켓은 무엇이며, 어떻게 처리하나요?',
    answer: '티켓은 AI 챗봇이 답변하지 못한 질문이 자동으로 전환되거나, 다른 부서에서 이관된 업무 요청입니다. \'내 티켓\' 메뉴에서 할당된 티켓을 확인하고 답변을 작성하면 됩니다. 티켓 처리 시 15포인트가 지급됩니다!',
  },
  {
    id: 5,
    category: '게시판 활용',
    question: '워키 게시판은 어떻게 활용하나요?',
    answer: '워키 게시판은 사내 지식을 공유하는 공간입니다. 업무 노하우, 프로세스 개선 사례, 유용한 정보 등을 작성하여 동료들과 공유할 수 있습니다. 좋아요를 많이 받으면 인기 워키로 선정되어 더 많은 포인트를 받을 수 있어요!',
  },
  {
    id: 6,
    category: '지식화',
    question: '지식화란 무엇인가요?',
    answer: '지식화는 티켓 답변을 사내 지식 문서로 변환하는 기능입니다. 팀 관리자가 완료된 티켓의 답변을 지식화하면 같은 질문이 반복될 때 AI 챗봇이 해당 내용을 참고하여 답변합니다. 지식화 처리 시 30포인트가 지급되며, 축적된 지식은 조직 전체의 업무 효율을 높이는 데 기여합니다.',
  },
  {
    id: 7,
    category: '포인트 시스템',
    question: '포인트는 어떻게 얻나요?',
    answer: '포인트는 다양한 활동으로 획득할 수 있습니다. 첫 워키 작성(+10P / 이후 +5P), 워키 답변 작성(+5P), 채택 답변(+5P), 티켓 처리(+15P) 등의 활동으로 포인트를 적립할 수 있습니다. 매일 로그인하면 출석 포인트(+1P)도 받을 수 있어요!',
  },
  {
    id: 8,
    category: '포인트 시스템',
    question: '포인트는 어디에 사용하나요?',
    answer: '포인트는 사내 복지 상품 교환, 기프티콘 구매, 사내 카페 이용권 등에 사용할 수 있습니다. 마이페이지에서 현재 포인트를 확인하고, 다양한 혜택을 받아보세요!',
  },
  {
    id: 9,
    category: 'ESG 시스템',
    question: 'ESG 포인트와 레벨 시스템은 무엇인가요?',
    answer: 'ESG 포인트는 지식 공유를 통한 환경 기여도를 나타냅니다. 아기 북극곰(0~100p), 성장하는 북극곰(101~300p), 건강한 북극곰(301~700p), 북극의 수호자(701p~) 4단계로 구성되며, 반복 질문 감소를 통한 CO2 절감량으로 계산됩니다. 마이페이지에서 나의 ESG 기여도를 확인할 수 있어요!',
  },
]
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <HelpCircle :size="28" color="#f5c000" />
        자주 찾는 항목
      </h1>
      <p class="page-sub">인기 콘텐츠와 플랫폼 사용법을 확인하세요.</p>
    </div>

    <!-- Tabs -->
    <div class="seg" style="margin-bottom: 24px;">
      <button :class="{ on: activeTab === 'worki' }" @click="activeTab = 'worki'">
        <Heart :size="14" /> 인기 워키
      </button>
      <button :class="{ on: activeTab === 'manual' }" @click="activeTab = 'manual'">
        <TrendingUp :size="14" /> 인기 매뉴얼
      </button>
      <button :class="{ on: activeTab === 'usage' }" @click="activeTab = 'usage'">
        <HelpCircle :size="14" /> 시스템 사용법
      </button>
    </div>

    <!-- 인기 워키 탭 -->
    <template v-if="activeTab === 'worki'">
      <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
      <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>
      <div v-else class="card faq-section">
        <p class="tab-desc">좋아요를 가장 많이 받은 워키입니다</p>
        <div v-if="popularWorki.length === 0" class="section-empty">데이터가 없습니다</div>
        <div v-else class="rank-list">
          <div
            v-for="(w, i) in popularWorki"
            :key="w.questionId"
            class="rank-row"
            @click="router.push(`/worki/${w.questionId}`)"
          >
            <div class="rank-num" :class="i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'plain'">
              {{ i + 1 }}
            </div>
            <div class="rank-body">
              <div class="rank-title">{{ w.title }}</div>
              <div class="rank-meta">
                <Heart :size="12" color="#ec4899" style="display:inline;" />
                {{ w.likeCount }} 좋아요 · {{ formatDate(w.createdAt) }}
              </div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>
    </template>

    <!-- 인기 매뉴얼 탭 -->
    <template v-else-if="activeTab === 'manual'">
      <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
      <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>
      <div v-else class="card faq-section">
        <p class="tab-desc">AI 챗봇 답변에서 가장 많이 인용된 매뉴얼입니다</p>
        <div v-if="popularManuals.length === 0" class="section-empty">데이터가 없습니다</div>
        <div v-else class="rank-list">
          <div
            v-for="(m, i) in popularManuals"
            :key="m.manualId"
            class="rank-row"
            @click="router.push(`/manuals/${m.manualId}?from=faq`)"
          >
            <div class="rank-num" :class="i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'plain'">
              {{ i + 1 }}
            </div>
            <div class="rank-body">
              <div class="rank-title">{{ m.title }}</div>
              <div class="rank-meta">인용 {{ m.citationCount }}회 · {{ formatDate(m.createdAt) }}</div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>
    </template>

    <!-- 시스템 사용법 탭 -->
    <template v-else>
      <div class="card faq-section">
        <h3 class="section-title">
          <HelpCircle :size="16" color="#f97316" /> Worki-t 시스템 사용 가이드
        </h3>
        <div class="faq-accordion">
          <details v-for="faq in systemFAQs" :key="faq.id" class="faq-item">
            <summary class="faq-summary">
              <div class="faq-summary-inner">
                <span class="faq-badge">{{ faq.category }}</span>
                <span class="faq-question">{{ faq.question }}</span>
              </div>
              <ChevronDown :size="16" color="#aeb2bb" class="faq-chevron" />
            </summary>
            <div class="faq-answer">{{ faq.answer }}</div>
          </details>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── 공통 ── */
.seg button { display: flex; align-items: center; gap: 6px; }
.faq-section { padding: 24px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 16px; }
.tab-desc { font-size: 13px; color: #aeb2bb; margin: 0 0 16px; }
.section-empty { font-size: 13.5px; color: #aeb2bb; padding: 12px 6px; }

/* ── 순위 목록 ── */
.rank-list { display: flex; flex-direction: column; }
.rank-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 6px;
  border-top: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}
.rank-row:first-child { border-top: none; }
.rank-row:hover { background: #f7f8fa; }

.rank-num {
  min-width: 32px;
  text-align: center;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}
.rank-num.gold   { color: #f5c000; }
.rank-num.silver { color: #9ca3af; }
.rank-num.bronze { color: #c2774b; }
.rank-num.plain  { color: #d1d5db; font-size: 15px; font-weight: 600; }

.rank-body { flex: 1; min-width: 0; }
.rank-title { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 3px; }
.rank-meta { font-size: 12px; color: #aeb2bb; display: flex; align-items: center; gap: 4px; }

/* ── 아코디언 ── */
.faq-accordion { display: flex; flex-direction: column; }

.faq-item {
  border-top: 1px solid var(--line);
}
.faq-item:first-child { border-top: none; }

.faq-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 6px;
  cursor: pointer;
  list-style: none;
  border-radius: 6px;
  transition: background 0.12s;
}
.faq-summary::-webkit-details-marker { display: none; }
.faq-summary:hover { background: #f7f8fa; }

.faq-summary-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.faq-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #717182;
  background: #f3f4f6;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 2px 8px;
  white-space: nowrap;
}

.faq-question {
  font-size: 14.5px;
  font-weight: 600;
  color: #1f2430;
}

.faq-chevron {
  flex-shrink: 0;
  transition: transform 0.2s;
}
details[open] .faq-chevron {
  transform: rotate(180deg);
}

.faq-answer {
  font-size: 13.5px;
  color: #717182;
  line-height: 1.7;
  padding: 0 6px 16px 20px;
}
</style>
