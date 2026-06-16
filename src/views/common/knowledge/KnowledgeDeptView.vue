<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Library, Clock } from '@lucide/vue'
import type { KnowledgeDataResponse } from '@/types/knowledge'
// TODO: BE /knowledge-data 완성 후 주석 해제하고 mock 블록 제거
// import { getKnowledgeList } from '@/api/knowledgeApi'

const router = useRouter()
const route = useRoute()
const deptId = Number(route.params.deptId)

const items = ref<KnowledgeDataResponse[]>([])
const deptName = ref('')
const loading = ref(true)

const MOCK: KnowledgeDataResponse[] = [
  { knowledgeDataId: 1, departmentId: 10, departmentName: 'IT지원팀', question: 'VPN 접속이 안 될 때 어떻게 하나요?', answer: 'FortiClient를 최신 버전으로 업데이트한 뒤 방화벽 설정에서 FortiClient 허용 여부를 확인하세요. 그래도 안 되면 IT지원팀에 원격 지원을 요청하세요.', approvedAt: '2026-06-01T09:00:00', createdAt: '2026-05-28T10:00:00', updatedAt: '2026-06-01T09:00:00' },
  { knowledgeDataId: 2, departmentId: 10, departmentName: 'IT지원팀', question: '업무용 노트북 화면이 외부 모니터에 출력되지 않습니다.', answer: 'Windows 키 + P를 눌러 디스플레이 모드를 "확장" 또는 "복제"로 변경하세요. HDMI·DP 케이블 연결 상태도 확인하시고, 그래도 안 되면 드라이버 재설치를 안내드립니다.', approvedAt: '2026-05-20T14:30:00', createdAt: '2026-05-18T11:00:00', updatedAt: '2026-05-20T14:30:00' },
  { knowledgeDataId: 3, departmentId: 10, departmentName: 'IT지원팀', question: '개인 소프트웨어를 업무용 PC에 설치해도 되나요?', answer: '보안 정책상 IT 승인 없이 개인 소프트웨어를 설치할 수 없습니다. 필요한 프로그램은 IT지원 포털에서 소프트웨어 설치 요청서를 제출하세요.', approvedAt: '2026-04-10T10:00:00', createdAt: '2026-04-08T09:00:00', updatedAt: '2026-04-10T10:00:00' },
  { knowledgeDataId: 4, departmentId: 20, departmentName: '인사팀', question: '연차 신청은 며칠 전에 해야 하나요?', answer: '사용 예정일 기준 72시간(3일) 전까지 HR 시스템에서 신청해야 합니다. 긴급 상황의 경우 팀장 구두 승인 후 당일 등록이 가능합니다.', approvedAt: '2026-05-15T09:00:00', createdAt: '2026-05-12T10:00:00', updatedAt: '2026-05-15T09:00:00' },
  { knowledgeDataId: 5, departmentId: 20, departmentName: '인사팀', question: '재직증명서는 어디서 발급하나요?', answer: 'HR 시스템 → 나의 정보 → 증명서 발급 메뉴에서 즉시 발급 가능합니다. 영문 재직증명서가 필요한 경우 인사팀에 별도 요청하세요.', approvedAt: '2026-05-10T11:00:00', createdAt: '2026-05-08T14:00:00', updatedAt: '2026-05-10T11:00:00' },
  { knowledgeDataId: 6, departmentId: 30, departmentName: '재무팀', question: '법인카드로 결제할 수 없는 항목이 있나요?', answer: '개인 용도 구매, 주류, 상품권, 현금 인출은 법인카드 사용이 불가합니다. 업무 관련 식대(1인 3만 원 이내)와 교통비는 사용 가능하며 영수증을 반드시 보관하세요.', approvedAt: '2026-06-05T10:00:00', createdAt: '2026-06-03T09:00:00', updatedAt: '2026-06-05T10:00:00' },
  { knowledgeDataId: 7, departmentId: 30, departmentName: '재무팀', question: '출장 경비 정산은 어떻게 하나요?', answer: '출장 복귀 후 5영업일 이내에 경비정산 시스템에서 영수증을 첨부해 제출하세요. 숙박·교통·식대 항목별 한도가 정해져 있으니 재무팀 공지를 확인하세요.', approvedAt: '2026-04-22T15:00:00', createdAt: '2026-04-20T10:00:00', updatedAt: '2026-04-22T15:00:00' },
  { knowledgeDataId: 8, departmentId: 40, departmentName: '총무팀', question: '사무용품이 필요한데 어떻게 신청하나요?', answer: '매월 15일까지 팀 단위로 총무팀 포털의 소모품 신청 게시판에 수량을 기재해 제출하면 익월 초에 지급됩니다. 긴급 소요는 총무팀에 직접 문의하세요.', approvedAt: '2026-06-10T09:30:00', createdAt: '2026-06-08T11:00:00', updatedAt: '2026-06-10T09:30:00' },
]

onMounted(() => {
  // TODO: BE 완성 후 getKnowledgeList() 호출로 교체
  const deptItems = MOCK.filter(i => i.departmentId === deptId)
  items.value = deptItems.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
  if (deptItems.length > 0) deptName.value = deptItems[0].departmentName ?? `부서 #${deptId}`
  loading.value = false
})

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function ageBadgeClass(days: number) {
  if (days <= 7) return 'green'
  if (days <= 30) return 'blue'
  return ''
}

function ageBadgeStyle(days: number) {
  if (days <= 30) return {}
  if (days <= 90) return { background: '#fff4e5', color: '#e25c1e', borderColor: '#fcd4b0' }
  return { background: '#fff0f0', color: '#e03131', borderColor: '#ffc0c0' }
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

function truncate(text: string, max = 120) {
  return text.length > max ? text.slice(0, max) + '…' : text
}
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <button class="btn" style="margin-bottom: 12px;" @click="router.push('/knowledge')">
        <ChevronLeft :size="16" /> 부서 목록
      </button>
      <h1 class="page-title">
        <Library :size="28" color="#2b7fff" />
        {{ deptName || '...' }}
      </h1>
      <p class="page-sub">{{ items.length }}건의 지식화 문서</p>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 200px;">불러오는 중...</div>

    <div v-else-if="items.length === 0" class="empty-ph" style="height: 200px;">
      이 부서에 등록된 지식이 없습니다
    </div>

    <div v-else class="item-list">
      <div
        v-for="item in items"
        :key="item.knowledgeDataId"
        class="card item-card"
        @click="router.push(`/knowledge/${item.knowledgeDataId}`)"
      >
        <div class="item-top">
          <h3 class="item-question">{{ item.question }}</h3>
          <span
            class="badge"
            :class="ageBadgeClass(daysSince(item.approvedAt))"
            :style="ageBadgeStyle(daysSince(item.approvedAt))"
          >
            <Clock :size="11" />
            {{ daysSince(item.approvedAt) }}일 전
          </span>
        </div>
        <p class="item-preview">{{ truncate(item.answer) }}</p>
        <div class="item-date">{{ formatDate(item.approvedAt) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-list { display: flex; flex-direction: column; gap: 12px; }
.item-card {
  padding: 20px 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.15s;
}
.item-card:hover { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }

.item-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.item-question { font-size: 15px; font-weight: 700; color: #1f2430; margin: 0; flex: 1; line-height: 1.4; }
.item-preview { font-size: 13.5px; color: #717182; line-height: 1.6; margin: 0; }
.item-date { font-size: 12px; color: #aeb2bb; }
</style>
