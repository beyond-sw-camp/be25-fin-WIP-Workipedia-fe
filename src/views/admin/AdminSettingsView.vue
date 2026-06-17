<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import {
  Users, FileText, Plus, Edit2, Trash2, Upload, CheckCircle,
  Search, Building2, LogIn, MessageCircle, X, Settings, Timer, ExternalLink,
} from '@lucide/vue'
import BaseToast from '@/components/common/BaseToast.vue'
import {
  getDashboardSummary, getAdminUsers, updateUserStatus,
  getAdminManuals, createAdminManual, updateAdminManual, updateAdminManualMeta, deleteAdminManual,
  getAdminDepartments, createAdminDepartment, updateAdminDepartment, deleteAdminDepartment,
  getAdminPoints, deductAdminPoints,
  getChatPolicy, updateChatPolicy,
  getAdminDirectData, createAdminDirectData, updateAdminDirectData, deleteAdminDirectData,
  type DashboardSummary, type AdminUser, type AdminManual, type AdminDepartment, type AdminPointUser,
  type AdminDirectData,
} from '@/api/adminApi'
import { getManualDetail } from '@/api/manualApi'

const auth = useAuthStore()

type Tab = 'manual' | 'knowledge' | 'departments' | 'users' | 'points' | 'chat' | 'script'
const activeTab = ref<Tab>('manual')

// ── Toast ──────────────────────────────────────────────────────
// showToast 함수로 저장·삭제·오류 결과를 한 곳에서 처리한다. BaseToast는 v-model로 가시성을 제어한다.
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

// ── Scroll helpers ─────────────────────────────────────────────
// 각 섹션의 폼/목록 DOM에 접근해 저장·수정 후 해당 위치로 자동 스크롤한다.
const manualListRef = ref<HTMLElement | null>(null)
const manualFormRef = ref<HTMLElement | null>(null)
const deptListRef = ref<HTMLElement | null>(null)
const deptFormRef = ref<HTMLElement | null>(null)
const deductFormRef = ref<HTMLElement | null>(null)

// ── Stats ──────────────────────────────────────────────────────
const stats = ref<DashboardSummary | null>(null)
async function loadDashboard() {
  try {
    const res = await getDashboardSummary()
    stats.value = res.data
  } catch { /* 통계 로드 실패 시 null 유지 */ }
}

// ── 사용자 관리 ────────────────────────────────────────────────
const adminUsers = ref<AdminUser[]>([])
const usersLoading = ref(false)
const userSearchQuery = ref('')
// 사번·닉네임·부서명 중 하나라도 쿼리를 포함하면 표시한다. 최근 로그인 순으로 정렬해 활성 사용자를 상단에 배치한다.
const filteredUsers = computed(() => {
  const q = userSearchQuery.value.toLowerCase()
  return adminUsers.value
    .filter(u =>
      !q ||
      String(u.employeeId ?? '').toLowerCase().includes(q) ||
      String(u.nickname ?? '').toLowerCase().includes(q) ||
      String(u.departmentName ?? '').toLowerCase().includes(q)
    )
    .sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime())
})
// users 탭 최초 진입 시 watch에서 한 번만 호출한다 (loadedTabs 참고).
async function loadUsers() {
  usersLoading.value = true
  try {
    const res = await getAdminUsers()
    adminUsers.value = res.data.content
  } catch (err) {
    console.error('[loadUsers]', err)
  } finally {
    usersLoading.value = false
  }
}
// ACTIVE/INACTIVE를 토글한다. API 성공 후 전체 재로드 대신 로컬 배열을 직접 수정해 깜박임을 줄인다.
async function toggleUserStatus(userId: number, current: 'ACTIVE' | 'INACTIVE') {
  const next = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    await updateUserStatus(userId, next)
    const u = adminUsers.value.find(u => u.userId === userId)
    if (u) u.status = next
    showToast(next === 'ACTIVE' ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.')
  } catch {
    showToast('상태 변경에 실패했습니다.', '', 'error')
  }
}

// ── 매뉴얼 관리 ────────────────────────────────────────────────
const adminManuals = ref<AdminManual[]>([])
const manualsLoading = ref(false)
const existingFileMap = ref(new Map<string, { manualId: number; title: string }>())
const manualSearchQuery = ref('')
const filteredManuals = computed(() =>
  adminManuals.value.filter(m =>
    m.title.toLowerCase().includes(manualSearchQuery.value.toLowerCase()) ||
    (m.description ?? '').toLowerCase().includes(manualSearchQuery.value.toLowerCase())
  )
)
type EditManual = {
  id?: number
  title: string
  description: string
  category?: string
  currentVersion?: string | null
  originalFileCount?: number
  departmentId: number | null
  currentFileUrl?: string | null
}
const editingManual = ref<EditManual | null>(null)
const uploadedFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const fileError = ref(false)
const fileConflict = ref(false)
// PDF 업로드+매뉴얼 생성 요청이 진행 중인지 추적. 더블클릭·네트워크 재시도로 인한 중복 요청을 차단한다.
const manualSubmitting = ref(false)

// ── 파일 중복 감지 (SHA-256 콘텐츠 해시 기반 localStorage) ──────
// 동일 파일을 여러 매뉴얼에 등록하는 것을 막기 위해 SHA-256 콘텐츠 해시를 키로 localStorage에 저장한다.
// 파일 이름이 달라도 내용이 같으면 감지되며, 브라우저 세션을 넘어 누적된다.
const MANUAL_FILES_KEY = 'admin_manual_file_registry'
type FilesRegistry = Record<string, { manualId: number; title: string; fileName?: string }>
function getFilesRegistry(): FilesRegistry {
  try { return JSON.parse(localStorage.getItem(MANUAL_FILES_KEY) ?? '{}') } catch { return {} }
}
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function registerManualFile(manualId: number, title: string, file: File) {
  const hash = await hashFile(file)
  const reg = getFilesRegistry()
  reg[hash] = { manualId, title, fileName: file.name }
  localStorage.setItem(MANUAL_FILES_KEY, JSON.stringify(reg))
}
function unregisterManualFiles(manualId: number) {
  const reg = getFilesRegistry()
  for (const key of Object.keys(reg)) {
    if (reg[key]?.manualId === manualId) delete reg[key]
  }
  localStorage.setItem(MANUAL_FILES_KEY, JSON.stringify(reg))
}
// 업로드된 파일 전체가 기존 매뉴얼과 중복 → fileConflict=true로 저장 버튼 비활성화
// 일부만 중복 → 안내 토스트만 표시(저장은 허용). skipId: 수정 중인 매뉴얼 자신의 파일은 제외.
// checkFileDuplicates는 해시 레지스트리(localStorage)와 existingFileMap(초기 로딩 시 구성) 둘 다 확인한다.
async function checkFileDuplicates(files: File[]) {
  const reg = getFilesRegistry()
  const fileMap = existingFileMap.value
  const skipId = editingManual.value?.id

  const results = await Promise.all(
    files.map(async f => {
      const hash = await hashFile(f)
      const hashEntry = reg[hash]
      const nameEntry = fileMap.get(f.name)
      const byHash = hashEntry && hashEntry.manualId !== skipId ? hashEntry : null
      const byName = nameEntry && nameEntry.manualId !== skipId ? nameEntry : null
      return { file: f, entry: byHash ?? byName ?? null }
    })
  )

  const matched = results.filter(r => r.entry !== null)
  const unmatched = results.filter(r => r.entry === null)

  if (matched.length === 0) { fileConflict.value = false; return }

  if (unmatched.length === 0) {
    fileConflict.value = true
    const manualNames = [...new Set(matched.map(r => `"${r.entry!.title}"`))]
    showToast(
      '이미 존재하는 매뉴얼',
      `${manualNames.join(', ')} 매뉴얼에 이미 업로드된 파일입니다. 기존 매뉴얼을 수정해주세요.`,
      'error'
    )
  } else {
    fileConflict.value = false
    const msgs = matched
      .map(r => `"${r.file.name}"은(는) "${r.entry!.title}"에 이미 업로드된 파일입니다`)
      .join(' / ')
    showToast('파일 중복 안내', msgs, 'success')
  }
}

// S3 URL에서 파일명만 추출. 경로 마지막 세그먼트에서 쿼리스트링을 제거하고 URL 디코딩한다.
function extractFileName(url: string | null | undefined): string {
  if (!url) return ''
  try { return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '') } catch { return '' }
}
// API가 fileUrl을 반환하지 않을 때 수정 폼 "현재 파일" 란을 채우기 위해 레지스트리에서 파일명을 조회한다.
function getRegistryFilesByManualId(manualId: number): string[] {
  const reg = getFilesRegistry()
  return Object.entries(reg)
    .filter(([, e]) => e?.manualId === manualId)
    .map(([key, e]) => e!.fileName ?? key)
}

// "v1" / "1.0" / "v1.0" 등 다양한 버전 형식을 major/minor 숫자로 정규화한다.
// calcNextVersion: 파일 수가 바뀌면 메이저 증가(v2.0), 이외에는 마이너 증가(v1.1).
// fmtVersion: 저장된 임의 형식을 화면 표시용 "vN.M" 으로 통일한다.
function parseVersion(v: string | null | undefined): { major: number; minor: number } {
  const withDot = (v ?? '').match(/v?(\d+)\.(\d+)/)
  if (withDot) return { major: parseInt(withDot[1]!), minor: parseInt(withDot[2]!) }
  const onlyMajor = (v ?? '').match(/v?(\d+)/)
  if (onlyMajor) return { major: parseInt(onlyMajor[1]!), minor: 0 }
  return { major: 1, minor: 0 }
}
function calcNextVersion(current: string | null | undefined, fileCountChanged: boolean): string {
  const { major, minor } = parseVersion(current)
  return fileCountChanged ? `v${major + 1}.0` : `v${major}.${minor + 1}`
}
function fmtVersion(v: string | null | undefined): string | null {
  if (!v) return null
  const { major, minor } = parseVersion(v)
  return `v${major}.${minor}`
}
// 신규 매뉴얼 폼을 초기화한 뒤 폼 DOM으로 스크롤한다. nextTick은 v-if가 DOM을 렌더링한 후 ref가 유효해지는 시점을 보장한다.
function openManualForm() {
  editingManual.value = { title: '', description: '', category: '인사 관리', departmentId: null }
  uploadedFiles.value = []
  fileError.value = false
  fileConflict.value = false
  nextTick(() => manualFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
async function openEditManualForm(m: AdminManual) {
  editingManual.value = {
    id: m.manualId,
    title: m.title,
    description: m.description ?? '',
    category: m.category,
    currentVersion: m.version,
    originalFileCount: 1,
    departmentId: m.departmentId ?? null,
    currentFileUrl: m.fileUrl ?? null,
  }
  uploadedFiles.value = []
  fileError.value = false
  fileConflict.value = false
  nextTick(() => manualFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  // 목록 API는 fileUrl을 포함하지 않는 경우가 있어, 폼을 열 때 상세 API를 별도 호출해 fileUrl을 보완한다.
  // 스크롤은 즉시, fileUrl 갱신은 비동기로 처리해 UX 지연을 최소화한다.
  if (!m.fileUrl) {
    try {
      const res = await getManualDetail(m.manualId)
      if (editingManual.value?.id === m.manualId) {
        editingManual.value = { ...editingManual.value, currentFileUrl: res.data.fileUrl ?? null }
      }
    } catch { /* silent */ }
  }
}
// 파일 선택 즉시 중복 검사를 실행한다. 저장 버튼을 누르기 전에 사용자에게 피드백을 주기 위함이다.
async function handleManualFileUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) {
    uploadedFiles.value = Array.from(files)
    fileError.value = false
    await checkFileDuplicates(uploadedFiles.value)
  }
}
function fmtDate(dt: string) {
  return dt.replace('T', ' ').slice(0, 19)
}
// 매뉴얼 목록을 로드하고 파일 중복 감지용 인메모리 맵을 재구성한다.
// buildExistingFileMap은 finally에서 호출해 에러 시에도 맵이 초기화되도록 한다.
async function loadManuals() {
  manualsLoading.value = true
  try {
    const res = await getAdminManuals()
    adminManuals.value = res.data.content
  } catch (err) {
    console.error('[loadManuals]', err)
  } finally {
    buildExistingFileMap(adminManuals.value)
    manualsLoading.value = false
  }
}

// 어드민 목록 응답에 fileUrl이 포함된 항목만 인메모리 맵에 등록한다.
// fileUrl이 없는 항목에 대해 /manuals/{id}를 추가 호출하던 로직은 삭제된 매뉴얼에서 404가 발생해 제거했다.
// 주요 중복 감지는 SHA-256 기반 localStorage 레지스트리로 충분히 커버된다.
function buildExistingFileMap(manuals: AdminManual[]) {
  const map = new Map<string, { manualId: number; title: string }>()
  for (const m of manuals) {
    const name = extractFileName(m.fileUrl)
    if (name) map.set(name, { manualId: m.manualId, title: m.title })
  }
  existingFileMap.value = map
}
async function saveManual() {
  if (!editingManual.value) return
  if (manualSubmitting.value) return
  if (!editingManual.value.title.trim()) {
    showToast('매뉴얼 제목을 입력해주세요.', '', 'error')
    return
  }
  if (!editingManual.value.id && uploadedFiles.value.length === 0) {
    fileError.value = true
    return
  }
  // fileConflict는 checkFileDuplicates에서 설정. 템플릿의 :disabled와 이중으로 막아 저장을 방지한다.
  if (fileConflict.value) {
    showToast('이미 존재하는 매뉴얼', '동일한 파일이 이미 업로드된 매뉴얼이 있습니다. 기존 매뉴얼을 수정해주세요.', 'error')
    return
  }
  manualSubmitting.value = true
  try {
    if (editingManual.value.id) {
      // 파일 교체(파일 수 변경) → 메이저 버전 증가, 제목·설명만 수정 → 마이너 버전 증가
      const origCount = editingManual.value.originalFileCount ?? 1
      const newCount = uploadedFiles.value.length > 0 ? uploadedFiles.value.length : origCount
      const fileCountChanged = newCount !== origCount
      const nextVer = calcNextVersion(editingManual.value.currentVersion, fileCountChanged)
      const hasNewFile = uploadedFiles.value.length > 0
      if (hasNewFile) {
        const formData = new FormData()
        formData.append('title', editingManual.value.title)
        formData.append('description', editingManual.value.description)
        formData.append('version', nextVer)
        for (const file of uploadedFiles.value) {
          formData.append('file', file)
        }
        if (editingManual.value.departmentId != null) {
          formData.append('departmentId', String(editingManual.value.departmentId))
        }
        await updateAdminManual(editingManual.value.id, formData)
      } else {
        await updateAdminManualMeta(editingManual.value.id, {
          title: editingManual.value.title,
          version: nextVer,
          departmentId: editingManual.value.departmentId,
        })
      }
      showToast(`매뉴얼이 수정되었습니다. (${nextVer})`)
      editingManual.value = null
      uploadedFiles.value = []
      await loadManuals()
    } else {
      // 여러 파일 선택 시 파일마다 별도 매뉴얼을 생성하고 각각 레지스트리에 등록한다.
      const newManuals: AdminManual[] = []
      for (const file of uploadedFiles.value) {
        const formData = new FormData()
        formData.append('title', editingManual.value.title)
        formData.append('description', editingManual.value.description)
        formData.append('version', 'v1.0')
        formData.append('file', file)
        if (editingManual.value.departmentId != null) {
          formData.append('departmentId', String(editingManual.value.departmentId))
        }
        const createRes = await createAdminManual(formData)
        const created = createRes.data
        if (created?.manualId) {
          newManuals.push(created)
          await registerManualFile(created.manualId, created.title, file)
        }
      }
      const fileCount = uploadedFiles.value.length
      editingManual.value = null
      uploadedFiles.value = []
      fileConflict.value = false
      if (newManuals.length > 0) {
        adminManuals.value = [...adminManuals.value, ...newManuals]
      } else {
        await loadManuals()
      }
      showToast(fileCount > 1
        ? `${fileCount}개의 매뉴얼이 추가되었습니다.`
        : '새 매뉴얼이 추가되었습니다.'
      )
    }
    await nextTick()
    const last = manualListRef.value?.lastElementChild
    last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    console.error('[saveManual]', err)
    showToast('매뉴얼 저장에 실패했습니다.', msg ?? '', 'error')
  } finally {
    manualSubmitting.value = false
  }
}
const deleteManualId = ref<number | null>(null)
// 삭제 시 레지스트리에서도 해당 매뉴얼의 해시를 제거해, 같은 파일을 재업로드할 때 오탐을 방지한다.
async function confirmDeleteManual() {
  if (!deleteManualId.value) return
  try {
    await deleteAdminManual(deleteManualId.value)
    unregisterManualFiles(deleteManualId.value)
    adminManuals.value = adminManuals.value.filter(m => m.manualId !== deleteManualId.value)
    showToast('매뉴얼이 삭제되었습니다.')
  } catch {
    showToast('매뉴얼 삭제에 실패했습니다.', '', 'error')
  }
  deleteManualId.value = null
}

// ── 부서 관리 ──────────────────────────────────────────────────
const adminDepts = ref<AdminDepartment[]>([])
const deptsLoading = ref(false)
type EditDept = { id?: number; name: string; routingPrompt: string }
const editingDept = ref<EditDept | null>(null)
async function loadDepts() {
  deptsLoading.value = true
  try {
    const res = await getAdminDepartments()
    adminDepts.value = res.data
  } catch { /* 초기 로딩 실패는 조용히 처리 */ } finally {
    deptsLoading.value = false
  }
}
function openDeptForm() {
  editingDept.value = { name: '', routingPrompt: '' }
  nextTick(() => deptFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function openDeptEdit(d: AdminDepartment) {
  editingDept.value = { id: d.departmentId, name: d.departmentName, routingPrompt: d.routingPrompt ?? '' }
  nextTick(() => deptFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
async function saveDept() {
  if (!editingDept.value?.name.trim()) { showToast('부서명을 입력해주세요.', '', 'error'); return }
  try {
    if (editingDept.value.id) {
      const targetId = editingDept.value.id
      const name = editingDept.value.name
      const routingPrompt = editingDept.value.routingPrompt
      await updateAdminDepartment(targetId, { departmentName: name, routingPrompt })
      const idx = adminDepts.value.findIndex(d => d.departmentId === targetId)
      if (idx !== -1) {
        const cur = adminDepts.value[idx]
        if (cur) adminDepts.value[idx] = { ...cur, departmentName: name, routingPrompt: routingPrompt || null }
      }
      showToast('부서가 수정되었습니다.')
      editingDept.value = null
    } else {
      await createAdminDepartment({ departmentName: editingDept.value.name })
      showToast('부서가 추가되었습니다.')
      editingDept.value = null
      await loadDepts()
      await nextTick()
      const last = deptListRef.value?.lastElementChild
      last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  } catch {
    showToast('부서 저장에 실패했습니다.', '', 'error')
  }
}
const deleteDeptId = ref<number | null>(null)
async function confirmDeleteDept() {
  if (!deleteDeptId.value) return
  try {
    await deleteAdminDepartment(deleteDeptId.value)
    adminDepts.value = adminDepts.value.filter(d => d.departmentId !== deleteDeptId.value)
    showToast('부서가 삭제되었습니다.')
  } catch {
    showToast('부서 삭제에 실패했습니다.', '', 'error')
  }
  deleteDeptId.value = null
}
const totalMembers = computed(() => adminDepts.value.reduce((s, d) => s + (d.memberCount ?? 0), 0))

// ── 포인트 관리 ────────────────────────────────────────────────
const pointUsers = ref<AdminPointUser[]>([])
const pointsLoading = ref(false)
const pointUserSearch = ref('')
const selectedUser = ref<AdminPointUser | null>(null)
const pointsToDeduct = ref('')
const deductReason = ref('')
// 검색어가 없으면 빈 배열 반환 — 탭 진입 시 전체 목록이 펼쳐지는 것을 방지한다.
const pointSearchResults = computed(() => {
  const q = pointUserSearch.value.toLowerCase()
  return q
    ? pointUsers.value.filter(u =>
        u.employeeId.toLowerCase().includes(q) ||
        u.nickname.toLowerCase().includes(q)
      )
    : []
})
async function loadPoints() {
  pointsLoading.value = true
  try {
    const res = await getAdminPoints()
    pointUsers.value = res.data.content
  } catch { /* 초기 로딩 실패는 조용히 처리 */ } finally {
    pointsLoading.value = false
  }
}
function selectUser(u: AdminPointUser) {
  selectedUser.value = u
  nextTick(() => deductFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
// 포인트 차감. API 성공 후 전체 재로드 대신 로컬 배열을 직접 수정해 응답성을 높인다.
async function deductPoints() {
  if (!selectedUser.value || !pointsToDeduct.value || !deductReason.value) {
    showToast('사용자, 포인트, 사유를 모두 입력해주세요.', '', 'error'); return
  }
  const pts = parseInt(pointsToDeduct.value)
  if (isNaN(pts) || pts <= 0) { showToast('올바른 포인트를 입력해주세요.', '', 'error'); return }
  if (pts > selectedUser.value.currentPoint) { showToast('현재 포인트보다 많은 포인트를 차감할 수 없습니다.', '', 'error'); return }
  try {
    await deductAdminPoints(selectedUser.value.employeeId, { amount: pts, reason: deductReason.value })
    const u = pointUsers.value.find(u => u.userId === selectedUser.value!.userId)
    if (u) u.currentPoint -= pts
    showToast(
      `사번 ${selectedUser.value.employeeId}의 포인트 ${pts}P가 차감되었습니다.`,
      `사유: ${deductReason.value}`,
    )
    selectedUser.value = null
    pointsToDeduct.value = ''
    deductReason.value = ''
    pointUserSearch.value = ''
  } catch {
    showToast('포인트 차감에 실패했습니다.', '', 'error')
  }
}

// ── 채팅 정책 (TTL + 금지어) ────────────────────────────────────
// PATCH /admin/flash-chat/policy 단일 엔드포인트로 TTL과 금지어를 함께 저장한다.
// sendCooldownSeconds는 UI에 없으므로 서버에서 읽은 값을 그대로 유지한다.
const CHAT_TTL_KEY = 'chat_message_ttl_seconds'
const messageTTL = ref(parseInt(localStorage.getItem(CHAT_TTL_KEY) ?? '600'))
const ttlMinutes = computed(() => Math.floor(messageTTL.value / 60))
const ttlSeconds = computed(() => messageTTL.value % 60)
const bannedWordsText = ref('')
const savedBannedWords = ref<string[]>([])
const sendCooldownSeconds = ref(0)

// 탭 최초 진입 시 서버에서 정책을 불러와 TTL·금지어를 채운다.
// localStorage에도 TTL을 기록해 ChatView.vue가 같은 값을 참조하도록 동기화한다.
async function loadChatPolicy() {
  try {
    const res = await getChatPolicy()
    messageTTL.value = res.data.messageTtlSeconds
    sendCooldownSeconds.value = res.data.sendCooldownSeconds
    savedBannedWords.value = res.data.bannedWords ?? []
    localStorage.setItem(CHAT_TTL_KEY, String(res.data.messageTtlSeconds))
  } catch { /* silent */ }
}
// API는 세 필드를 항상 함께 받으므로 저장 시마다 현재 상태 전체를 조립해서 전송한다.
function currentPolicy() {
  return { messageTtlSeconds: messageTTL.value, sendCooldownSeconds: sendCooldownSeconds.value, bannedWords: savedBannedWords.value }
}
async function saveTTL() {
  if (messageTTL.value < 60) { showToast('최소 60초 이상 설정해주세요.', '', 'error'); return }
  try {
    await updateChatPolicy(currentPolicy())
    localStorage.setItem(CHAT_TTL_KEY, String(messageTTL.value))
    showToast('메시지 TTL이 저장되었습니다.', `Flash Chat 메시지가 ${ttlMinutes.value}분 ${ttlSeconds.value}초 후 삭제됩니다.`)
  } catch {
    showToast('TTL 저장에 실패했습니다.', '', 'error')
  }
}
async function removeBannedWord(word: string) {
  const next = savedBannedWords.value.filter(w => w !== word)
  try {
    await updateChatPolicy({ ...currentPolicy(), bannedWords: next })
    savedBannedWords.value = next
    showToast('금지어가 삭제되었습니다.')
  } catch {
    showToast('금지어 삭제에 실패했습니다.', '', 'error')
  }
}
async function saveBannedWords() {
  const parsed = bannedWordsText.value.split(',').map(w => w.trim()).filter(Boolean)
  if (parsed.length === 0) return
  const next = [...new Set([...savedBannedWords.value, ...parsed])]
  try {
    await updateChatPolicy({ ...currentPolicy(), bannedWords: next })
    savedBannedWords.value = next
    bannedWordsText.value = ''
    showToast('금지어 목록이 저장되었습니다.')
  } catch {
    showToast('금지어 저장에 실패했습니다.', '', 'error')
  }
}

// ── 수기 지식 관리 ─────────────────────────────────────────────
// 전체/활성/비활성 탭으로 필터하고, 목록 클릭 또는 새 수기 지식 버튼으로 모달 생성·수정.
// isActive 활성화 저장 시 BE가 전체 사용자에게 알림을 자동 발송한다(FE 추가 처리 불필요).
type KnowledgeTab = 'all' | 'active' | 'inactive'
const knowledgeTab = ref<KnowledgeTab>('all')
const knowledgeItems = ref<AdminDirectData[]>([])
const knowledgeLoading = ref(false)
const knowledgeSaving = ref(false)
const deleteKnowledgeId = ref<number | null>(null)
const knowledgeModalOpen = ref(false)

type KnowledgeForm = { id?: number; title: string; content: string; category: string; isActive: boolean }
const knowledgeForm = ref<KnowledgeForm>({ title: '', content: '', category: '', isActive: true })
// 수정 모달을 열 때의 원본 isActive. null이면 신규 생성.
// N→Y 전환 시에만 알림 발송되므로 Y→Y 편집 시에는 알림 안내를 숨긴다.
const knowledgeOriginalIsActive = ref<boolean | null>(null)

async function loadKnowledge() {
  knowledgeLoading.value = true
  try {
    const res = await getAdminDirectData({
      page: 1,
      size: 50,
      ...(knowledgeTab.value === 'active' ? { isActive: true } : knowledgeTab.value === 'inactive' ? { isActive: false } : {}),
    })
    knowledgeItems.value = res.data.content
  } catch {
    showToast('수기 지식 목록을 불러오지 못했습니다.', '', 'error')
  } finally {
    knowledgeLoading.value = false
  }
}

function setKnowledgeTab(tab: KnowledgeTab) {
  knowledgeTab.value = tab
  loadKnowledge()
}

function openKnowledgeCreate() {
  knowledgeForm.value = { title: '', content: '', category: '', isActive: true }
  knowledgeOriginalIsActive.value = null
  knowledgeModalOpen.value = true
}

function openKnowledgeEdit(item: AdminDirectData) {
  knowledgeForm.value = {
    id: item.directDataId,
    title: item.title,
    content: item.content,
    category: item.category ?? '',
    isActive: item.isActive,
  }
  knowledgeOriginalIsActive.value = item.isActive
  knowledgeModalOpen.value = true
}

async function saveKnowledge() {
  if (knowledgeSaving.value) return
  if (!knowledgeForm.value.title.trim() || !knowledgeForm.value.content.trim()) {
    showToast('제목과 내용을 입력해주세요.', '', 'error')
    return
  }
  knowledgeSaving.value = true
  try {
    const body = {
      title: knowledgeForm.value.title.trim(),
      content: knowledgeForm.value.content,
      ...(knowledgeForm.value.category.trim() ? { category: knowledgeForm.value.category.trim() } : {}),
      isActive: knowledgeForm.value.isActive,
    }
    if (knowledgeForm.value.id) {
      const res = await updateAdminDirectData(knowledgeForm.value.id, body)
      // 탭 필터 기준에 맞지 않는 isActive로 변경된 경우 목록 리로드, 그 외엔 인플레이스 업데이트
      const tabMismatch = knowledgeTab.value !== 'all' && res.data.isActive !== (knowledgeTab.value === 'active')
      if (tabMismatch) {
        await loadKnowledge()
      } else {
        const idx = knowledgeItems.value.findIndex(i => i.directDataId === knowledgeForm.value.id)
        if (idx !== -1) knowledgeItems.value[idx] = res.data
      }
      showToast('수기 지식이 수정되었습니다.')
    } else {
      await createAdminDirectData(body)
      showToast('수기 지식이 추가되었습니다.')
      await loadKnowledge()
    }
    knowledgeModalOpen.value = false
  } catch {
    showToast('수기 지식 저장에 실패했습니다.', '', 'error')
  } finally {
    knowledgeSaving.value = false
  }
}

async function confirmDeleteKnowledge() {
  if (!deleteKnowledgeId.value) return
  try {
    await deleteAdminDirectData(deleteKnowledgeId.value)
    knowledgeItems.value = knowledgeItems.value.filter(i => i.directDataId !== deleteKnowledgeId.value)
    showToast('수기 지식이 삭제되었습니다.')
  } catch {
    showToast('수기 지식 삭제에 실패했습니다.', '', 'error')
  }
  deleteKnowledgeId.value = null
}

// ── Script ─────────────────────────────────────────────────────
// 사내 포털에 삽입할 NOIT 챗봇 위젯 스크립트. 클립보드 복사만 제공하며 API 호출은 없다.
const WIDGET_SCRIPT = `<!-- NOIT Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.noit.workipedia.com/widget.js';
    script.async = true;
    script.setAttribute('data-org-id', 'YOUR_ORG_ID');
    script.setAttribute('data-api-key', 'YOUR_API_KEY');
    document.head.appendChild(script);
  })();
<\/script>
<style>
  .noit-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
</style>`
function copyScript() {
  navigator.clipboard.writeText(WIDGET_SCRIPT)
  showToast('스크립트가 클립보드에 복사되었습니다.')
}

// ── Init ───────────────────────────────────────────────────────
// 사용자·포인트 탭은 처음 진입할 때만 API를 호출한다. 매뉴얼·부서는 onMounted에서 미리 로드한다.
const loadedTabs = new Set<Tab>()
watch(activeTab, (tab) => {
  if (loadedTabs.has(tab)) return
  loadedTabs.add(tab)
  if (tab === 'users') loadUsers()
  if (tab === 'points') loadPoints()
  if (tab === 'chat') loadChatPolicy()
  if (tab === 'knowledge') loadKnowledge()
})

onMounted(() => {
  loadDashboard()
  loadManuals()
  loadDepts()
})
</script>

<template>
  <div class="content-inner">

    <!-- Header -->
    <div class="page-head">
      <h1 class="page-title">
        <Settings :size="28" color="#1f2430" />
        설정
      </h1>
      <p class="page-sub">시스템 설정과 사용자를 관리하세요.</p>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="card stat-card stat-blue">
        <div class="stat-row">
          <span class="stat-label">전체 사용자</span>
          <div class="stat-icon si-blue"><Users :size="16" color="#3b82f6" /></div>
        </div>
        <div class="stat-val">{{ stats?.totalUserCount ?? 0 }}</div>
        <div class="stat-sub">등록된 전체 사용자 수</div>
      </div>
      <div class="card stat-card stat-green">
        <div class="stat-row">
          <span class="stat-label">당일 로그인</span>
          <div class="stat-icon si-green"><LogIn :size="16" color="#22c55e" /></div>
        </div>
        <div class="stat-val">{{ stats?.todayLoginCount ?? 0 }}</div>
        <div class="stat-sub">오늘 로그인한 사용자 수</div>
      </div>
      <div class="card stat-card stat-purple">
        <div class="stat-row">
          <span class="stat-label">총 매뉴얼</span>
          <div class="stat-icon si-purple"><FileText :size="16" color="#a855f7" /></div>
        </div>
        <div class="stat-val">{{ adminManuals.length }}</div>
        <div class="stat-sub">등록된 매뉴얼 수</div>
      </div>
    </div>

    <!-- Tab Bar - AiAdminView 탭 스타일과 동일 -->
    <div class="tab-bar">
      <button v-for="t in (['manual','knowledge','departments','users','points','chat','script'] as Tab[])"
        :key="t" :class="['tab', { 'tab--active': activeTab === t }]" @click="activeTab = t">
        {{ { manual:'매뉴얼 관리', knowledge:'수기 지식 관리', departments:'부서 관리', users:'사용자 관리', points:'포인트 사용', chat:'채팅 옵션', script:'스크립트' }[t] }}
      </button>
    </div>

    <!-- ────────────── 매뉴얼 관리 ────────────── -->
    <div v-show="activeTab === 'manual'" class="card section-card">
      <div class="sec-head">
        <div>
          <h3 class="sec-title"><FileText :size="17" color="#3b82f6" /> 매뉴얼 관리</h3>
          <p class="sec-desc">모든 매뉴얼을 확인하고 추가, 수정, 삭제할 수 있습니다</p>
        </div>
        <button class="btn primary" @click="openManualForm">
          <Plus :size="15" /> 새 매뉴얼 추가
        </button>
      </div>

      <!-- 검색 -->
      <div class="search-bar" style="margin-bottom: 16px;">
        <Search :size="16" />
        <input v-model="manualSearchQuery" placeholder="매뉴얼 제목 또는 내용 검색..." />
      </div>

      <!-- 편집 폼 -->
      <div v-if="editingManual" ref="manualFormRef" class="edit-box">
        <h4 class="edit-title">{{ editingManual.id ? '매뉴얼 수정' : '새 매뉴얼 작성' }}</h4>
        <div class="field">
          <label>제목</label>
          <input v-model="editingManual.title" class="text-input" placeholder="매뉴얼 제목을 입력하세요" />
        </div>
        <div class="field">
          <label>설명</label>
          <textarea v-model="editingManual.description" class="textarea-input" rows="2" placeholder="매뉴얼 설명을 입력하세요" />
        </div>
        <div class="field">
          <label>부서</label>
          <select v-model="editingManual.departmentId" class="text-input">
            <option :value="null">공통 (부서 없음)</option>
            <option v-for="d in adminDepts" :key="d.departmentId" :value="d.departmentId">
              {{ d.departmentName }}
            </option>
          </select>
        </div>
        <div v-if="editingManual.id" class="field">
          <label>현재 파일</label>
          <div class="current-file-row">
            <FileText :size="14" color="#3b82f6" style="flex-shrink:0" />
            <template v-if="editingManual.currentFileUrl">
              <span class="current-file-name">{{ extractFileName(editingManual.currentFileUrl) }}</span>
              <a :href="editingManual.currentFileUrl" target="_blank" rel="noopener noreferrer" class="file-view-btn">
                <ExternalLink :size="13" /> 보기
              </a>
            </template>
            <template v-else-if="getRegistryFilesByManualId(editingManual.id).length > 0">
              <span class="current-file-name">{{ getRegistryFilesByManualId(editingManual.id).join(', ') }}</span>
            </template>
            <template v-else>
              <span class="current-file-unknown">불러오는 중...</span>
            </template>
          </div>
        </div>
        <div class="field">
          <label>파일 업로드</label>
          <input ref="fileInputRef" type="file" multiple class="hidden-input" @change="handleManualFileUpload" />
          <div :class="['upload-zone', { 'upload-error': fileError }]" @click="fileInputRef?.click()">
            <template v-if="uploadedFiles.length > 0">
              <CheckCircle :size="24" color="#22c55e" />
              <p class="up-name">{{ uploadedFiles.map(f => f.name).join(', ') }}</p>
              <p class="up-hint">{{ uploadedFiles.length }}개 파일 선택됨{{ editingManual.id ? ' · 저장 시 알림이 자동 전송됩니다' : '' }}</p>
            </template>
            <template v-else>
              <Upload :size="24" :color="fileError ? '#ef4444' : '#aeb2bb'" />
              <p :class="['up-hint', { 'up-hint-error': fileError }]">
                {{ fileError ? 'PDF 파일을 업로드해주세요' : '클릭하여 파일 선택 (여러 파일 가능)' + (editingManual.id ? ' — 업로드 시 알림이 자동으로 전송됩니다' : '') }}
              </p>
            </template>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn primary" :disabled="fileConflict || manualSubmitting" @click="saveManual">
            {{ manualSubmitting ? '저장 중...' : '저장' }}
          </button>
          <button class="btn" @click="editingManual = null; uploadedFiles = []; fileError = false; fileConflict = false">취소</button>
        </div>
      </div>

      <!-- 목록 -->
      <div v-if="filteredManuals.length === 0" class="empty-ph" style="height:180px;">검색 결과가 없습니다.</div>
      <div v-else ref="manualListRef" class="item-list">
        <div v-for="m in filteredManuals" :key="m.manualId" class="item-row">
          <div class="item-body">
            <div class="item-meta">
              <span :class="['badge', m.departmentId != null ? 'solid-blue' : 'gray']">{{ m.departmentId != null ? (adminDepts.find(d => d.departmentId === m.departmentId)?.departmentName ?? '공통') : '공통' }}</span>
              <span v-if="m.version" class="badge" style="background:#eff6ff; color:#2b7fff;">{{ fmtVersion(m.version) }}</span>
              <span class="meta-date">최종 수정: {{ fmtDate(m.updatedAt) }}</span>
            </div>
            <div class="item-title">{{ m.title }}</div>
            <div class="item-desc">{{ m.description }}</div>
          </div>
          <div class="item-actions">
            <button class="btn" @click="openEditManualForm(m)"><Edit2 :size="15" /></button>
            <button class="btn" @click="deleteManualId = m.manualId"><Trash2 :size="15" color="#ef4444" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ────────────── 수기 지식 관리 ────────────── -->
    <div v-show="activeTab === 'knowledge'" class="card section-card">
      <div class="sec-head">
        <div>
          <h3 class="sec-title"><FileText :size="17" color="#10b981" /> 수기 지식 관리</h3>
          <p class="sec-desc">RAG 검색에 활용될 수기 지식을 등록하고 관리합니다</p>
        </div>
        <button class="btn primary" @click="openKnowledgeCreate"><Plus :size="15" /> 새 수기 지식</button>
      </div>

      <!-- 활성 필터 탭 -->
      <div class="kn-tab-bar">
        <button
          v-for="t in (['all', 'active', 'inactive'] as KnowledgeTab[])"
          :key="t"
          :class="['kn-tab', { 'kn-tab--active': knowledgeTab === t }]"
          @click="setKnowledgeTab(t)"
        >
          {{ t === 'all' ? '전체' : t === 'active' ? '활성' : '비활성' }}
        </button>
      </div>

      <div v-if="knowledgeLoading && knowledgeItems.length === 0" class="empty-ph" style="height:180px;">
        <div class="loading-spinner" />
        불러오는 중...
      </div>
      <div v-else-if="!knowledgeLoading && knowledgeItems.length === 0" class="empty-ph" style="height:180px;">
        {{ knowledgeTab === 'inactive' ? '비활성 수기 지식이 없습니다.' : '등록된 수기 지식이 없습니다.' }}
      </div>
      <div v-else class="item-list">
        <div v-for="item in knowledgeItems" :key="item.directDataId"
          class="item-row" style="cursor:pointer;" @click="openKnowledgeEdit(item)">
          <div class="item-body">
            <div class="item-meta">
              <span v-if="item.category" class="badge solid-blue">{{ item.category }}</span>
              <span :class="['badge', item.isActive ? 'badge-kn-active' : 'badge-kn-inactive']">
                {{ item.isActive ? '활성' : '비활성' }}
              </span>
              <span class="meta-date">등록: {{ fmtDate(item.createdAt) }}</span>
            </div>
            <div class="item-title">{{ item.title }}</div>
            <div class="item-desc" style="white-space:pre-wrap;">{{ item.content.slice(0, 120) }}{{ item.content.length > 120 ? '…' : '' }}</div>
          </div>
          <div class="item-actions">
            <button class="btn" @click.stop="openKnowledgeEdit(item)"><Edit2 :size="15" /></button>
            <button class="btn" @click.stop="deleteKnowledgeId = item.directDataId"><Trash2 :size="15" color="#ef4444" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ────────────── 부서 관리 ────────────── -->
    <div v-show="activeTab === 'departments'" class="card section-card">
      <div class="sec-head">
        <div>
          <h3 class="sec-title"><Building2 :size="17" color="#a855f7" /> 부서 관리</h3>
          <p class="sec-desc">부서를 추가, 수정, 삭제하고 부서별 인원을 확인할 수 있습니다</p>
        </div>
        <button class="btn primary" @click="openDeptForm">
          <Plus :size="15" /> 부서 추가
        </button>
      </div>

      <!-- 요약 배너 -->
      <div class="dept-summary">
        <div class="ds-item">
          <span class="ds-label">전체 부서</span>
          <span class="ds-val">{{ adminDepts.length }}개</span>
        </div>
        <div class="ds-divider" />
        <div class="ds-item">
          <span class="ds-label">전체 인원</span>
          <span class="ds-val">{{ totalMembers }}명</span>
        </div>
      </div>

      <!-- 부서 추가/수정 폼 -->
      <div v-if="editingDept" ref="deptFormRef" class="edit-box">
        <h4 class="edit-title">{{ editingDept.id ? '부서 수정' : '새 부서 추가' }}</h4>
        <div class="field">
          <label>부서명</label>
          <input v-model="editingDept.name" class="text-input" placeholder="부서명을 입력하세요" />
        </div>
        <div class="field">
          <label>담당업무 / 라우팅 설명</label>
          <textarea v-model="editingDept.routingPrompt" class="textarea-input" rows="3"
            placeholder="이 부서가 담당하는 업무를 입력하세요 (AI 라우팅에 활용됩니다)" />
        </div>
        <div class="btn-row">
          <button class="btn primary" @click="saveDept">저장</button>
          <button class="btn" @click="editingDept = null">취소</button>
        </div>
      </div>

      <!-- 부서 목록 -->
      <div ref="deptListRef" class="item-list">
        <div v-for="d in adminDepts" :key="d.departmentId" class="dept-row">
          <Building2 :size="18" color="#a855f7" style="flex-shrink:0; margin-top:2px;" />
          <div class="dept-body">
            <div class="dept-name">{{ d.departmentName }}</div>
            <div class="dept-desc" :class="{ 'dept-desc--empty': !d.routingPrompt }">
              {{ d.routingPrompt ?? '설명 없음 — 수정 버튼으로 담당업무를 입력하세요' }}
            </div>
          </div>
          <div class="dept-right">
            <span class="member-badge"><Users :size="13" />{{ d.memberCount ?? 0 }}명</span>
            <button class="btn" @click="openDeptEdit(d)"><Edit2 :size="15" /></button>
            <button class="btn" @click="deleteDeptId = d.departmentId"><Trash2 :size="15" color="#ef4444" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ────────────── 사용자 관리 ────────────── -->
    <div v-show="activeTab === 'users'" class="card section-card">
      <div class="sec-head" style="margin-bottom:20px;">
        <div>
          <h3 class="sec-title"><Users :size="17" color="#1f2430" /> 사용자 관리</h3>
          <p class="sec-desc">사용자 계정을 검색하고 활성화/비활성화할 수 있습니다</p>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom: 20px;">
        <Search :size="16" />
        <input v-model="userSearchQuery" placeholder="사번으로 검색하세요 (예: 20230001)" />
      </div>

      <div v-if="usersLoading" class="empty-ph" style="height:180px;">
        <div class="loading-spinner" />
        불러오는 중...
      </div>
      <div v-else-if="filteredUsers.length === 0" class="empty-ph" style="height:180px;">
        <Users :size="36" color="#d1d5db" style="margin-bottom:8px;" />
        {{ userSearchQuery ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다' }}
      </div>
      <div v-else class="item-list">
        <div v-for="u in filteredUsers" :key="u.userId"
          :class="['user-row', { inactive: u.status === 'INACTIVE' }]">
          <div class="user-avatar">{{ u.employeeId?.slice(-2) ?? '?' }}</div>
          <div class="user-info">
            <div class="user-id-row">
              <span class="user-id">{{ u.employeeId }}</span>
              <span v-if="u.status === 'INACTIVE'" class="badge" style="background:#fef2f2; color:#ef4444; font-size:11px;">비활성</span>
            </div>
            <div class="user-meta">{{ u.departmentName }} · 최근 로그인: {{ u.lastLoginAt?.slice(0, 10) ?? '기록 없음' }}</div>
          </div>
          <button
            :class="['btn', u.status === 'ACTIVE' ? 'danger' : 'primary']"
            :disabled="u.userId === auth.userId || u.role === 'SYSTEM_ADMIN'"
            :title="u.userId === auth.userId ? '본인 계정은 변경할 수 없습니다' : u.role === 'SYSTEM_ADMIN' ? '관리자 계정은 변경할 수 없습니다' : ''"
            @click="toggleUserStatus(u.userId, u.status)">
            {{ u.status === 'ACTIVE' ? '비활성화' : '활성화' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ────────────── 포인트 사용 ────────────── -->
    <div v-show="activeTab === 'points'" class="card section-card">
      <h3 class="sec-title" style="margin-bottom:6px;"><span style="font-size:16px;">포인트 사용 관리</span></h3>
      <p class="sec-desc" style="margin-bottom:20px;">사용자의 포인트 사용 요청을 처리하고 포인트를 차감할 수 있습니다</p>

      <div class="field">
        <label>사번으로 사용자 검색</label>
        <div class="search-bar" style="margin-top:8px;">
          <Search :size="16" />
          <input v-model="pointUserSearch" placeholder="사번을 입력하세요 (예: 20230001)" />
        </div>
      </div>

      <!-- 검색 결과 -->
      <div v-if="pointUserSearch" class="item-list" style="margin-top:12px;">
        <div v-if="pointsLoading" class="empty-ph" style="height:80px; font-size:13px;">
          <div class="loading-spinner" style="width:18px; height:18px; margin-bottom:6px;" />
          불러오는 중...
        </div>
        <div v-else-if="pointSearchResults.length === 0" class="empty-ph" style="height:80px; font-size:13px;">검색 결과가 없습니다.</div>
        <div v-for="u in pointSearchResults" :key="u.userId"
          :class="['user-row', 'clickable', { selected: selectedUser?.userId === u.userId }]"
          @click="selectUser(u)">
          <div class="user-avatar">{{ u.employeeId?.slice(-2) ?? '?' }}</div>
          <div class="user-info">
            <div class="user-id">{{ u.employeeId }}</div>
            <div class="user-meta">{{ u.nickname }}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:#f97316;">{{ u.currentPoint }}P</div>
            <div style="font-size:11px; color:#aeb2bb;">현재 포인트</div>
          </div>
        </div>
      </div>

      <!-- 차감 폼 -->
      <div v-if="selectedUser" ref="deductFormRef" class="deduct-form">
        <h4 class="edit-title">포인트 차감</h4>
        <div class="selected-user-card">
          <div>
            <div style="font-weight:700;">{{ selectedUser.employeeId }}</div>
            <div style="font-size:12px; color:#aeb2bb;">{{ selectedUser.nickname }}</div>
          </div>
          <div style="font-size:18px; font-weight:700; color:#f97316;">{{ selectedUser.currentPoint }}P</div>
        </div>
        <div class="field">
          <label>차감할 포인트</label>
          <input v-model="pointsToDeduct" type="number" class="text-input" placeholder="차감할 포인트를 입력하세요" />
        </div>
        <div class="field">
          <label>사용 사유</label>
          <textarea v-model="deductReason" class="textarea-input" rows="3"
            placeholder="포인트 사용 사유를 입력하세요 (예: 기프티콘 구매, 복지 포인트 교환)" />
        </div>
        <div class="btn-row">
          <button class="btn primary" style="flex:1;" @click="deductPoints">포인트 차감</button>
          <button class="btn" @click="selectedUser = null; pointsToDeduct = ''; deductReason = ''">취소</button>
        </div>
      </div>
    </div>

    <!-- ────────────── 채팅 옵션 ────────────── -->
    <div v-show="activeTab === 'chat'" class="card section-card">

      <!-- 메시지 TTL 설정 -->
      <div class="sec-head" style="margin-bottom:20px;">
        <div>
          <h3 class="sec-title"><Timer :size="17" color="#f59e0b" /> 메시지 TTL 설정</h3>
          <p class="sec-desc">Flash Chat 메시지가 자동 삭제되기까지의 시간(초)을 설정합니다</p>
        </div>
      </div>

      <div class="edit-box" style="flex-direction:row; align-items:center; gap:16px; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:160px;">
          <label>TTL (초)</label>
          <input
            v-model.number="messageTTL"
            type="number"
            min="60"
            class="text-input"
            placeholder="예: 600"
          />
        </div>
        <div style="font-size:13px; color:#717182; padding-top:20px; white-space:nowrap;">
          = {{ ttlMinutes }}분 {{ ttlSeconds }}초 후 삭제
        </div>
        <div style="padding-top:20px;">
          <button class="btn primary" @click="saveTTL">저장</button>
        </div>
      </div>

      <!-- 금지어 관리 -->
      <div class="sec-head" style="margin-bottom:20px; margin-top:28px; border-top:1px solid var(--line); padding-top:24px;">
        <div>
          <h3 class="sec-title"><MessageCircle :size="17" color="#ef4444" /> 금지어 관리</h3>
          <p class="sec-desc">쉼표(,)로 구분하여 금지어를 입력하세요. 저장 시 중복은 자동 제거됩니다.</p>
        </div>
      </div>

      <div class="edit-box">
        <h4 class="edit-title">금지어 목록 편집</h4>
        <textarea
          v-model="bannedWordsText"
          class="textarea-input"
          rows="3"
          placeholder="비속어1, 광고문구, 스팸단어, 금지어..."
        />
        <div class="btn-row">
          <button class="btn primary" @click="saveBannedWords">저장</button>
        </div>
      </div>

      <div class="banned-list-header">
        <span style="font-weight:600; font-size:14px;">등록된 금지어 미리보기</span>
        <span class="badge gray">{{ savedBannedWords.length }}개</span>
      </div>

      <div v-if="savedBannedWords.length === 0" class="empty-ph" style="height:80px;">등록된 금지어가 없습니다.</div>
      <div v-else class="banned-words">
        <div v-for="word in savedBannedWords" :key="word" class="banned-word-chip">
          <span>{{ word }}</span>
          <button @click="removeBannedWord(word)"><X :size="12" /></button>
        </div>
      </div>

      <div class="warn-box">
        <strong>⚠️ 주의사항</strong>
        <ul>
          <li>금지어가 포함된 메시지는 자동으로 필터링됩니다</li>
          <li>금지어는 대소문자를 구분하지 않고 적용됩니다</li>
          <li>부분 일치도 필터링되므로 신중하게 추가해주세요</li>
        </ul>
      </div>
    </div>

    <!-- ────────────── 스크립트 ────────────── -->
    <div v-show="activeTab === 'script'" class="card section-card">
      <h3 class="sec-title" style="margin-bottom:6px;"><span style="font-size:16px;">위젯 스크립트</span></h3>
      <p class="sec-desc" style="margin-bottom:24px;">사내 포털 또는 그룹웨어에 삽입하여 NOIT 서비스를 사용할 수 있는 스크립트입니다</p>

      <div style="margin-bottom:16px;">
        <h4 style="font-size:14px; font-weight:600; margin-bottom:6px;">설치 방법</h4>
        <p style="font-size:13px; color:#717182; margin-bottom:16px;">
          아래 스크립트를 복사하여 사내 포털 또는 그룹웨어의 &lt;head&gt; 태그 안에 붙여넣으세요.
        </p>
      </div>

      <div style="position:relative; margin-bottom:20px;">
        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:8px;">챗봇 위젯 스크립트</label>
        <pre class="script-pre"><code>{{ WIDGET_SCRIPT }}</code></pre>
        <button class="btn" style="position:absolute; top:36px; right:12px;" @click="copyScript">복사</button>
      </div>

      <div style="border-top: 1px solid var(--line); padding-top:20px; margin-bottom:20px;">
        <h4 style="font-size:14px; font-weight:600; margin-bottom:12px;">API 키 정보</h4>
        <div class="api-key-row">
          <div>
            <div style="font-size:14px; font-weight:500;">Organization ID</div>
            <div style="font-size:12px; color:#aeb2bb; margin-top:2px;">조직 고유 식별자</div>
          </div>
          <code class="api-code">org_2a8f9b3c4d5e</code>
        </div>
        <div class="api-key-row">
          <div>
            <div style="font-size:14px; font-weight:500;">API Key</div>
            <div style="font-size:12px; color:#aeb2bb; margin-top:2px;">위젯 인증 키</div>
          </div>
          <code class="api-code">noit_sk_••••••••••••••••</code>
        </div>
      </div>

      <div class="info-box">
        <strong style="font-size:13px;">💡 참고사항</strong>
        <ul>
          <li>스크립트 설치 후 즉시 챗봇 기능을 사용할 수 있습니다</li>
          <li>YOUR_ORG_ID와 YOUR_API_KEY를 실제 값으로 교체해주세요</li>
          <li>위젯은 사용자 인증을 자동으로 처리합니다</li>
          <li>별도의 서버 구축 없이 티켓 발행 및 조회가 가능합니다</li>
        </ul>
      </div>
    </div>

    <!-- ── 삭제 확인 모달 ── -->
    <Teleport to="body">
      <!-- 매뉴얼 삭제 -->
      <div v-if="deleteManualId" class="modal-overlay" @click.self="deleteManualId = null">
        <div class="modal-box">
          <h4 class="modal-title">매뉴얼을 삭제하시겠습니까?</h4>
          <p class="modal-desc">삭제된 매뉴얼은 복구할 수 없습니다.</p>
          <div class="btn-row" style="justify-content:flex-end;">
            <button class="btn" @click="deleteManualId = null">취소</button>
            <button class="btn danger" @click="confirmDeleteManual">삭제</button>
          </div>
        </div>
      </div>
      <!-- 부서 삭제 -->
      <div v-if="deleteDeptId" class="modal-overlay" @click.self="deleteDeptId = null">
        <div class="modal-box">
          <h4 class="modal-title">부서를 삭제하시겠습니까?</h4>
          <p class="modal-desc">삭제된 부서는 복구할 수 없습니다.</p>
          <div class="btn-row" style="justify-content:flex-end;">
            <button class="btn" @click="deleteDeptId = null">취소</button>
            <button class="btn danger" @click="confirmDeleteDept">삭제</button>
          </div>
        </div>
      </div>
      <!-- 수기 지식 생성/수정 -->
      <div v-if="knowledgeModalOpen" class="modal-overlay" @click.self="knowledgeModalOpen = false">
        <div class="modal-box" style="width:560px; max-width:calc(100vw - 32px);">
          <h4 class="modal-title">{{ knowledgeForm.id ? '수기 지식 수정' : '새 수기 지식 추가' }}</h4>
          <div class="field" style="margin-top:16px;">
            <label>제목 <span style="color:#ef4444;">*</span></label>
            <input v-model="knowledgeForm.title" class="text-input" placeholder="제목을 입력하세요 (최대 255자)" maxlength="255" />
          </div>
          <div class="field">
            <label>분류</label>
            <input v-model="knowledgeForm.category" class="text-input" placeholder="예: 인사, IT, 총무 (선택)" />
          </div>
          <div class="field">
            <label>내용 <span style="color:#ef4444;">*</span></label>
            <textarea v-model="knowledgeForm.content" class="textarea-input" rows="8"
              style="font-family:inherit; white-space:pre-wrap; resize:vertical;" placeholder="내용을 입력하세요" />
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span>활성화 (공개)</span>
              <label class="kn-toggle">
                <input type="checkbox" v-model="knowledgeForm.isActive" />
                <span></span>
              </label>
            </label>
            <!-- 신규(null)이고 활성이거나, 기존 비활성→활성 전환 시에만 안내 표시 (Y→Y 수정은 알림 없음) -->
            <p v-if="knowledgeForm.isActive && (knowledgeOriginalIsActive === null || knowledgeOriginalIsActive === false)" class="kn-notify-hint">
              ℹ️ 활성 상태로 저장 시 전체 사용자에게 알림이 발송됩니다.
            </p>
          </div>
          <div class="btn-row" style="justify-content:flex-end; margin-top:20px;">
            <button class="btn" @click="knowledgeModalOpen = false">취소</button>
            <button class="btn primary" :disabled="knowledgeSaving" @click="saveKnowledge">
              {{ knowledgeSaving ? '저장 중...' : '저장' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 수기 지식 삭제 -->
      <div v-if="deleteKnowledgeId" class="modal-overlay" @click.self="deleteKnowledgeId = null">
        <div class="modal-box">
          <h4 class="modal-title">수기 지식을 삭제하시겠습니까?</h4>
          <p class="modal-desc">삭제된 지식은 복구할 수 없으며 RAG 검색에서 제거됩니다.</p>
          <div class="btn-row" style="justify-content:flex-end;">
            <button class="btn" @click="deleteKnowledgeId = null">취소</button>
            <button class="btn danger" @click="confirmDeleteKnowledge">삭제</button>
          </div>
        </div>
      </div>
    </Teleport>

    <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" :type="toastType" />

  </div>
</template>

<style scoped>
/* ── Stats ── */
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 18px 22px; }
.stat-blue  { border-left: 4px solid #3b82f6; }
.stat-green { border-left: 4px solid #22c55e; }
.stat-purple { border-left: 4px solid #a855f7; }
.stat-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.stat-label { font-size: 13px; font-weight: 600; color: #717182; }
.stat-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.si-blue { background: #eff6ff; }
.si-green { background: #f0fdf4; }
.si-purple { background: #faf5ff; }
.stat-val { font-size: 26px; font-weight: 800; color: #1f2430; }
.stat-sub { font-size: 11.5px; color: #aeb2bb; margin-top: 3px; }

/* ── Tab Bar - AiAdminView 스타일과 동일 ── */
.tab-bar { display: flex; border-bottom: 1px solid #dde1e7; margin-bottom: 24px; flex-wrap: wrap; }
.tab {
  padding: 9px 20px; border: 1px solid transparent; border-bottom: none;
  border-radius: 6px 6px 0 0; background: #e2e8f0; color: #64748b;
  font-size: 13px; font-weight: 600; cursor: pointer; margin-right: 4px;
  position: relative; bottom: -1px; transition: background 0.15s, color 0.15s; white-space: nowrap;
}
.tab:hover:not(.tab--active) { background: #d0d9e8; color: #475569; }
.tab--active { background: #fff; color: #1e293b; border-color: #dde1e7; border-bottom-color: #fff; }

/* ── Section Card ── */
.section-card { padding: 28px 32px; }
.sec-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.sec-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 4px; }
.sec-desc { font-size: 13px; color: #aeb2bb; margin: 0; }

/* ── Edit Box ── */
.edit-box { background: #f8f9fb; border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 14px; }
.edit-title { font-size: 14px; font-weight: 700; color: #1f2430; margin: 0; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 600; color: #4b5563; }
.text-input, .select-input, .textarea-input {
  border: 1px solid var(--line); border-radius: 9px; padding: 10px 13px;
  font-size: 14px; color: #1f2430; outline: none; font-family: inherit;
  background: #fff; width: 100%; box-sizing: border-box;
}
.text-input:focus, .select-input:focus, .textarea-input:focus { border-color: #2b7fff; }
.textarea-input { resize: vertical; }
.hidden-input { display: none; }
.upload-zone {
  border: 2px dashed var(--line); border-radius: 10px; padding: 18px;
  text-align: center; cursor: pointer; transition: background 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.upload-zone:hover { background: #f5f6f8; }
.upload-error { border-color: #ef4444 !important; background: #fff5f5; }
.upload-error:hover { background: #fee2e2; }
.up-hint-error { color: #ef4444 !important; font-weight: 600; }
.up-name { font-size: 13.5px; font-weight: 600; color: #22c55e; }
.up-hint { font-size: 12px; color: #aeb2bb; }
.current-file-row {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 14px; background: #f0f6ff; border: 1px solid #bfdbfe;
  border-radius: 8px; font-size: 13px;
}
.current-file-name { color: #1d4ed8; font-weight: 500; word-break: break-all; flex: 1; }
.current-file-unknown { color: #aeb2bb; }
.file-view-btn {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
  font-size: 12px; font-weight: 600; color: #2b7fff;
  text-decoration: none; padding: 3px 10px;
  background: #dbeafe; border-radius: 6px; transition: background 0.15s;
}
.file-view-btn:hover { background: #bfdbfe; }
.btn-row { display: flex; gap: 8px; }

/* ── Item List ── */
.item-list { display: flex; flex-direction: column; gap: 8px; }
.item-row {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px;
  transition: background 0.15s;
}
.item-row:hover { background: #f8f9fb; }
.item-body { flex: 1; min-width: 0; }
.item-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.meta-date { font-size: 11.5px; color: #aeb2bb; }
.item-title { font-size: 14px; font-weight: 600; color: #1f2430; }
.item-desc { font-size: 12.5px; color: #aeb2bb; margin-top: 3px; }
.item-actions { display: flex; gap: 4px; flex-shrink: 0; }

/* ── Dept ── */
.dept-summary {
  display: flex; align-items: center; justify-content: center; gap: 32px;
  background: linear-gradient(90deg, #faf5ff, #f5f3ff); border: 1px solid #e9d5ff;
  border-radius: 12px; padding: 14px 20px; margin-bottom: 16px;
}
.ds-item { text-align: center; }
.ds-label { font-size: 12px; font-weight: 600; color: #6b7280; }
.ds-val { font-size: 22px; font-weight: 800; color: #a855f7; display: block; margin-top: 2px; }
.ds-divider { width: 1px; height: 32px; background: #d8b4fe; }
.dept-row {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
  border: 1px solid var(--line); border-radius: 10px; transition: background 0.15s;
}
.dept-row:hover { background: #f8f9fb; }
.dept-body { flex: 1; min-width: 0; }
.dept-name { font-size: 14px; font-weight: 700; color: #1f2430; margin-bottom: 3px; }
.dept-desc { font-size: 12.5px; color: #aeb2bb; }
.dept-desc--empty { color: #d1d5db; font-style: italic; }
.dept-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.member-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; background: #f1f5f9; border-radius: 6px;
  font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;
}

/* ── User Row ── */
.user-row {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  border: 1px solid var(--line); border-radius: 10px; transition: background 0.15s;
}
.user-row:hover { background: #f8f9fb; }
.user-row.inactive { opacity: 0.65; background: #f9fafb; }
.user-row.clickable { cursor: pointer; }
.user-row.selected { background: #eff6ff; border-color: #2b7fff; }
.user-avatar {
  width: 44px; height: 44px; border-radius: 50%; background: #f1f5f9;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #475569; flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-id-row { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.user-id { font-size: 14px; font-weight: 700; color: #1f2430; }
.user-meta { font-size: 12px; color: #aeb2bb; }
.btn.danger { background: #fef2f2; color: #ef4444; border: none; }
.btn.danger:hover { background: #fee2e2; }
.btn:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }

/* ── Points ── */
.deduct-form {
  border-top: 1px solid var(--line); padding-top: 20px; margin-top: 8px;
  display: flex; flex-direction: column; gap: 14px;
}
.selected-user-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
}

/* ── Banned ── */
.banned-add-row { display: flex; gap: 8px; }
.banned-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.banned-categories { display: flex; flex-direction: column; gap: 12px; }
.banned-cat-block { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.banned-cat-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.badge.red { background: #fef2f2; color: #ef4444; }
.banned-words { display: flex; flex-wrap: wrap; gap: 8px; }
.banned-word-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; background: #f1f5f9; border-radius: 8px;
  font-size: 13.5px; transition: background 0.15s;
}
.banned-word-chip:hover { background: #e2e8f0; }
.banned-word-chip button { display: flex; align-items: center; color: #94a3b8; }
.banned-word-chip button:hover { color: #ef4444; }

/* ── Script ── */
.script-pre {
  background: #f1f5f9; border-radius: 10px; padding: 16px;
  font-size: 12px; font-family: 'Consolas', monospace;
  overflow-x: auto; line-height: 1.7; white-space: pre; color: #334155;
}
.api-key-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #f8f9fb; border-radius: 10px; margin-bottom: 8px;
}
.api-code { font-size: 13px; font-family: monospace; padding: 5px 12px; background: #fff; border: 1px solid var(--line); border-radius: 7px; }

/* ── Info / Warn boxes ── */
.info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; }
.info-box strong, .warn-box strong { display: block; font-size: 13px; color: #1e40af; margin-bottom: 8px; }
.info-box ul, .warn-box ul { margin: 0; padding-left: 18px; }
.info-box li, .warn-box li { font-size: 12.5px; color: #1d4ed8; line-height: 1.7; }
.warn-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
.warn-box strong { color: #92400e; }
.warn-box li { color: #78350f; }

/* ── Knowledge ── */
.kn-tab-bar { display: flex; gap: 4px; margin-bottom: 16px; }
.kn-tab {
  padding: 5px 16px; border-radius: 20px; border: 1px solid var(--line);
  background: #f8f9fb; font-size: 13px; font-weight: 600; color: #717182;
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.kn-tab:hover { background: #f0f2f5; }
.kn-tab--active { background: #eff6ff; color: #2b7fff; border-color: #bfdbfe; }
.badge-kn-active { background: #f0fdf4; color: #16a34a; }
.badge-kn-inactive { background: #f1f5f9; color: #64748b; }
.kn-toggle { display: inline-flex; cursor: pointer; }
.kn-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.kn-toggle span {
  position: relative; width: 36px; height: 20px; border-radius: 10px;
  background: #c3cad1; transition: background 0.15s; display: block;
}
.kn-toggle span::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px; border-radius: 50%; background: #fff;
  transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,.2);
}
.kn-toggle input:checked + span { background: #22c55e; }
.kn-toggle input:checked + span::after { transform: translateX(16px); }
.kn-notify-hint {
  margin-top: 8px; font-size: 12px; color: #d97706;
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 7px; padding: 8px 12px;
}

/* ── Loading ── */
.loading-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid #e2e8f0; border-top-color: #3b82f6;
  animation: spin 0.7s linear infinite; margin-bottom: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9000;
}
.modal-box { background: #fff; border-radius: 16px; padding: 28px 32px; width: 400px; max-width: calc(100vw - 32px); }
.modal-title { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.modal-desc { font-size: 13.5px; color: #717182; margin: 0 0 20px; }

</style>
