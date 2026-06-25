<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertCircle, Clock, Paperclip } from '@lucide/vue'
import BaseToast from '@/components/common/BaseToast.vue'
import {
  assignCommonQueueTicket,
  getAdminDepartments,
  getCommonQueueTickets,
  type AdminDepartment,
} from '@/api/adminApi'
import type { TicketResponse } from '@/types/ticket'

const queueTickets = ref<TicketResponse[]>([])
const queueLoading = ref(false)
const queueError = ref(false)
const queueHasNext = ref(false)
const queuePage = ref(1)
const queueLoadingMore = ref(false)
const selectedDept = ref<Record<number, number>>({})
const assigning = ref<Set<number>>(new Set())
const departments = ref<AdminDepartment[]>([])

const toastVisible = ref(false)
const toastTitle = ref('')
const toastSub = ref('')
const toastType = ref<'success' | 'error'>('success')

function showToast(title: string, sub = '', type: 'success' | 'error' = 'success') {
  toastTitle.value = title
  toastSub.value = sub
  toastType.value = type
  toastVisible.value = true
}

function entryReasonLabel(ticket: TicketResponse) {
  if (ticket.commonQueueReason === 'TRANSFER_REQUESTED') return '팀 관리자 이관'
  if (ticket.commonQueueReason === 'ASSIGNMENT_EXPIRED') return '24시간 초과'
  return '자동 배정 실패'
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

function queueExpiryMs(updatedAt: string): number {
  return new Date(updatedAt).getTime() + 7 * 24 * 3600000 - Date.now()
}

function queueExpiryLabel(updatedAt: string): string {
  const ms = queueExpiryMs(updatedAt)
  if (ms <= 0) return '만료됨'
  const days = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (days >= 2) return `${days}일 후 자동 삭제`
  if (days === 1) return `1일 ${h}시간 후 자동 삭제`
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}시간 후 자동 삭제`
  return `${m}분 후 자동 삭제`
}

function queueExpiryClass(updatedAt: string): string {
  const ms = queueExpiryMs(updatedAt)
  if (ms <= 0) return 'expiry-expired'
  const days = ms / 86400000
  if (days <= 1) return 'expiry-urgent'
  if (days <= 3) return 'expiry-warning'
  return 'expiry-ok'
}

async function loadQueue(page: number, append: boolean) {
  if (append) queueLoadingMore.value = true
  else {
    queueLoading.value = true
    queueError.value = false
  }

  try {
    const res = await getCommonQueueTickets({ page, size: 10 })
    queueTickets.value = append
      ? [...queueTickets.value, ...res.data.content]
      : res.data.content
    queueHasNext.value = res.data.pageInfo.hasNext
    queuePage.value = page
  } catch {
    if (append) showToast('더 보기 로딩에 실패했습니다. 다시 시도해주세요.', '', 'error')
    else queueError.value = true
  } finally {
    if (append) queueLoadingMore.value = false
    else queueLoading.value = false
  }
}

async function handleAssign(ticket: TicketResponse) {
  const deptId = selectedDept.value[ticket.ticketId]
  if (!deptId) {
    showToast('담당 부서를 선택해주세요.', '', 'error')
    return
  }

  assigning.value = new Set([...assigning.value, ticket.ticketId])
  try {
    await assignCommonQueueTicket(ticket.ticketId, { departmentId: deptId })
    queueTickets.value = queueTickets.value.filter(t => t.ticketId !== ticket.ticketId)
    delete selectedDept.value[ticket.ticketId]
    const deptName = departments.value.find(d => d.departmentId === deptId)?.departmentName ?? '담당 부서'
    showToast(`${deptName}에 티켓을 배정했습니다.`)
  } catch {
    showToast('배정에 실패했습니다. 다시 시도해주세요.', '', 'error')
  } finally {
    assigning.value = new Set([...assigning.value].filter(id => id !== ticket.ticketId))
  }
}

const SENDER_RE = /\n##SENDER:(.+)##$/

function ticketBody(content: string) {
  return content.replace(SENDER_RE, '').trim()
}

function ticketSender(content: string) {
  return content.match(SENDER_RE)?.[1]?.replaceAll('|', ' · ') ?? ''
}

function ticketFiles(t: TicketResponse) {
  if (t.files?.length) return t.files.filter(f => !!f.fileUrl)
  return t.fileUrl
    ? [{ fileKey: '', fileUrl: t.fileUrl, fileName: '첨부 이미지', fileContentType: null, fileSize: null }]
    : []
}

async function loadDepartments() {
  try {
    const res = await getAdminDepartments()
    departments.value = res.data
  } catch {
    departments.value = []
    showToast('부서 목록을 불러오지 못했습니다.', '배정 전에 다시 새로고침해주세요.', 'error')
  }
}

onMounted(() => {
  loadDepartments()
  loadQueue(1, false)
})
</script>

<template>
  <div class="card common-queue-card">
    <div class="queue-header">
      <div>
        <h3 class="chart-title">
          <AlertCircle :size="18" color="#f97316" /> 공통 접수 티켓
        </h3>
        <p class="queue-desc">자동 배정에 실패했거나 팀 관리자가 이관한 티켓을 담당 부서에 배정하세요.</p>
      </div>
      <span class="badge gray queue-count">
        {{ queueLoading ? '...' : `${queueTickets.length}건` }}
      </span>
    </div>

    <div v-if="queueLoading" class="empty-ph queue-state">불러오는 중...</div>
    <div v-else-if="queueError" class="empty-ph queue-state queue-state-error">
      공통 접수 티켓을 불러오지 못했습니다.
      <button class="btn retry-btn" @click="loadQueue(1, false)">다시 시도</button>
    </div>
    <div v-else-if="queueTickets.length === 0" class="empty-ph queue-state">공통 접수 티켓이 없습니다</div>

    <div v-else class="queue-list">
      <div v-for="ticket in queueTickets" :key="ticket.ticketId" class="queue-item">
        <div class="queue-item-top">
          <div class="queue-item-title-row">
            <span class="queue-title">{{ ticket.title }}</span>
            <span
              class="badge"
              :class="ticket.commonQueueReason === 'TRANSFER_REQUESTED'
                ? 'gray'
                : ticket.commonQueueReason === 'ASSIGNMENT_EXPIRED'
                  ? 'orange'
                  : 'red'"
            >
              {{ entryReasonLabel(ticket) }}
            </span>
            <span class="expiry-tag" :class="queueExpiryClass(ticket.updatedAt)">
              <Clock :size="10" />
              {{ queueExpiryLabel(ticket.updatedAt) }}
            </span>
          </div>
          <div class="queue-item-meta-right">
            <span class="queue-time">접수: {{ formatDate(ticket.createdAt) }}</span>
            <span v-if="ticketSender(ticket.content)" class="queue-sender">{{ ticketSender(ticket.content) }}</span>
          </div>
        </div>

        <p class="ticket-content">{{ ticketBody(ticket.content) }}</p>

        <div v-if="ticketFiles(ticket).length" class="file-list">
          <a
            v-for="f in ticketFiles(ticket)"
            :key="f.fileKey || f.fileUrl || f.fileName || 'ticket-file'"
            :href="f.fileUrl ?? '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="file-item file-item--link"
          >
            <Paperclip :size="13" class="file-icon" />
            <span class="file-name">{{ f.fileName ?? '첨부 이미지' }}</span>
            <span v-if="f.fileSize" class="file-size">({{ (f.fileSize / 1024).toFixed(1) }}KB)</span>
          </a>
        </div>

        <div v-if="ticket.commonQueueReason === 'TRANSFER_REQUESTED' && ticket.transferReason" class="transfer-reason">
          <p class="transfer-label">이관 사유</p>
          <p class="transfer-text">{{ ticket.transferReason }}</p>
        </div>

        <div class="queue-assign-row">
          <select v-model="selectedDept[ticket.ticketId]" class="dept-select">
            <option :value="undefined" disabled>담당 부서 선택</option>
            <option
              v-for="dept in departments"
              :key="dept.departmentId"
              :value="dept.departmentId"
            >
              {{ dept.departmentName }}
            </option>
          </select>
          <button
            class="btn btn-primary"
            :disabled="assigning.has(ticket.ticketId)"
            @click="handleAssign(ticket)"
          >
            {{ assigning.has(ticket.ticketId) ? '배정 중...' : '배정' }}
          </button>
        </div>
      </div>

      <div v-if="queueHasNext" class="more-row">
        <button class="btn" :disabled="queueLoadingMore" @click="loadQueue(queuePage + 1, true)">
          {{ queueLoadingMore ? '불러오는 중...' : '더 보기' }}
        </button>
      </div>
    </div>
  </div>

  <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" :type="toastType" />
</template>

<style scoped>
.common-queue-card { padding: 24px 28px; }

.chart-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14.5px;
  font-weight: 700;
  color: #1f2430;
  margin: 0 0 4px;
}

.queue-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.queue-desc { font-size: 13px; color: #aeb2bb; margin: 4px 0 0; }
.queue-count { font-size: 14px; font-weight: 700; padding: 4px 12px; }
.queue-state { height: 120px; }
.queue-state-error { color: #e03131; }
.retry-btn { margin-top: 8px; }

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 620px;
  overflow-y: auto;
}

.queue-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.queue-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.queue-title { font-size: 14px; font-weight: 600; color: #1f2430; }

.queue-item-meta-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.queue-time,
.queue-sender {
  font-size: 12px;
  color: #aeb2bb;
  white-space: nowrap;
}

.expiry-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  white-space: nowrap;
}

.expiry-ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.expiry-warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.expiry-urgent { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
.expiry-expired { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; }

.ticket-content {
  font-size: 13.5px;
  color: #475569;
  line-height: 1.6;
  margin: 0;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 8px;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.transfer-reason {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 10px 14px;
}

.transfer-label { font-size: 11.5px; color: #aeb2bb; margin: 0 0 4px; }
.transfer-text { font-size: 13.5px; color: #1f2430; margin: 0; }
.file-list { display: flex; flex-direction: column; gap: 6px; margin-top: -2px; }

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  font-size: 12.5px;
  color: #475569;
  text-decoration: none;
}

.file-item--link:hover { border-color: #93c5fd; background: #eff6ff; }
.file-icon { color: #aeb2bb; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: #94a3b8; }
.queue-assign-row { display: flex; gap: 8px; align-items: center; }

.dept-select {
  flex: 1;
  font-size: 13.5px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: #1f2430;
}

.badge.red { background: #fff0f0; color: #e03131; border-color: #ffc0c0; }
.more-row { text-align: center; padding: 8px 0; }

@media (max-width: 760px) {
  .common-queue-card { padding: 18px; }
  .queue-header,
  .queue-item-top,
  .queue-assign-row {
    flex-direction: column;
    align-items: stretch;
  }
  .queue-item-meta-right { align-items: flex-start; }
}
</style>
