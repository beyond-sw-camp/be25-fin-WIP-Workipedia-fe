import http from './index'
import type { FlashChatMessageResponse } from '@/types/chat'

export function getActiveMessages() {
  return http.get<{ messages: FlashChatMessageResponse[] }>('/flash-chat/messages')
}
