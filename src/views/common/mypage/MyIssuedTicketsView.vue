<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Building2, Info } from '@lucide/vue'
import { useMyIssuedTickets, type MyIssuedTicketTab } from '@/composables/useMyIssuedTickets'

const router = useRouter()
const {
  activeTab,
  loading,
  error,
  waitingCount,
  answeredCount,
  currentList,
  setActiveTab,
  loadTickets,
} = useMyIssuedTickets()

function switchTab(tab: MyIssuedTicketTab) {
  setActiveTab(tab)
}

onMounted(loadTickets)
</script>

<template>
  <div class="content-inner">

    <!-- Header -->
    <div class="page-header">
      <button class="btn" @click="router.push('/my')">
        <ChevronLeft :size="16" />
      </button>
      <div>
        <h1 class="page-title">내 발행 티켓</h1>
        <p class="page-sub">내가 발행한 티켓 목록을 확인하세요</p>
      </div>
    </div>

    <!-- Info card -->
    <div class="info-card">
      <Info :size="18" color="#2b7fff" style="flex-shrink:0; margin-top:1px;" />
      <div class="info-body">
        <p class="info-title">티켓 처리 기한 안내</p>
        <ul class="info-list">
          <li>• 티켓은 담당 부서에 배정된 시점부터 <strong>2일(48시간)</strong> 이내에 답변을 받으실 수 있습니다.</li>
          <li>• 담당 부서가 변경되어 다른 부서로 재배정되는 경우, <strong>재배정 시점부터 2일(48시간)</strong>의 처리 기한이 다시 적용됩니다.</li>
        </ul>
      </div>
    </div>

    <!-- Tabs -->
    <div class="seg" style="margin-bottom: 0;">
      <button :class="{ on: activeTab === 'waiting' }" @click="switchTab('waiting')">
        처리 전 ({{ waitingCount }})
      </button>
      <button :class="{ on: activeTab === 'answered' }" @click="switchTab('answered')">
        처리 완료 ({{ answeredCount }})
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="empty-ph" style="height: 200px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 200px;">{{ error }}</div>

    <template v-else>
      <div class="ticket-list">
        <template v-if="currentList.length > 0">
          <div
            v-for="t in currentList"
            :key="t.ticketId"
            class="card ticket-row"
            @click="router.push(`/my/tickets/${t.ticketId}`)"
          >
            <div class="ticket-row-info">
              <span class="ticket-title">{{ t.title }}</span>
              <div class="ticket-meta">
                <Building2 :size="13" color="#aeb2bb" />
                <span>{{ t.assignedDepartmentName ?? '배정 대기' }}</span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="card empty-state">
          <div class="empty-emoji">{{ activeTab === 'waiting' ? '✅' : '📭' }}</div>
          <p class="empty-title">
            {{ activeTab === 'waiting' ? '처리 전인 티켓이 없습니다' : '처리 완료된 티켓이 없습니다' }}
          </p>
          <p class="empty-desc">
            {{ activeTab === 'waiting' ? '모든 티켓의 답변이 완료되었습니다' : '처리가 완료된 티켓이 여기에 표시됩니다' }}
          </p>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.page-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
.page-sub { font-size: 13px; color: #717182; margin: 0; }

.info-card {
  display: flex; align-items: flex-start; gap: 12px;
  background: #eff6ff; border: 1px solid #bfdbfe;
  border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;
}
.info-body { flex: 1; }
.info-title { font-size: 13.5px; font-weight: 700; color: #1e40af; margin: 0 0 6px; }
.info-list { margin: 0; padding-left: 18px; font-size: 13px; color: #1d4ed8; line-height: 1.8; }
.info-list li { margin: 0; }

.ticket-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.ticket-row { padding: 18px 20px; cursor: pointer; transition: box-shadow 0.15s; }
.ticket-row:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.ticket-row-info { display: flex; flex-direction: column; gap: 6px; }
.ticket-title { font-size: 15px; font-weight: 600; color: #1f2430; }
.ticket-row:hover .ticket-title { color: #2b7fff; }
.ticket-meta { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #aeb2bb; }

.empty-state { padding: 60px 20px; text-align: center; }
.empty-emoji { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-size: 15px; font-weight: 600; color: #1f2430; margin: 0 0 6px; }
.empty-desc { font-size: 13px; color: #aeb2bb; margin: 0; }
</style>
