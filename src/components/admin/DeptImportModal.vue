<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseCsv, parseJson, type ParsedTable } from '@/utils/erpParser'
import {
  TARGET_FIELDS,
  suggestMapping,
  toCanonical,
  isMappingComplete,
  type Mapping,
  type ErpDepartmentItem,
} from '@/utils/erpMapping'
import {
  erpFetch,
  syncPreview,
  syncApply,
  type SyncPreviewResult,
  type SyncApplyResult,
  type MergeResolution,
} from '@/api/adminApi'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; applied: [] }>()

// 데모용 기본 ERP 엔드포인트 — 비워두고 직접 입력해도 됨
const DEFAULT_ERP_URL = 'https://weather.workipedia.wiki/api/v1/departments'

const step = ref(1)
const parsed = ref<ParsedTable>({ columns: [], rows: [] })
const sourceSystem = ref('ERP')
const sourceLabel = ref('')
const apiUrl = ref(DEFAULT_ERP_URL)
const srcTab = ref<'file' | 'api'>('file')
const loading = ref(false)
const errorMsg = ref('')

const mapping = ref<Mapping>({ externalId: null, departmentName: null, dutyDesc: null, useYn: null })
const items = ref<ErpDepartmentItem[]>([])
const diff = ref<SyncPreviewResult | null>(null)
const merges = ref<MergeResolution[]>([]) // 통폐합 수동 매칭은 후속. 기본 빈 배열.
const applyResult = ref<SyncApplyResult | null>(null)

const canProceedMapping = computed(() => isMappingComplete(mapping.value))

const STATE_LABEL: Record<string, string> = {
  NEW: '신설',
  RENAMED: '개명',
  MERGED: '통폐합',
  DELETED: '폐지',
  MATCHED: '변경없음',
  APPLIED: '적용됨',
}

watch(
  () => parsed.value.columns,
  (cols) => {
    if (cols.length) mapping.value = suggestMapping(cols)
  },
)

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  errorMsg.value = ''
  try {
    const text = await file.text()
    parsed.value = file.name.endsWith('.json') ? parseJson(text) : parseCsv(text)
    sourceLabel.value = `파일: ${file.name}`
    step.value = 2
  } catch {
    errorMsg.value = '파일을 읽지 못했습니다. 형식을 확인하세요.'
  }
}

async function onFetchApi() {
  if (!apiUrl.value.trim()) return
  loading.value = true
  errorMsg.value = ''
  try {
    parsed.value = await erpFetch(apiUrl.value.trim())
    sourceLabel.value = `API: ${apiUrl.value}`
    step.value = 2
  } catch {
    errorMsg.value = 'ERP API 조회에 실패했습니다. URL을 확인하세요.'
  } finally {
    loading.value = false
  }
}

async function goDiff() {
  items.value = toCanonical(parsed.value.rows, mapping.value)
  loading.value = true
  errorMsg.value = ''
  try {
    diff.value = await syncPreview(sourceSystem.value, items.value)
    step.value = 3
  } catch {
    errorMsg.value = '미리보기에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

const deletedRows = computed(() => (diff.value?.rows ?? []).filter((r) => r.state === 'DELETED'))

async function doApply() {
  loading.value = true
  errorMsg.value = ''
  try {
    applyResult.value = await syncApply({
      sourceSystem: sourceSystem.value,
      items: items.value,
      merges: merges.value,
      reassignTargetDepartmentId: null,
    })
    step.value = 5
    emit('applied')
  } catch {
    errorMsg.value = '반영에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

function reset() {
  step.value = 1
  parsed.value = { columns: [], rows: [] }
  items.value = []
  diff.value = null
  applyResult.value = null
  apiUrl.value = DEFAULT_ERP_URL
  errorMsg.value = ''
}
function close() {
  reset()
  emit('close')
}
</script>

<template>
  <div v-if="props.open" class="modal-backdrop" @click.self="close">
    <div class="modal">
      <header class="modal-head">
        <h3>ERP에서 부서 가져오기</h3>
        <button class="x" @click="close">✕</button>
      </header>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

      <!-- 1. 업로드 -->
      <section v-if="step === 1" class="step">
        <div class="seg">
          <button :class="{ on: srcTab === 'file' }" @click="srcTab = 'file'">파일 (CSV/JSON)</button>
          <button :class="{ on: srcTab === 'api' }" @click="srcTab = 'api'">API (URL)</button>
        </div>
        <div v-if="srcTab === 'file'" class="drop">
          <p>ERP에서 내보낸 부서 파일을 선택하세요.</p>
          <input type="file" accept=".csv,.json" @change="onFile" />
        </div>
        <div v-else class="apibox">
          <input
            v-model="apiUrl"
            type="text"
            placeholder="https://weather.workipedia.wiki/api/v1/departments"
            @keyup.enter="onFetchApi"
          />
          <button class="btn pri" :disabled="loading" @click="onFetchApi">
            {{ loading ? '가져오는 중…' : '가져오기' }}
          </button>
          <p class="hint">입력한 URL을 서버가 조회(JSON)해 같은 파이프라인으로 처리합니다.</p>
        </div>
      </section>

      <!-- 2. 매핑 -->
      <section v-else-if="step === 2" class="step">
        <p class="src">소스 — {{ sourceLabel }} (컬럼 {{ parsed.columns.length }} · 행 {{ parsed.rows.length }})</p>
        <div v-for="f in TARGET_FIELDS" :key="f.key" class="maprow">
          <label>{{ f.label }} <span v-if="f.required" class="req">필수</span></label>
          <select v-model="mapping[f.key]">
            <option :value="null">— 선택 안 함 —</option>
            <option v-for="c in parsed.columns" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="actions">
          <button class="btn" @click="step = 1">← 이전</button>
          <button class="btn pri" :disabled="!canProceedMapping || loading" @click="goDiff">
            {{ loading ? '확인 중…' : '다음 →' }}
          </button>
        </div>
      </section>

      <!-- 3. diff -->
      <section v-else-if="step === 3" class="step">
        <h4>변경 검토</h4>
        <div v-if="diff" class="difflist">
          <div v-for="r in diff.rows" :key="r.externalId" class="diffrow" :data-state="r.state">
            <span class="badge" :data-state="r.state">{{ STATE_LABEL[r.state] }}</span>
            <span class="nm">
              <template v-if="r.previousName">{{ r.previousName }} → </template>{{ r.departmentName }}
            </span>
            <span v-if="r.memberMoveCount > 0" class="move">👥 {{ r.memberMoveCount }}명</span>
            <span class="eid">{{ r.externalId }}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn" @click="step = 2">← 이전</button>
          <button class="btn pri" @click="step = 4">R&amp;R 처리 →</button>
        </div>
      </section>

      <!-- 4. R&R -->
      <section v-else-if="step === 4" class="step">
        <h4>R&amp;R(담당업무) 처리</h4>
        <p class="hint">반영 대상: department_routing_prompts → ai_sync_jobs(DEPT_RR) 재동기화</p>
        <ul v-if="deletedRows.length" class="rrlist">
          <li v-for="r in deletedRows" :key="r.externalId">
            🔴 {{ r.departmentName }} 폐지 — 소속 {{ r.memberMoveCount }}명
          </li>
        </ul>
        <p v-else class="hint">검토가 필요한 폐지/통폐합 건이 없습니다.</p>
        <div class="actions">
          <button class="btn" @click="step = 3">← 이전</button>
          <button class="btn pri" :disabled="loading" @click="doApply">
            {{ loading ? '반영 중…' : '적용하기 ✓' }}
          </button>
        </div>
      </section>

      <!-- 5. 완료 -->
      <section v-else-if="step === 5" class="step done">
        <div class="ic">✅</div>
        <h4>부서 동기화 완료</h4>
        <p v-if="applyResult">
          신설 {{ applyResult.created }} · 수정 {{ applyResult.updated }} · 폐지 {{ applyResult.deleted }} ·
          통폐합 {{ applyResult.merged }} · 사원 {{ applyResult.membersReassigned }}명 이동
        </p>
        <div class="actions">
          <button class="btn pri" @click="close">닫기</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  background: #fff;
  border-radius: 14px;
  width: min(720px, 92vw);
  max-height: 88vh;
  overflow: auto;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #eee;
}
.modal-head h3 {
  font-size: 16px;
  font-weight: 700;
}
.x {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #888;
}
.err {
  margin: 12px 22px 0;
  padding: 9px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  font-size: 13px;
}
.step {
  padding: 22px;
}
.step h4 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
}
.seg {
  display: flex;
  gap: 6px;
  background: #f3f1f6;
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 18px;
}
.seg button {
  flex: 1;
  border: none;
  background: none;
  padding: 9px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
}
.seg button.on {
  background: #fff;
  color: #a855f7;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.drop {
  border: 2px dashed #d6cfe3;
  border-radius: 12px;
  padding: 28px;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}
.drop input {
  margin-top: 14px;
}
.apibox {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.apibox input {
  padding: 11px 13px;
  border: 1px solid #e5e1ea;
  border-radius: 9px;
  font-size: 13px;
}
.hint {
  font-size: 12px;
  color: #9ca3af;
}
.src {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 14px;
}
.maprow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid #f1f1f1;
}
.maprow label {
  font-size: 13px;
  font-weight: 600;
}
.req {
  font-size: 10px;
  color: #dc2626;
  font-weight: 700;
}
.maprow select {
  padding: 8px 10px;
  border: 1px solid #e5e1ea;
  border-radius: 8px;
  font-size: 13px;
}
.difflist {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.diffrow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 9px;
}
.diffrow .nm {
  font-weight: 600;
  font-size: 14px;
}
.diffrow .move {
  font-size: 12px;
  color: #d97706;
}
.diffrow .eid {
  margin-left: auto;
  font-size: 11px;
  color: #b3aabd;
  font-family: ui-monospace, monospace;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f3f4f6;
  color: #374151;
}
.badge[data-state='NEW'] {
  background: #ecfdf3;
  color: #16a34a;
}
.badge[data-state='RENAMED'] {
  background: #fffbeb;
  color: #d97706;
}
.badge[data-state='DELETED'] {
  background: #fef2f2;
  color: #dc2626;
}
.badge[data-state='MERGED'] {
  background: #f5f3ff;
  color: #7c3aed;
}
.rrlist {
  margin: 4px 0 0;
  padding-left: 4px;
  list-style: none;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  gap: 10px;
}
.btn {
  padding: 10px 18px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #e5e1ea;
  background: #fff;
  color: #1f2430;
}
.btn.pri {
  background: #a855f7;
  color: #fff;
  border-color: #a855f7;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.done {
  text-align: center;
}
.done .ic {
  font-size: 44px;
}
.done .actions {
  justify-content: center;
}
</style>
