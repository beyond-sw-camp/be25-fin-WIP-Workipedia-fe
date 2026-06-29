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
