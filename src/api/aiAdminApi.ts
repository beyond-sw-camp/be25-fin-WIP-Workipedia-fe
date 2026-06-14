import http from './index'
import type { AdminDepartment } from './adminApi'

// ── 프롬프트 설정 ──────────────────────────────────────────
export interface AiPromptSettings {
  customPrompt: string
  enabled: boolean
}

export function getAiPromptSettings() {
  return http.get<AiPromptSettings>('/admin/ai-prompt-settings')
}

export function updateAiPromptSettings(body: AiPromptSettings) {
  return http.put<AiPromptSettings>('/admin/ai-prompt-settings', body)
}

// ── API Tool 관리 ──────────────────────────────────────────
export type ToolType = 'HTTP_API' | 'DB_QUERY'

export interface AiTool {
  aiToolId: number
  name: string
  description: string
  endpoint: string
  method: string
  toolType: ToolType
  status: string
  active: boolean
}

export interface CreateAiToolRequest {
  name: string
  description: string
  endpoint: string
  method: string
  toolType: ToolType
  parametersSchema?: string
}

export interface UpdateAiToolRequest {
  active?: boolean
  description?: string
  endpoint?: string
  method?: string
}

export function getAiTools() {
  return http.get<AiTool[]>('/admin/ai-tools')
}

export function createAiTool(body: CreateAiToolRequest) {
  return http.post<AiTool>('/admin/ai-tools', body)
}

export function updateAiTool(aiToolId: number, body: UpdateAiToolRequest) {
  return http.patch<AiTool>(`/admin/ai-tools/${aiToolId}`, body)
}

export function testAiTool(aiToolId: number) {
  return http.post<{ success: boolean; message: string }>(`/admin/ai-tools/${aiToolId}/test`)
}

// ── 부서 라우팅 프롬프트 ────────────────────────────────────────
// instruction 형식: "부서명: 내용" → BE가 부서명을 찾아 해당 routingPrompt로 저장
export function editRoutingPromptInstruction(instruction: string) {
  return http.patch<AdminDepartment[]>('/admin/departments/routing-prompt/instruction', { instruction })
}
