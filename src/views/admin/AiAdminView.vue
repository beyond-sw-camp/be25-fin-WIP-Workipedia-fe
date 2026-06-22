<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { isAxiosError } from 'axios'
import { Bot } from '@lucide/vue'
import BaseToast from '@/components/common/BaseToast.vue'
import {
  getAiPromptSettings, updateAiPromptSettings,
  getAiTools, createAiTool, updateAiTool,
  editRoutingPromptInstruction,
  type AiTool, type ToolType, type HttpMethod,
} from '@/api/aiAdminApi'
import { getAdminDepartments, updateDepartmentRoutingPrompt, type AdminDepartment } from '@/api/adminApi'

type Section = 'prompt' | 'department' | 'tools'

const sections: { id: Section; label: string; group: string }[] = [
  { id: 'prompt', label: '프롬프트 관리', group: 'AI 설정' },
  { id: 'department', label: '부서 티켓 배정 관리', group: 'AI 설정' },
  { id: 'tools', label: 'API Tool 관리', group: 'AI 설정' },
]

const sectionNotices: Record<Section, { label: string; tone: 'optional' | 'required' | 'monitor'; title: string; description: string }> = {
  prompt: {
    label: '선택 설정',
    tone: 'optional',
    title: '사용자 정의 프롬프트는 필수가 아닙니다.',
    description: '비활성화하거나 등록하지 않으면 배포 시 고정된 base_prompt만 사용해 답변합니다.',
  },
  department: {
    label: '선택 설정',
    tone: 'optional',
    title: '배정 기준을 등록하지 않아도 티켓 기능은 정상 동작합니다.',
    description: '추천 근거가 없거나 점수가 부족한 티켓은 공통 접수 티켓으로 이동하며, 관리자가 담당 부서를 지정합니다.',
  },
  tools: {
    label: '선택 설정',
    tone: 'optional',
    title: 'API Tool은 고객사가 제공하는 연동 기능이 있을 때만 등록합니다.',
    description: '활성 Tool이 없으면 실시간 데이터 조회 단계를 건너뛰고 다음 RAG 또는 티켓 생성 단계로 이동합니다.',
  },
}

// localStorage에 마지막 활성 탭을 저장해 새로고침 후에도 탭을 유지한다.
// 저장된 값이 유효한 Section이 아닌 경우(직접 조작 등) 기본값 'prompt'로 폴백한다.
const VALID_SECTIONS: Section[] = ['prompt', 'department', 'tools']
const TAB_LS_KEY = 'workipedia_ai_admin_tab'
const storedTab = localStorage.getItem(TAB_LS_KEY) as Section | null
const activeSection = ref<Section>(storedTab && VALID_SECTIONS.includes(storedTab) ? storedTab : 'prompt')
watch(activeSection, (s) => localStorage.setItem(TAB_LS_KEY, s))

// ── 토스트 (BaseToast 공통 컴포넌트 사용) ──────────────────────
const toastVisible = ref(false)
const toastTitle = ref('')
const toastType = ref<'success' | 'error'>('success')
function showSaved(message: string, type: 'success' | 'error' = 'success') {
  toastTitle.value = message
  toastType.value = type
  toastVisible.value = true
}

// ── 프롬프트 관리 ────────────────────────────────────────────
const promptEnabled = ref(true)
const customPrompt = ref('')
const promptSaving = ref(false)

async function loadPromptSettings() {
  try {
    const res = await getAiPromptSettings()
    promptEnabled.value = res.data.enabled
    customPrompt.value = res.data.customPrompt ?? ''
  } catch { }
}

async function savePrompt() {
  if (promptSaving.value) return
  promptSaving.value = true
  try {
    await updateAiPromptSettings({ enabled: promptEnabled.value, customPrompt: customPrompt.value })
    showSaved('프롬프트를 저장했습니다.')
  } catch {
    showSaved('저장에 실패했습니다.', 'error')
  } finally {
    promptSaving.value = false
  }
}

// ── 부서 티켓 배정 관리 ──────────────────────────────────────
const adminDepts = ref<AdminDepartment[]>([])
const deptSearch = ref('')
// 카드 인라인 편집 상태
const editingDepartmentId = ref<number | null>(null)
const editingRr = ref('')
const deptSaving = ref(false)
// AI 일괄 수정 상태
const aiInstruction = ref('')
const aiLoading = ref(false)

const filteredDepts = computed(() => {
  const q = deptSearch.value.trim().toLowerCase()
  if (!q) return adminDepts.value
  return adminDepts.value.filter(d => d.departmentName.toLowerCase().includes(q))
})

const deptWithPromptCount = computed(() => adminDepts.value.filter(d => d.routingPrompt).length)

// BE가 반환하는 syncStatus로 카드 뱃지를 결정한다.
// PENDING/FAILED는 syncStatus 우선, 그 외에는 routingPrompt 유무로 활성/미설정을 구분한다.
function deptBadge(dept: AdminDepartment): { text: string; cls: string } {
  if (dept.syncStatus === 'PENDING') return { text: '동기화 대기', cls: 'department-badge--pending' }
  if (dept.syncStatus === 'FAILED')  return { text: '동기화 실패', cls: 'department-badge--failed' }
  if (dept.routingPrompt)            return { text: '활성',       cls: 'department-badge--active' }
  return                                    { text: '미설정',     cls: 'department-badge--empty' }
}

// 카드 하단에 표시할 동기화 상태 문구를 반환한다.
// SYNCED/FAILED는 syncInfo(BE 제공 날짜 문자열)를 포함해 표시하고, syncInfo가 null이면 날짜 없이 표시한다.
// EMPTY는 routingPrompt가 한 번도 등록된 적 없으므로 문구를 표시하지 않는다.
function deptSyncLabel(dept: AdminDepartment): string | null {
  if (dept.syncStatus === 'SYNCED')  return dept.syncInfo ? `마지막 동기화: ${dept.syncInfo}` : '동기화 완료'
  if (dept.syncStatus === 'PENDING') return '동기화 대기 중'
  if (dept.syncStatus === 'FAILED')  return dept.syncInfo ? `마지막 동기화 실패: ${dept.syncInfo}` : '동기화 실패'
  return null // EMPTY — 미표시
}

async function loadDepts() {
  try {
    const res = await getAdminDepartments()
    adminDepts.value = res.data
  } catch { }
}

function startDepartmentEdit(dept: AdminDepartment) {
  editingDepartmentId.value = dept.departmentId
  editingRr.value = dept.routingPrompt ?? ''
}

function cancelDepartmentEdit() {
  editingDepartmentId.value = null
  editingRr.value = ''
}

// routingPrompt를 저장하고, 성공 시 해당 카드를 낙관적으로 PENDING 상태로 전환한다.
// BE가 Vector Store 반영을 비동기로 처리하므로, 저장 직후에는 PENDING이 정확한 상태다.
// 실제 반영 완료(SYNCED) 또는 실패(FAILED) 여부는 다음 loadDepts 시 BE 값으로 갱신된다.
async function saveDepartmentEdit(dept: AdminDepartment) {
  if (deptSaving.value) return
  deptSaving.value = true
  try {
    await updateDepartmentRoutingPrompt(dept.departmentId, {
      routingPrompt: editingRr.value.trim(),
    })
    const idx = adminDepts.value.findIndex(d => d.departmentId === dept.departmentId)
    if (idx !== -1) {
      adminDepts.value[idx]!.routingPrompt = editingRr.value.trim() || null
      adminDepts.value[idx]!.syncStatus = 'PENDING'
      adminDepts.value[idx]!.syncInfo = '동기화 대기 중'
    }
    cancelDepartmentEdit()
    showSaved('R&R 프롬프트를 저장했습니다.')
  } catch {
    showSaved('저장에 실패했습니다.', 'error')
  } finally {
    deptSaving.value = false
  }
}

// syncStatus가 FAILED인 부서에 동일한 routingPrompt를 재전송해 Vector Store 재반영을 요청한다.
// routingPrompt가 없으면 BE @NotBlank 검증 오류가 발생하므로 전송을 차단한다.
async function retrySyncDept(dept: AdminDepartment) {
  if (!dept.routingPrompt) return  // @NotBlank — 빈 문자열 전송 방지
  dept.syncStatus = 'PENDING'
  dept.syncInfo = '재시도 요청됨'
  try {
    await updateDepartmentRoutingPrompt(dept.departmentId, {
      routingPrompt: dept.routingPrompt,
    })
    showSaved(`${dept.departmentName} 동기화를 다시 요청했습니다.`)
  } catch {
    dept.syncStatus = 'FAILED'
    dept.syncInfo = null  // 재시도 실패 시 syncInfo 초기화 — "마지막 동기화 실패: 재시도 요청됨" 방지
    showSaved(`${dept.departmentName} 저장에 실패했습니다.`, 'error')
  }
}

// AI 수정 지침을 BE에 전송하면, BE가 모든 부서의 routingPrompt를 일괄 수정하고 Vector Store 재반영을 예약한다.
// 목록을 갱신한 뒤, routingPrompt가 있는 부서를 낙관적으로 PENDING 상태로 전환해 UI에 즉시 반영한다.
async function applyAiInstruction() {
  if (!aiInstruction.value.trim() || aiLoading.value) return
  aiLoading.value = true
  try {
    await editRoutingPromptInstruction(aiInstruction.value.trim())
    await loadDepts()
    adminDepts.value.forEach(d => {
      if (d.routingPrompt) {
        d.syncStatus = 'PENDING'
        d.syncInfo = 'AI 수정 반영 후 동기화 대기 중'
      }
    })
    aiInstruction.value = ''
    showSaved('AI가 R&R을 수정했습니다.')
  } catch {
    showSaved('AI 수정에 실패했습니다.', 'error')
  } finally {
    aiLoading.value = false
  }
}

// ── API Tool 관리 ─────────────────────────────────────────────
const tools = ref<AiTool[]>([])
const toolFilter = ref('전체')
const toolModalOpen = ref(false)
const toolSaving = ref(false)
const toolForm = ref({
  name: '',
  description: '',
  toolType: 'HTTP_API' as ToolType,
  endpointUrl: '',
  httpMethod: 'GET' as HttpMethod,
  datasourceKey: '',
  queryTemplate: '',
  timeoutMs: 5000,
  maxResultCount: 100,
})
// parametersSchema 는 BE가 JSON 문자열로 요구하므로 저장 전 JSON 형식만 검증한다.
const toolParamsText = ref('')

const TOOL_TYPE_LABEL: Record<string, string> = { HTTP_API: 'HTTP API', DB_QUERY: 'DB Query' }
const APPROVAL_LABEL: Record<string, string> = { DRAFT: '검토 전', APPROVED: '승인', REJECTED: '반려' }

const filteredTools = computed(() => {
  if (toolFilter.value === '전체') return tools.value
  const typeMap: Record<string, string> = { 'HTTP API': 'HTTP_API', 'DB Query': 'DB_QUERY' }
  return tools.value.filter(t => t.toolType === typeMap[toolFilter.value])
})

async function loadTools() {
  try {
    const res = await getAiTools()
    tools.value = res.data.content
  } catch { }
}

async function toggleTool(tool: AiTool) {
  try {
    await updateAiTool(tool.aiToolId, { active: !tool.active })
    tool.active = !tool.active
  } catch {
    showSaved('상태 변경에 실패했습니다.')
  }
}

function resetToolForm() {
  toolForm.value = {
    name: '',
    description: '',
    toolType: 'HTTP_API',
    endpointUrl: '',
    httpMethod: 'GET',
    datasourceKey: '',
    queryTemplate: '',
    timeoutMs: 5000,
    maxResultCount: 100,
  }
  toolParamsText.value = ''
}

function readApiErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return null
  const data = error.response?.data
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message
  }
  return null
}

function isHttpEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname
  } catch {
    return false
  }
}

// parametersSchema 검증. 문제 없으면 null, 있으면 사용자에게 보여줄 메시지를 반환한다.
// 빈 스키마({}/properties 없음)는 AI가 입력 인자를 못 채워 Tool이 무동작하므로 막는다(#121).
function validateParamsSchema(text: string): string | null {
  if (!text) return 'Parameters JSON Schema를 입력하세요. 비어 있으면 AI가 입력 인자를 채울 수 없습니다.'
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return 'Parameters JSON 형식이 올바르지 않습니다.'
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'Parameters JSON Schema는 객체 형식이어야 합니다.'
  }
  const properties = (parsed as Record<string, unknown>).properties
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties) || Object.keys(properties).length === 0) {
    return 'properties에 파라미터를 1개 이상 정의하세요. (예: {"type":"object","properties":{"employeeId":{"type":"string","required":true}}})'
  }
  return null
}

async function saveTool() {
  if (toolSaving.value) return

  const endpointUrl = toolForm.value.endpointUrl.trim()
  const datasourceKey = toolForm.value.datasourceKey.trim()
  const queryTemplate = toolForm.value.queryTemplate.trim()
  if (toolForm.value.toolType === 'HTTP_API' && !isHttpEndpoint(endpointUrl)) {
    showSaved('Endpoint URL은 http:// 또는 https:// 로 시작하는 전체 URL이어야 합니다.')
    return
  }
  if (toolForm.value.toolType === 'DB_QUERY' && (!datasourceKey || !queryTemplate)) {
    showSaved('DB Query Tool은 datasourceKey와 queryTemplate이 필요합니다.')
    return
  }

  // parametersSchema가 비면 AI가 채울 입력 인자가 없어 외부 API가 파라미터 없이 호출된다(#121).
  // 그래서 빈 '{}' 통과를 막고 properties에 1개 이상 정의돼 있는지까지 검증한다.
  const schemaError = validateParamsSchema(toolParamsText.value.trim())
  if (schemaError) {
    showSaved(schemaError)
    return
  }
  const parametersSchema = toolParamsText.value.trim()

  toolSaving.value = true
  try {
    const commonPayload = {
      name: toolForm.value.name.trim(),
      description: toolForm.value.description.trim(),
      parametersSchema,
      timeoutMs: toolForm.value.timeoutMs,
      maxResultCount: toolForm.value.maxResultCount,
    }
    const res = await createAiTool(toolForm.value.toolType === 'HTTP_API'
      ? {
          ...commonPayload,
          toolType: 'HTTP_API',
          endpointUrl,
          httpMethod: toolForm.value.httpMethod,
          authType: 'NONE',
        }
      : {
          ...commonPayload,
          toolType: 'DB_QUERY',
          datasourceKey,
          queryTemplate,
          authType: 'NONE',
        })
    tools.value.unshift(res.data)
    toolModalOpen.value = false
    resetToolForm()
    showSaved('Tool을 등록했습니다.')
  } catch (error) {
    showSaved(readApiErrorMessage(error) ?? '등록에 실패했습니다.')
  } finally {
    toolSaving.value = false
  }
}

// ── 초기 로드 ─────────────────────────────────────────────────
onMounted(() => {
  loadPromptSettings()
  loadDepts()
  loadTools()
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Bot :size="28" color="#1f2430" />
        AI 관리 및 개발자 도구
      </h1>
      <p class="page-sub">AI 설정과 운영 품질을 한곳에서 관리합니다.</p>
    </div>

    <div class="tab-bar">
      <button
        v-for="section in sections"
        :key="section.id"
        :class="['tab', { 'tab--active': activeSection === section.id }]"
        @click="activeSection = section.id"
      >
        {{ section.label }}
      </button>
    </div>

    <div class="workspace-content">
      <BaseToast v-model="toastVisible" :title="toastTitle" :type="toastType" />

        <div class="requirement-notice" :class="`requirement-notice--${sectionNotices[activeSection].tone}`">
          <span class="requirement-label">{{ sectionNotices[activeSection].label }}</span>
          <div>
            <strong>{{ sectionNotices[activeSection].title }}</strong>
            <p>{{ sectionNotices[activeSection].description }}</p>
          </div>
        </div>

        <!-- ── 프롬프트 관리 ── -->
        <template v-if="activeSection === 'prompt'">
          <div class="workspace-title">
            <div>
              <h2>프롬프트 관리</h2>
              <p>고객사별 답변 방식과 추가 지침을 설정합니다.</p>
            </div>
            <button class="button button--primary" :disabled="promptSaving" @click="savePrompt">
              {{ promptSaving ? '저장 중...' : '저장' }}
            </button>
          </div>

          <div class="setting-block">
            <div class="setting-heading">
              <div>
                <h3>사용자 정의 프롬프트</h3>
                <p>기본 보안 정책 뒤에 추가되는 관리자 설정입니다.</p>
              </div>
              <label class="toggle">
                <input v-model="promptEnabled" type="checkbox" />
                <span></span>
              </label>
            </div>
            <textarea v-model="customPrompt" class="large-input" :disabled="!promptEnabled"></textarea>
            <div class="input-meta">
              <span>base_prompt는 배포 설정으로 고정됩니다.</span>
              <span>{{ customPrompt.length }} / 2,000</span>
            </div>
          </div>
        </template>

        <!-- ── 부서 티켓 배정 관리 ── -->
        <template v-else-if="activeSection === 'department'">
          <div class="workspace-title">
            <div>
              <h2>부서 티켓 배정 관리</h2>
              <p>티켓을 담당 부서에 추천·배정할 때 사용하는 R&R 설명을 관리합니다.</p>
            </div>
          </div>

          <!-- AI 일괄 수정 -->
          <div class="department-ai-box">
            <div class="setting-heading">
              <div>
                <h3>AI 일괄 수정</h3>
                <p>수정 지침을 입력하면 AI가 모든 부서의 R&R을 자동으로 수정합니다.</p>
              </div>
            </div>
            <div class="ai-input-row">
              <input
                v-model="aiInstruction"
                class="department-ai-input"
                placeholder="예: 각 부서 프롬프트에 응답 시간 기준(24시간 이내)을 추가해줘"
                @keyup.enter="applyAiInstruction"
              />
              <button class="button button--primary" :disabled="!aiInstruction.trim() || aiLoading" @click="applyAiInstruction">
                {{ aiLoading ? '적용 중...' : 'AI 수정 적용' }}
              </button>
            </div>
          </div>

          <!-- 부서 목록 헤더 -->
          <div class="department-section-header">
            <div>
              <h3>부서 목록</h3>
              <span>총 {{ adminDepts.length }}개 부서 · 활성 {{ deptWithPromptCount }} · 미설정 {{ adminDepts.length - deptWithPromptCount }}</span>
            </div>
            <input v-model="deptSearch" class="search-input" placeholder="부서명 검색" />
          </div>

          <!-- 부서 카드 그리드 -->
          <div class="department-grid">
            <article v-for="dept in filteredDepts" :key="dept.departmentId" class="department-card">
              <div class="department-card-top">
                <strong>{{ dept.departmentName }}</strong>
                <span :class="['department-badge', deptBadge(dept).cls]">
                  {{ deptBadge(dept).text }}
                </span>
              </div>

              <!-- 편집 모드 -->
              <template v-if="editingDepartmentId === dept.departmentId">
                <textarea
                  v-model="editingRr"
                  class="department-textarea"
                  placeholder="부서가 담당하는 역할·책임과 대표 티켓 범위를 입력하세요."
                />
                <div class="department-actions">
                  <button class="button button--secondary" @click="cancelDepartmentEdit">취소</button>
                  <button class="button button--primary" :disabled="deptSaving || !editingRr.trim()" @click="saveDepartmentEdit(dept)">
                    {{ deptSaving ? '저장 중...' : '저장' }}
                  </button>
                </div>
              </template>

              <!-- 보기 모드 -->
              <template v-else>
                <p class="department-prompt" :class="{ 'department-prompt--empty': !dept.routingPrompt }">
                  {{ dept.routingPrompt || '아직 R&R 프롬프트가 설정되지 않았습니다.' }}
                </p>
                <p v-if="deptSyncLabel(dept)" :class="['dept-sync-info', `dept-sync-info--${dept.syncStatus.toLowerCase()}`]">
                  {{ deptSyncLabel(dept) }}
                </p>
                <div class="department-actions">
                  <button
                    v-if="dept.syncStatus === 'FAILED'"
                    class="button department-btn-retry"
                    @click="retrySyncDept(dept)"
                  >
                    재시도
                  </button>
                  <button
                    class="button"
                    :class="dept.routingPrompt ? 'button--secondary' : 'button--primary'"
                    @click="startDepartmentEdit(dept)"
                  >
                    {{ dept.routingPrompt ? '편집' : '프롬프트 작성' }}
                  </button>
                </div>
              </template>
            </article>

            <div v-if="filteredDepts.length === 0" class="department-empty">
              부서 데이터가 없습니다.
            </div>
          </div>

          <div class="inline-note routing-note">
            부서 자체의 생성·삭제는 조직 관리에서 수행합니다. 이 화면에서는 R&R 프롬프트만 등록하고 수정합니다.
          </div>
        </template>

        <!-- ── API Tool 관리 ── -->
        <template v-else-if="activeSection === 'tools'">
          <div class="workspace-title">
            <div>
              <h2>API Tool 관리</h2>
              <p>등록된 API 명세를 런타임 Tool로 바인딩합니다. DB Query는 승인된 항목만 활성화할 수 있습니다.</p>
            </div>
            <button class="button button--primary" @click="toolModalOpen = true">Tool 등록</button>
          </div>
          <div class="toolbar">
            <div class="segmented">
              <button
                v-for="filter in ['전체', 'HTTP API', 'DB Query']"
                :key="filter"
                :class="{ active: toolFilter === filter }"
                @click="toolFilter = filter"
              >
                {{ filter }}
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="editable-table">
              <thead>
                <tr>
                  <th>Tool 이름 / 설명</th>
                  <th>유형</th>
                  <th>승인 상태</th>
                  <th>등록일</th>
                  <th>활성</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tool in filteredTools" :key="tool.aiToolId">
                  <td>
                    <strong>{{ tool.name }}</strong>
                    <small>{{ tool.description }}</small>
                  </td>
                  <td>{{ TOOL_TYPE_LABEL[tool.toolType] ?? tool.toolType }}</td>
                  <td>
                    <span :class="['badge', tool.approvalStatus === 'APPROVED' ? 'badge--green' : tool.approvalStatus === 'REJECTED' ? 'badge--gray' : 'badge--amber']">
                      {{ APPROVAL_LABEL[tool.approvalStatus] ?? tool.approvalStatus }}
                    </span>
                  </td>
                  <td>{{ tool.createdAt?.slice(0, 10) }}</td>
                  <td>
                    <label class="toggle">
                      <input :checked="tool.active" type="checkbox" @change="toggleTool(tool)" />
                      <span></span>
                    </label>
                  </td>
                </tr>
                <tr v-if="filteredTools.length === 0">
                  <td colspan="5" style="text-align: center; color: #b0b8c1; padding: 28px;">등록된 Tool이 없습니다.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
    </div>

    <!-- ── API Tool 등록 모달 ── -->
    <div v-if="toolModalOpen" class="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>API Tool 등록</h2>
          <button aria-label="닫기" @click="toolModalOpen = false; resetToolForm()">×</button>
        </div>
        <label>Tool 이름<input v-model="toolForm.name" placeholder="예: get_travel_expense" /></label>
        <label>설명<textarea v-model="toolForm.description" placeholder="LLM이 이 Tool을 선택해야 하는 조건을 입력하세요."></textarea></label>
        <div class="modal-grid">
          <label>유형
            <select v-model="toolForm.toolType">
              <option value="HTTP_API">HTTP API</option>
              <option value="DB_QUERY">DB Query</option>
            </select>
          </label>
          <label v-if="toolForm.toolType === 'HTTP_API'">HTTP Method
            <select v-model="toolForm.httpMethod">
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </label>
          <label v-else>Datasource Key
            <input v-model="toolForm.datasourceKey" placeholder="예: workipediaReadonly" />
          </label>
        </div>
        <label v-if="toolForm.toolType === 'HTTP_API'">Endpoint URL<input v-model="toolForm.endpointUrl" placeholder="https://internal-api.example.com/v1/..." /></label>
        <label v-else>Query Template
          <textarea
            v-model="toolForm.queryTemplate"
            class="code-input"
            placeholder="SELECT name FROM employee_vacations WHERE employee_id = :employeeId LIMIT 1"
          ></textarea>
        </label>
        <label>Parameters JSON Schema
          <textarea v-model="toolParamsText" class="code-input" placeholder='{"type":"object","properties":{"employeeId":{"type":"string","required":true}}}'></textarea>
          <small class="field-hint">필수 파라미터는 각 속성 안에 <code>"required": true</code>로 표기하세요. (BE 검증기는 최상위 <code>required</code> 배열을 인식하지 않습니다)</small>
        </label>
        <div class="modal-actions">
          <button class="button button--secondary" @click="toolModalOpen = false; resetToolForm()">취소</button>
          <button
            class="button button--primary"
            :disabled="!toolForm.name.trim() || !toolForm.description.trim() || !toolParamsText.trim() || (toolForm.toolType === 'HTTP_API' ? !toolForm.endpointUrl.trim() : !toolForm.datasourceKey.trim() || !toolForm.queryTemplate.trim()) || toolSaving"
            @click="saveTool"
          >
            {{ toolSaving ? '등록 중...' : '등록' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.requirement-notice { margin-bottom: 18px; padding: 14px 16px; border: 1px solid #cddceb; border-radius: 7px; background: #f4f8fc; display: flex; align-items: flex-start; gap: 12px; }
.requirement-label { flex-shrink: 0; padding: 4px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.requirement-notice strong { color: #2f465c; font-size: 12px; }
.requirement-notice p { margin-top: 5px; color: #667787; font-size: 11px; line-height: 1.5; }
.requirement-notice--optional .requirement-label { background: #dbeafa; color: #275f96; }
.requirement-notice--monitor { border-color: #d9dce0; background: #f7f8f9; }
.requirement-notice--monitor .requirement-label { background: #e8eaed; color: #59636d; }
.requirement-notice--required { border-color: #ead7a9; background: #fff9eb; }
.requirement-notice--required .requirement-label { background: #f6e4b7; color: #7c5812; }
.tab-bar { display: flex; border-bottom: 1px solid #dde1e7; margin-bottom: 24px; }
.tab { padding: 9px 20px; border: 1px solid transparent; border-bottom: none; border-radius: 6px 6px 0 0; background: #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; cursor: pointer; margin-right: 4px; position: relative; bottom: -1px; transition: background 0.15s, color 0.15s; }
.tab:hover:not(.tab--active) { background: #d0d9e8; color: #475569; }
.tab--active { background: #fff; color: #1e293b; border-color: #dde1e7; border-bottom-color: #fff; }
.workspace-content { position: relative; width: 100%; }
.workspace-title { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.workspace-title h2 { font-size: 20px; }
.workspace-title p { margin-top: 5px; color: #6d7782; font-size: 13px; }
.button { min-height: 36px; padding: 8px 14px; border: 1px solid transparent; border-radius: 5px; font-size: 13px; font-weight: 700; cursor: pointer; }
.button--primary { background: #1769c2; color: #fff; }
.button--primary:hover { background: #105daF; }
.button:disabled { background: #b9c2cb; color: #fff; cursor: not-allowed; }
.button--secondary { border-color: #cfd6dd; background: #fff; color: #33404d; }
.setting-block { padding: 20px; border: 1px solid #dfe4e8; border-radius: 7px; background: #fff; }
.setting-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.setting-block h3, .setting-heading h3 { font-size: 14px; }
.setting-heading p { margin-top: 4px; color: #76818c; font-size: 12px; }
.large-input { width: 100%; min-height: 150px; padding: 13px; border: 1px solid #ccd3da; border-radius: 5px; color: #25313d; font: inherit; font-size: 13px; line-height: 1.7; resize: vertical; }
.large-input:disabled { background: #f2f4f6; color: #9ba3aa; }
.input-meta { display: flex; justify-content: space-between; margin-top: 8px; color: #89939c; font-size: 11px; }
.toggle { display: inline-flex; cursor: pointer; }
.toggle input { position: absolute; opacity: 0; }
.toggle span { position: relative; width: 34px; height: 20px; border-radius: 10px; background: #c3cad1; transition: background .15s; }
.toggle span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.toggle input:checked + span { background: #1769c2; }
.toggle input:checked + span::after { transform: translateX(14px); }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.search-input { min-height: 36px; padding: 8px 11px; border: 1px solid #ccd3da; border-radius: 5px; background: #fff; color: #34404c; font-size: 12px; width: min(360px, 100%); }
.count-label { color: #79838d; font-size: 12px; }
.table-wrap { overflow: hidden; border: 1px solid #dfe4e8; border-radius: 7px; background: #fff; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { padding: 11px 14px; background: #f7f8fa; color: #6b7680; font-size: 11px; text-align: left; }
td { padding: 14px; border-top: 1px solid #e7eaed; color: #53606d; }
td strong { color: #26323e; }
td small { display: block; max-width: 280px; margin-top: 5px; color: #78838d; line-height: 1.45; }
code { padding: 2px 5px; border-radius: 3px; background: #f0f2f4; color: #485561; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
.method { color: #315f93; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 700; }
.text-button { padding: 4px 0; border: 0; background: transparent; color: #1769c2; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.badge--green { background: #e8f5ee; color: #27734b; display: inline-flex; padding: 4px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.badge--gray { background: #eceff2; color: #68727b; display: inline-flex; padding: 4px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.badge--amber { background: #fff4d9; color: #966300; display: inline-flex; padding: 4px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.metric-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.metric { min-height: 98px; padding: 16px; border: 1px solid #dfe4e8; border-radius: 7px; background: #fff; display: flex; flex-direction: column; }
.metric span { color: #77828c; font-size: 11px; }
.metric strong { margin-top: 9px; font-size: 24px; }
.segmented { display: inline-flex; padding: 3px; border: 1px solid #d7dce1; border-radius: 6px; background: #fff; }
.segmented button { min-height: 28px; padding: 5px 11px; border: 0; border-radius: 4px; background: transparent; color: #6c7782; font-size: 11px; cursor: pointer; }
.segmented button.active { background: #eaf2ff; color: #1759a8; font-weight: 700; }
.editable-table { min-width: 640px; }
/* Tool 표는 컨테이너보다 넓어지면 활성 토글 칸이 잘리므로 가로 스크롤 허용 */
.table-wrap:has(.editable-table) { overflow-x: auto; }
.editable-table th:last-child, .editable-table td:last-child { width: 72px; padding-right: 18px; white-space: nowrap; }
.prompt-excerpt { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 360px; color: #53606d; }
.inline-note { margin: 14px 0; padding: 10px 12px; border-left: 3px solid #75a1cf; background: #f3f7fb; color: #687683; font-size: 11px; line-height: 1.55; }
.routing-note { margin-top: 14px; }

/* 부서 카드 그리드 레이아웃 */
.department-ai-box { margin-bottom: 24px; padding: 20px 22px; border-radius: 8px; border: 1px solid #dde3ea; background: #f8fafc; }
.department-ai-box .setting-heading { margin-bottom: 14px; }
.department-ai-box h3 { font-size: 14px; font-weight: 700; color: #1f2430; margin: 0 0 3px; }
.department-ai-box p { font-size: 12px; color: #6d7782; margin: 0; }
.ai-input-row { display: flex; gap: 10px; }
.department-ai-input { flex: 1; min-height: 38px; padding: 8px 12px; border: 1px solid #ccd3da; border-radius: 6px; font: inherit; font-size: 13px; color: #26323d; }
.department-section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.department-section-header h3 { font-size: 15px; font-weight: 700; color: #1f2430; margin: 0; }
.department-section-header span { font-size: 12px; color: #8a939e; }
.department-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 18px; }
.department-card { padding: 18px 20px; border-radius: 8px; border: 1px solid #dde3ea; background: #fff; display: flex; flex-direction: column; gap: 10px; }
.department-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.department-card-top strong { font-size: 14px; font-weight: 700; color: #1f2430; }
.department-badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.department-badge--active  { background: #d1fae5; color: #059669; }
.department-badge--empty   { background: #f1f3f5; color: #8a939e; }
.department-badge--pending { background: #fef3c7; color: #d97706; }
.department-badge--failed  { background: #fee2e2; color: #ef4444; }
.department-prompt { font-size: 13px; color: #404055; line-height: 1.65; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.department-prompt--empty { color: #b0b8c1; font-style: italic; }
.department-member-count { font-size: 11px; color: #aeb2bb; margin: 0; }
.department-textarea { width: 100%; min-height: 100px; padding: 9px 11px; border: 1px solid #ccd3da; border-radius: 6px; font: inherit; font-size: 13px; color: #26323d; resize: vertical; }
.department-actions { display: flex; justify-content: flex-end; gap: 8px; }
.department-empty { grid-column: 1 / -1; text-align: center; padding: 40px 0; color: #b0b8c1; font-size: 14px; }
.dept-sync-info { font-size: 11px; margin: 0; color: #8a939e; }
.dept-sync-info--synced  { color: #8a939e; }
.dept-sync-info--pending { color: #d97706; }
.dept-sync-info--failed  { color: #ef4444; }
.department-btn-retry { border: 1px solid #ef4444; color: #ef4444; background: #fff; font-size: 12px; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
.department-btn-retry:hover { background: #fee2e2; }

.toast { position: fixed; z-index: 30; top: 22px; right: 24px; padding: 10px 14px; border-radius: 5px; background: #253341; color: #fff; font-size: 12px; box-shadow: 0 6px 18px rgba(0,0,0,.14); }
.modal-backdrop { position: fixed; z-index: 40; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(20,28,36,.45); }
.modal { width: min(480px, 100%); padding: 22px; border-radius: 7px; background: #fff; box-shadow: 0 16px 44px rgba(0,0,0,.22); display: flex; flex-direction: column; gap: 15px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; }
.modal-header h2 { font-size: 17px; }
.modal-header p { margin-top: 4px; color: #76818c; font-size: 11px; }
.modal-header button { width: 30px; height: 30px; border: 0; background: transparent; color: #66727d; font-size: 22px; cursor: pointer; }
.modal-notice { padding: 10px 12px; border-left: 3px solid #75a1cf; background: #f3f7fb; color: #627587; font-size: 10px; line-height: 1.5; }
.modal label { display: flex; flex-direction: column; gap: 6px; color: #52606c; font-size: 11px; font-weight: 700; }
.modal input, .modal select, .modal textarea { width: 100%; min-height: 38px; padding: 9px 10px; border: 1px solid #ccd3da; border-radius: 5px; background: #fff; color: #26323d; font: inherit; font-size: 12px; }
.modal textarea { min-height: 86px; resize: vertical; }
.modal .code-input { min-height: 120px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.field-hint { display: block; margin-top: 6px; color: #667787; font-size: 11px; line-height: 1.5; }
.field-hint code { padding: 1px 4px; border-radius: 3px; background: #eef1f5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
.modal--wide { width: min(620px, 100%); }
.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

@media (max-width: 800px) {
  .tab-bar { border-radius: 8px; }
  .workspace-title { align-items: flex-start; }
  .metric-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .table-wrap { overflow-x: auto; }
  table { min-width: 680px; }
}

@media (max-width: 520px) {
  .workspace-title { flex-direction: column; gap: 12px; }
  .metric-row { grid-template-columns: 1fr; }
  .toolbar { align-items: stretch; flex-direction: column; }
  .search-input { width: 100%; }
  .modal-grid { grid-template-columns: 1fr; }
}
</style>
