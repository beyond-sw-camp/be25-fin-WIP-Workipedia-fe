<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { isAxiosError } from 'axios'
import { Bot } from '@lucide/vue'
import {
  getAiPromptSettings, updateAiPromptSettings,
  getAiTools, createAiTool, updateAiTool,
  editRoutingPromptInstruction,
  type AiTool, type ToolType, type HttpMethod,
} from '@/api/aiAdminApi'
import { getAdminDepartments, type AdminDepartment } from '@/api/adminApi'

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
    description: '추천 근거가 없거나 점수가 부족한 티켓은 공통 접수 큐로 이동하며, 관리자가 담당 부서를 지정합니다.',
  },
  tools: {
    label: '선택 기능',
    tone: 'optional',
    title: 'API Tool은 고객사가 제공하는 연동 기능이 있을 때만 등록합니다.',
    description: '활성 Tool이 없으면 실시간 데이터 조회 단계를 건너뛰고 다음 RAG 또는 티켓 생성 단계로 이동합니다.',
  },
}

const activeSection = ref<Section>('prompt')

// ── 토스트 ──────────────────────────────────────────────────
const savedNotice = ref('')
function showSaved(message: string) {
  savedNotice.value = message
  window.setTimeout(() => { savedNotice.value = '' }, 1800)
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
    showSaved('저장에 실패했습니다.')
  } finally {
    promptSaving.value = false
  }
}

// ── 부서 티켓 배정 관리 ──────────────────────────────────────
const adminDepts = ref<AdminDepartment[]>([])
const deptSearch = ref('')
const departmentModalOpen = ref(false)
const editingDept = ref<AdminDepartment | null>(null)
const deptForm = ref({ departmentId: 0, routingPrompt: '' })
const deptSaving = ref(false)

const filteredDepts = computed(() => {
  const q = deptSearch.value.trim().toLowerCase()
  if (!q) return adminDepts.value
  return adminDepts.value.filter(d => d.departmentName.toLowerCase().includes(q))
})

const deptWithPromptCount = computed(() => adminDepts.value.filter(d => d.routingPrompt).length)
const unregisteredDepts = computed(() => adminDepts.value.filter(d => !d.routingPrompt))

async function loadDepts() {
  try {
    const res = await getAdminDepartments()
    adminDepts.value = res.data
  } catch { }
}

function openAddDeptModal() {
  editingDept.value = null
  deptForm.value = { departmentId: 0, routingPrompt: '' }
  departmentModalOpen.value = true
}

function openEditDeptModal(dept: AdminDepartment) {
  editingDept.value = dept
  deptForm.value = { departmentId: dept.departmentId, routingPrompt: dept.routingPrompt ?? '' }
  departmentModalOpen.value = true
}

async function saveDeptRouting() {
  if (!deptForm.value.departmentId || deptSaving.value) return
  const dept = adminDepts.value.find(d => d.departmentId === deptForm.value.departmentId)
  if (!dept) return
  deptSaving.value = true
  try {
    const instruction = `${dept.departmentName}: ${deptForm.value.routingPrompt}`
    const res = await editRoutingPromptInstruction(instruction)
    adminDepts.value = res.data
    departmentModalOpen.value = false
    showSaved('배정 기준을 저장했습니다.')
  } catch {
    showSaved('저장에 실패했습니다.')
  } finally {
    deptSaving.value = false
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

  // BE는 parametersSchema를 JSON 문자열로 받고 @NotBlank로 검증한다.
  const parametersSchema = toolParamsText.value.trim() || '{}'
  if (parametersSchema) {
    try {
      JSON.parse(parametersSchema)
    } catch {
      showSaved('Parameters JSON 형식이 올바르지 않습니다.')
      return
    }
  }

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
        AI 관리
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
      <div v-if="savedNotice" class="toast">{{ savedNotice }}</div>

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
              <p>티켓을 담당 부서에 추천·배정할 때 사용하는 라우팅 기준을 관리합니다.</p>
            </div>
            <button class="button button--primary" @click="openAddDeptModal">배정 기준 추가</button>
          </div>
          <div class="metric-row">
            <div class="metric"><span>전체 부서</span><strong>{{ adminDepts.length }}</strong></div>
            <div class="metric"><span>배정 기준 등록</span><strong>{{ deptWithPromptCount }}</strong></div>
            <div class="metric"><span>미등록 부서</span><strong>{{ adminDepts.length - deptWithPromptCount }}</strong></div>
          </div>
          <div class="toolbar">
            <input v-model="deptSearch" class="search-input" placeholder="부서명 검색" />
            <span class="count-label">전체 {{ filteredDepts.length }}개 부서</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>부서</th>
                  <th>라우팅 프롬프트</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="dept in filteredDepts" :key="dept.departmentId">
                  <td>
                    <strong>{{ dept.departmentName }}</strong>
                    <small>팀원 {{ dept.memberCount }}명</small>
                  </td>
                  <td>
                    <span v-if="dept.routingPrompt" class="prompt-excerpt">{{ dept.routingPrompt }}</span>
                    <span v-else style="color: #b0b8c1;">미등록</span>
                  </td>
                  <td>
                    <span v-if="dept.routingPrompt" class="badge badge--green">활성</span>
                    <span v-else class="badge badge--gray">미설정</span>
                  </td>
                  <td><button class="text-button" @click="openEditDeptModal(dept)">수정</button></td>
                </tr>
                <tr v-if="filteredDepts.length === 0">
                  <td colspan="4" style="text-align: center; color: #b0b8c1; padding: 28px;">부서 데이터가 없습니다.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="inline-note routing-note">
            부서 자체의 생성·삭제는 설정 페이지에서 수행합니다. 이 화면에서는 존재하는 부서를 선택해 AI 티켓 배정 기준만 등록합니다.
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

    <!-- ── 부서 배정 기준 모달 ── -->
    <div v-if="departmentModalOpen" class="modal-backdrop" @click.self="departmentModalOpen = false">
      <div class="modal modal--wide">
        <div class="modal-header">
          <div>
            <h2>{{ editingDept ? '배정 기준 수정' : '배정 기준 추가' }}</h2>
            <p>티켓 라우팅에 사용할 부서의 업무 범위를 등록합니다.</p>
          </div>
          <button aria-label="닫기" @click="departmentModalOpen = false">×</button>
        </div>
        <div class="modal-notice">선택 설정입니다. 미등록 부서와 신뢰도 기준을 통과하지 못한 티켓은 공통 접수 큐로 이동합니다.</div>

        <label>대상 부서
          <select v-model="deptForm.departmentId" :disabled="!!editingDept">
            <option :value="0" disabled>부서를 선택하세요</option>
            <template v-if="editingDept">
              <option :value="editingDept.departmentId">{{ editingDept.departmentName }}</option>
            </template>
            <template v-else>
              <option v-for="d in unregisteredDepts" :key="d.departmentId" :value="d.departmentId">
                {{ d.departmentName }}
              </option>
              <option v-if="unregisteredDepts.length === 0" :value="0" disabled>미등록 부서가 없습니다.</option>
            </template>
          </select>
        </label>

        <label>R&amp;R 설명 (라우팅 프롬프트)
          <textarea
            v-model="deptForm.routingPrompt"
            placeholder="예: 이 부서는 ERP 시스템 오류, 계정 권한, 배치 작업 관련 티켓을 처리합니다."
          ></textarea>
        </label>

        <div class="modal-actions">
          <button class="button button--secondary" @click="departmentModalOpen = false">취소</button>
          <button
            class="button button--primary"
            :disabled="!deptForm.departmentId || !deptForm.routingPrompt.trim() || deptSaving"
            @click="saveDeptRouting"
          >
            {{ deptSaving ? '저장 중...' : '저장' }}
          </button>
        </div>
      </div>
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
          <textarea v-model="toolParamsText" class="code-input" placeholder='{"type":"object","properties":{}}'></textarea>
        </label>
        <div class="modal-actions">
          <button class="button button--secondary" @click="toolModalOpen = false; resetToolForm()">취소</button>
          <button
            class="button button--primary"
            :disabled="!toolForm.name.trim() || !toolForm.description.trim() || (toolForm.toolType === 'HTTP_API' ? !toolForm.endpointUrl.trim() : !toolForm.datasourceKey.trim() || !toolForm.queryTemplate.trim()) || toolSaving"
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
.prompt-excerpt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 360px; color: #53606d; }
.inline-note { margin: 14px 0; padding: 10px 12px; border-left: 3px solid #75a1cf; background: #f3f7fb; color: #687683; font-size: 11px; line-height: 1.55; }
.routing-note { margin-top: 14px; }
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
