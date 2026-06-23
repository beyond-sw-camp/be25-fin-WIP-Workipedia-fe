<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// 지식화 게시판 상세 뷰. URL 파라미터(id)로 단건 지식 문서를 표시한다.
//
// 핵심 구현 포인트
//   1. 데이터 우선순위: useKnowledgeStore 캐시에서 먼저 찾고, 없으면 getKnowledgeDetail API로 단건 조회한다.
//      직접 URL 진입(목록 캐시 없음) 또는 size 한도(100건) 초과 항목 진입에 대응하기 위함이다.
//   2. 경과일 색상: 7일 초록 → 30일 파랑 → 90일 주황 → 초과 빨강. 목록 뷰와 동일한 기준을 사용한다.
//   3. 90일 경과 배너: 오래된 문서임을 독자에게 경고해 신뢰도를 명시적으로 안내한다.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Clock, AlertTriangle, Paperclip } from '@lucide/vue'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'
import { getKnowledgeDetail } from '@/api/knowledgeApi'
import { getLatestAnswer, getTicketDetail } from '@/api/ticketApi'
import type { KnowledgeDataResponse } from '@/types/knowledge'

const router = useRouter()
const route = useRoute()
const id = Number(route.params.id)

const knowledgeStore = useKnowledgeStore()
// store에 없는 항목(size 상한 초과 등)을 위한 단건 조회 fallback 결과
const fetchedItem = ref<KnowledgeDataResponse | null>(null)
const fallbackLoading = ref(false)

// store 목록에서 먼저 찾고, 없으면 onMounted에서 단건 API로 보완한다.
const item = computed(() =>
  knowledgeStore.items.find(m => m.knowledgeDataId === id) ?? fetchedItem.value
)

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

const elapsed = computed(() => (item.value ? daysSince(item.value.approvedAt) : 0))
// 90일 경과 시 '내용이 오래됐을 수 있다'는 배너를 표시해 독자에게 신뢰도를 경고한다.
const isStale = computed(() => elapsed.value > 90)

// 경과일에 따라 초록→파랑→주황→빨강 순으로 색을 강조해 정보 신선도를 직관적으로 표현한다.
function elapsedStyle(days: number) {
  if (days <= 7) return { color: '#00a63e' }
  if (days <= 30) return { color: '#2b7fff' }
  if (days <= 90) return { color: '#e25c1e' }
  return { color: '#e03131' }
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

// item이 확정되면 원본 티켓 답변의 첨부파일과 원본 본문을 가져온다.
// onMounted 대신 watch(item, { immediate }) 를 쓰는 이유:
//   item은 store 캐시(목록 경유)와 단건 API(직접 URL 진입) 두 경로로 확정되므로
//   어느 쪽이든 item이 변경되는 순간 한 번만 실행하면 된다.
// ticketId는 admin 엔드포인트에서만 반환되므로 USER 권한 등에서는 조기 종료된다.
const answerFiles = ref<{ fileUrl: string; fileName: string | null; fileSize: number | null }[]>([])
const originalTicketBody = ref('')
const SENDER_RE = /\n##SENDER:(.+)##$/
watch(item, async (newItem) => {
  answerFiles.value = []
  originalTicketBody.value = ''
  if (!newItem?.ticketId) return
  try {
    const [ansRes, ticketRes] = await Promise.allSettled([
      getLatestAnswer(newItem.ticketId),
      getTicketDetail(newItem.ticketId),
    ])
    if (ansRes.status === 'fulfilled') {
      const d = ansRes.value.data
      if (d.files?.length) {
        answerFiles.value = d.files.filter(f => f.fileUrl).map(f => ({ fileUrl: f.fileUrl!, fileName: f.fileName, fileSize: f.fileSize }))
      } else if (d.fileUrl) {
        answerFiles.value = [{ fileUrl: d.fileUrl, fileName: d.fileName, fileSize: d.fileSize }]
      }
    }
    if (ticketRes.status === 'fulfilled') {
      originalTicketBody.value = ticketRes.value.data.content.replace(SENDER_RE, '').trim()
    }
  } catch { /* 조회 실패는 무시한다. */ }
}, { immediate: true })

onMounted(async () => {
  await knowledgeStore.load()
  // 목록 로드 후에도 없으면 단건 API로 재조회한다. (직접 URL 진입 또는 size 한도 초과 항목)
  if (!item.value) {
    fallbackLoading.value = true
    try {
      const res = await getKnowledgeDetail(id)
      fetchedItem.value = res.data
    } catch {
      // 단건 조회도 실패하면 not-found 화면 표시
    } finally {
      fallbackLoading.value = false
    }
  }
})
</script>

<template>
  <div class="content-inner">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="knowledgeStore.loading || fallbackLoading || (!knowledgeStore.loaded && !knowledgeStore.error)" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="!item" class="empty-ph" style="height: 240px;">문서를 불러올 수 없습니다</div>

    <template v-else>
      <div class="detail-badges">
        <span class="badge gray">{{ item.departmentName ?? '알 수 없는 부서' }}</span>
        <span class="badge" :style="elapsedStyle(elapsed)">
          <Clock :size="11" /> {{ elapsed }}일 경과
        </span>
      </div>

      <div v-if="isStale" class="stale-banner">
        <AlertTriangle :size="16" />
        이 문서는 작성된 지 {{ elapsed }}일이 지났습니다. 내용이 현재와 다를 수 있습니다.
      </div>

      <div class="card section-card">
        <div class="section-label">질문</div>
        <p class="section-text">{{ item.question }}</p>
        <template v-if="originalTicketBody && originalTicketBody !== item.question">
          <div class="original-body-label">내용</div>
          <p class="section-text original-body-text">{{ originalTicketBody }}</p>
        </template>
      </div>

      <div class="card section-card">
        <div class="section-label">답변</div>
        <p class="section-text">{{ item.answer }}</p>
      </div>

      <div v-if="answerFiles.length" class="card section-card">
        <div class="section-label">첨부 파일</div>
        <a v-for="(f, i) in answerFiles" :key="i" :href="f.fileUrl" target="_blank" rel="noopener noreferrer" class="file-link">
          <Paperclip :size="14" />
          <span>{{ f.fileName ?? '첨부 파일' }}</span>
          <span v-if="f.fileSize" class="file-size">({{ (f.fileSize / 1024).toFixed(1) }}KB)</span>
        </a>
      </div>

      <div class="card meta-card">
        <div class="meta-row">
          <span class="meta-key">발행일</span>
          <span class="meta-val">{{ formatDate(item.approvedAt) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">정보 경과</span>
          <span class="meta-val" :style="elapsedStyle(elapsed)">{{ elapsed }}일</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-badges { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }

.stale-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fff4e5;
  border: 1px solid #fcd4b0;
  color: #e25c1e;
  font-size: 13.5px;
  margin-bottom: 14px;
}

.section-card { padding: 24px 28px; margin-bottom: 14px; }
.file-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #2b7fff;
  text-decoration: none;
  transition: background 0.12s;
}
.file-link:hover { background: #f0f9ff; }
.file-link .file-size { color: #94a3b8; font-size: 12px; }
.section-label {
  font-size: 12px;
  font-weight: 700;
  color: #aeb2bb;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.section-text { font-size: 15px; color: #1f2430; line-height: 1.75; margin: 0; white-space: pre-wrap; }
.original-body-label { font-size: 11.5px; font-weight: 600; color: #aeb2bb; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 14px; margin-bottom: 6px; }
.original-body-text { font-size: 13.5px; color: #6b7280; border-left: 2px solid #e5e7eb; padding-left: 10px; }

.meta-card { padding: 20px 28px; display: flex; flex-direction: column; gap: 12px; }
.meta-row { display: flex; align-items: center; gap: 16px; }
.meta-key { font-size: 13px; color: #aeb2bb; width: 72px; }
.meta-val { font-size: 14px; font-weight: 600; color: #1f2430; }
</style>
