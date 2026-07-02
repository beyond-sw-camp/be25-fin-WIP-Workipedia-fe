<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, Database, FileText, Gauge, RefreshCcw } from '@lucide/vue'
import { getLlmUsageSavings, type LlmUsageSavingsResponse } from '@/api/adminApi'

const usage = ref<LlmUsageSavingsResponse | null>(null)
const loading = ref(false)
const error = ref('')
const showEvidence = ref(false)

async function loadUsage() {
  loading.value = true
  error.value = ''
  try {
    const res = await getLlmUsageSavings()
    usage.value = res.data
  } catch {
    error.value = 'LLM 사용량 집계를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortQuestion(question: string) {
  return question.length > 34 ? `${question.slice(0, 34)}...` : question
}

const emptySummary = {
  sampleCount: 0,
  fullFileCredits: 0,
  ragCredits: 0,
  sourceCount: 0,
  citedChunkCount: 0,
}
const summary = computed(() => usage.value?.summary ?? emptySummary)
const latestSamples = computed(() => usage.value?.recentSamples ?? [])
const latest = computed(() => latestSamples.value[0] ?? null)
const hasSamples = computed(() => summary.value.sampleCount > 0)
const creditMax = computed(() => Math.max(summary.value.fullFileCredits, summary.value.ragCredits, 1))

onMounted(() => {
  loadUsage()
})
</script>

<template>
  <section class="llm-panel">
    <div class="panel-head">
      <div>
        <div class="eyebrow">
          <Gauge :size="15" />
          RAG 인용 근거 기록
          <span class="estimate-badge">저장 데이터</span>
        </div>
        <h2 class="panel-title">노잇 답변에 실제 인용된 지식 기준</h2>
        <p class="panel-sub">질문 완료 후 서버에 저장된 인용 청크와 지식 출처만 표시합니다.</p>
      </div>
      <button class="refresh-btn" type="button" :disabled="loading" @click="loadUsage">
        <RefreshCcw :size="15" />
        새로고침
      </button>
    </div>

    <div v-if="loading" class="empty-state">
      <Database :size="24" />
      <div>
        <strong>집계 데이터를 불러오는 중입니다.</strong>
        <span>최근 노잇 질문의 인용 근거를 확인하고 있습니다.</span>
      </div>
    </div>

    <div v-else-if="error" class="empty-state error">
      <Database :size="24" />
      <div>
        <strong>{{ error }}</strong>
        <span>백엔드 대시보드 API 연결 상태를 확인해주세요.</span>
      </div>
    </div>

    <div v-else-if="!hasSamples" class="empty-state">
      <Database :size="24" />
      <div>
        <strong>아직 집계된 질문이 없습니다.</strong>
        <span>KnowIt에서 질문을 한 번 보내면 서버에 저장된 인용 근거가 표시됩니다.</span>
      </div>
    </div>

    <template v-else>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-icon token"><Database :size="18" /></div>
          <span class="metric-label">집계 질문</span>
          <strong>{{ formatNumber(summary.sampleCount) }}건</strong>
          <small>대시보드 반영 질문 수</small>
        </div>
        <div class="metric-card">
          <div class="metric-icon credit"><FileText :size="18" /></div>
          <span class="metric-label">인용 청크</span>
          <strong>{{ formatNumber(summary.citedChunkCount) }}개</strong>
          <small>답변에 연결된 청크 수</small>
        </div>
        <div class="metric-card">
          <div class="metric-icon chunk"><Gauge :size="18" /></div>
          <span class="metric-label">지식 출처</span>
          <strong>{{ formatNumber(summary.sourceCount) }}개</strong>
          <small>인용된 원문 출처 수</small>
        </div>
      </div>

      <div class="credit-card">
        <div class="compare-title-row">
          <h3>크레딧 양 비교</h3>
          <span>{{ summary.sampleCount }}건 기준</span>
        </div>
        <div class="bar-row">
          <span>파일 전체</span>
          <div class="bar-track">
            <div class="bar-fill full" :style="{ width: `${(summary.fullFileCredits / creditMax) * 100}%` }" />
          </div>
          <strong>{{ formatNumber(summary.fullFileCredits) }}</strong>
        </div>
        <div class="bar-row">
          <span>RAG 청크</span>
          <div class="bar-track">
            <div class="bar-fill rag" :style="{ width: `${(summary.ragCredits / creditMax) * 100}%` }" />
          </div>
          <strong>{{ formatNumber(summary.ragCredits) }}</strong>
        </div>
      </div>

      <div class="detail-grid">
        <div class="table-card">
          <button class="evidence-toggle" type="button" @click="showEvidence = !showEvidence">
            <span>최근 질문별 인용 근거</span>
            <span v-if="latest">최근 {{ formatTime(latest.createdAt) }}</span>
            <ChevronDown :size="16" :class="{ open: showEvidence }" />
          </button>
          <div v-if="showEvidence" class="usage-table">
            <div class="usage-row head">
              <span>질문</span>
              <span>청크</span>
              <span>출처</span>
              <span>상태</span>
            </div>
            <div v-for="row in latestSamples" :key="row.id" class="usage-row">
              <span :title="row.question ?? ''">{{ shortQuestion(row.question ?? '질문 없음') }}</span>
              <span>{{ formatNumber(row.citedChunkCount) }}</span>
              <span>{{ formatNumber(row.sourceCount) }}</span>
              <span class="status-cell">{{ row.answerable ? '답변' : '근거 부족' }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.llm-panel {
  margin-top: 20px;
  padding: 22px 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.05);
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}
.estimate-badge {
  padding: 2px 7px;
  border-radius: 6px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
}
.panel-title {
  margin: 6px 0 4px;
  color: #1f2430;
  font-size: 18px;
  font-weight: 800;
}
.panel-sub {
  margin: 0;
  color: #717182;
  font-size: 13px;
}
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dbe3ef;
  border-radius: 7px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.empty-state {
  min-height: 116px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
}
.empty-state.error {
  border-color: #fecaca;
  background: #fff7f7;
  color: #b91c1c;
}
.empty-state strong,
.empty-state span {
  display: block;
}
.empty-state span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.metric-card {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 2px 10px;
  align-items: center;
  padding: 14px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fbfcfe;
}
.metric-icon {
  grid-row: span 3;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.metric-icon.token { background: #ecfdf5; color: #059669; }
.metric-icon.credit { background: #fff7ed; color: #ea580c; }
.metric-icon.call { background: #eff6ff; color: #2563eb; }
.metric-icon.chunk { background: #f5f3ff; color: #7c3aed; }
.metric-label {
  color: #717182;
  font-size: 12px;
  font-weight: 700;
}
.metric-card strong {
  color: #1f2430;
  font-size: 21px;
  line-height: 1.1;
}
.metric-card small {
  color: #94a3b8;
  font-size: 11px;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-top: 14px;
}
.credit-card,
.table-card {
  padding: 16px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fff;
}
.compare-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.compare-title-row h3 {
  margin: 0;
  color: #1f2430;
  font-size: 14px;
  font-weight: 800;
}
.compare-title-row span {
  color: #94a3b8;
  font-size: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 74px 1fr 90px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: #475569;
  font-size: 12px;
}
.bar-row strong {
  text-align: right;
  color: #1f2430;
}
.bar-track {
  height: 14px;
  border-radius: 5px;
  background: #f1f5f9;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: inherit;
}
.bar-fill.full { background: #ef4444; }
.bar-fill.rag { background: #2563eb; }
.evidence-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 0;
  color: #1f2430;
  font-size: 14px;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}
.evidence-toggle span:nth-child(2) {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}
.evidence-toggle svg {
  color: #64748b;
  transition: transform 0.18s ease;
}
.evidence-toggle svg.open {
  transform: rotate(180deg);
}
.usage-table {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 14px;
}
.usage-row {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) 64px 64px 44px;
  gap: 8px;
  align-items: center;
  position: relative;
  padding-bottom: 8px;
  color: #475569;
  font-size: 12px;
}
.usage-row.head {
  padding-bottom: 0;
  color: #94a3b8;
  font-weight: 800;
}
.usage-row span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-row .status-cell {
  color: #059669;
  font-weight: 800;
}
@media (max-width: 980px) {
  .panel-head,
  .compare-title-row {
    align-items: flex-start;
  }
  .metric-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
