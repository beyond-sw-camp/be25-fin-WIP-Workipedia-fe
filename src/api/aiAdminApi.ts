import http from './index'
import type { AdminDepartment } from './adminApi'
import type { PageResponse, PageParams } from '@/types/common'

// ── 프롬프트 설정 ──────────────────────────────────────────
export interface AiPromptSettings {
  customPrompt: string | null
  active: boolean
}

export interface UpdateAiPromptSettingsRequest {
  customPrompt: string | null
  active: boolean
}

export function getAiPromptSettings() {
  return http.get<AiPromptSettings>('/admin/ai-prompt-settings')
}

export function updateAiPromptSettings(body: UpdateAiPromptSettingsRequest) {
  return http.put<AiPromptSettings>('/admin/ai-prompt-settings', body)
}

// ── API Tool 관리 ──────────────────────────────────────────
export type ToolType = 'HTTP_API' | 'DB_QUERY'
export type ApprovalStatus = 'DRAFT' | 'APPROVED' | 'REJECTED'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type AuthType = 'NONE' | 'API_KEY' | 'BEARER_TOKEN'
export type AccessScope = 'UNRESTRICTED' | 'SELF_ONLY'
export type SideEffectType = 'READ_ONLY' | 'MUTATING'

// 목록(summary) 응답 — endpointUrl 등 상세는 GET /admin/ai-tools/{id} 로 조회한다.
export interface AiTool {
  aiToolId: number
  name: string
  description: string
  toolType: ToolType
  sideEffectType: SideEffectType
  endpointUrl?: string
  httpMethod?: HttpMethod
  datasourceKey?: string
  queryTemplate?: string
  parametersSchema?: string
  responseSchema?: string
  accessScope?: AccessScope
  selfIdentityParam?: string
  authType?: AuthType
  credentialRef?: string
  timeoutMs?: number
  maxResultCount?: number
  approvalStatus: ApprovalStatus
  active: boolean
  createdAt: string
  updatedAt?: string
}

interface BaseCreateAiToolRequest {
  name: string
  description: string
  parametersSchema: string
  responseSchema?: string
  sideEffectType: SideEffectType
  accessScope: AccessScope
  selfIdentityParam?: string
  authType: AuthType
  credentialRef?: string
  timeoutMs: number
  maxResultCount: number
}

export interface CreateHttpApiToolRequest extends BaseCreateAiToolRequest {
  toolType: 'HTTP_API'
  endpointUrl: string
  httpMethod: HttpMethod
}

export interface CreateDbQueryToolRequest extends BaseCreateAiToolRequest {
  toolType: 'DB_QUERY'
  datasourceKey: string
  queryTemplate: string
  authType: 'NONE'
}

// 등록 요청. parametersSchema 는 유효한 JSON 문자열이어야 한다.
export type CreateAiToolRequest = CreateHttpApiToolRequest | CreateDbQueryToolRequest

export interface DraftAiToolRequest {
  endpointUrl: string
  httpMethod: HttpMethod
}

export interface DraftAiToolParameter {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  description: string
  required: boolean
}

export interface DraftAiToolResponse {
  name: string
  description: string
  endpointUrl: string
  parameters: DraftAiToolParameter[]
}

// PATCH — null/미포함 항목은 변경하지 않는다.
export interface UpdateAiToolRequest {
  active?: boolean
  description?: string
  sideEffectType?: SideEffectType
  endpointUrl?: string
  httpMethod?: HttpMethod
  datasourceKey?: string
  queryTemplate?: string
  parametersSchema?: string
  responseSchema?: string
  accessScope?: AccessScope
  selfIdentityParam?: string
  authType?: AuthType
  credentialRef?: string
  timeoutMs?: number
  maxResultCount?: number
  approvalStatus?: ApprovalStatus
}

export function getAiTools(params: PageParams = {}) {
  return http.get<PageResponse<AiTool>>('/admin/ai-tools', { params })
}

export function createAiTool(body: CreateAiToolRequest) {
  return http.post<AiTool>('/admin/ai-tools', body)
}

export function updateAiTool(aiToolId: number, body: UpdateAiToolRequest) {
  return http.patch<AiTool>(`/admin/ai-tools/${aiToolId}`, body)
}

export function draftAiTool(body: DraftAiToolRequest) {
  return http.post<DraftAiToolResponse>('/admin/ai-tools/draft', body)
}

// ── 부서 라우팅 프롬프트 ────────────────────────────────────────
// instruction 형식: "부서명: 내용" → BE가 부서명을 찾아 해당 routingPrompt로 저장
export function editRoutingPromptInstruction(instruction: string) {
  return http.patch<AdminDepartment[]>('/admin/departments/routing-prompt/instruction', { instruction })
}

export interface AiSyncSetting {
  retentionDays: number
}

export interface UpdateAiSyncSettingRequest {
  retentionDays: number
}

export interface AiSyncCleanupResult {
  deleted: number
  skipped: number
  failed: number
}

export interface AiSyncCleanupLog {
  triggeredBy: string
  deletedCount: number
  skippedCount: number
  failedCount: number
  completedAt: string
}

export function getAiSyncSetting() {
  return http.get<AiSyncSetting>('/admin/ai-sync-jobs/settings')
}

export function updateAiSyncSetting(body: UpdateAiSyncSettingRequest) {
  return http.put<AiSyncSetting>('/admin/ai-sync-jobs/settings', body)
}

export function cleanupWorkiAiSyncJobs() {
  return http.post<AiSyncCleanupResult>('/admin/ai-sync-jobs/cleanup-worki')
}

export function getAiSyncCleanupLogs(limit = 10) {
  return http.get<AiSyncCleanupLog[]>('/admin/ai-sync-jobs/cleanup-worki/logs', {
    params: { limit },
  })
}

// ── 기타 지식 데이터 동기화 (ai_sync_jobs) ──────────────────────
// 목록 응답이 담을 수 있는 전체 sourceType
export type AiSyncSourceType =
  | 'MANUAL' | 'WORKI' | 'KNOWLEDGE_DATA' | 'MANUAL_KNOWLEDGE' | 'DEPT_RR' | 'MANUAL_CHANGE_SUMMARY'
// 이 탭에서 필터/버튼/요청에 쓰는 지식 2종
export type KnowledgeSyncSourceType = Extract<AiSyncSourceType, 'KNOWLEDGE_DATA' | 'MANUAL_KNOWLEDGE'>

export type AiSyncStatus = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED'
export type AiSyncOperation = 'UPSERT' | 'DELETE'

export interface AiSyncJob {
  aiSyncJobId: number
  sourceType: AiSyncSourceType
  sourceId: number
  operation: AiSyncOperation
  status: AiSyncStatus
  retryCount: number
  lastError: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AiSyncJobStats {
  pending: number
  processing: number
  synced: number
  failed: number
}

export interface AiSyncJobListParams extends PageParams {
  status?: AiSyncStatus
  sourceType?: KnowledgeSyncSourceType
  from?: string
  to?: string
}

export interface AiSyncStatsParams {
  sourceTypes?: KnowledgeSyncSourceType[]
}

export interface KnowledgeSyncRequest {
  sourceTypes: KnowledgeSyncSourceType[]
}

export function getAiSyncJobs(params: AiSyncJobListParams = {}) {
  return http.get<PageResponse<AiSyncJob>>('/admin/ai-sync-jobs', { params })
}

// 스코프 필수 — 이 탭 통계는 지식 2종만 집계한다.
export function getAiSyncJobStats(params: AiSyncStatsParams = {}) {
  return http.get<AiSyncJobStats>('/admin/ai-sync-jobs/stats', {
    params: params.sourceTypes ? { sourceTypes: params.sourceTypes.join(',') } : {},
  })
}

export function retryAiSyncJob(jobId: number) {
  return http.post<void>(`/admin/ai-sync-jobs/${jobId}/retry`)
}

export function retryAllFailedAiSyncJobs() {
  return http.post<{ retried: number }>('/admin/ai-sync-jobs/retry-all')
}

// 대기 작업 즉시 실행 (비동기 드레인)
export function runNowKnowledgeSync(body: KnowledgeSyncRequest) {
  return http.post<{ queued: number }>('/admin/ai-sync-jobs/run-now', body)
}

// 전체 재동기화 (활성 원본 UPSERT)
export function resyncKnowledge(body: KnowledgeSyncRequest) {
  return http.post<{ enqueued: number; skipped: number }>('/admin/ai-sync-jobs/resync-knowledge', body)
}
