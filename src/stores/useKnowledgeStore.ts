import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { KnowledgeDataResponse } from '@/types/knowledge'
import { getKnowledgeList } from '@/api/knowledgeApi'

// 지식화 게시판 데이터를 앱 전역에서 공유한다.
// 목록·부서·상세 뷰와 대시보드 승인 기능이 동일 store를 참조해 API 중복 호출을 방지한다.
export const useKnowledgeStore = defineStore('knowledge', () => {
  const items = ref<KnowledgeDataResponse[]>([])
  const loading = ref(false)
  // loaded: 최초 로드 성공 여부. true이면 라우터 이동 시 재요청하지 않는다.
  const loaded = ref(false)
  // error: 로드 실패 여부. loaded=false & error=false → 미시작, error=true → 실패 확정.
  // 뷰에서 세 상태를 구분해 스피너/빈 화면/에러를 올바르게 표시한다.
  const error = ref(false)

  async function load() {
    // loaded · loading 둘 다 확인해 동시 마운트 시 중복 요청을 막는다.
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = false
    try {
      const res = await getKnowledgeList({ size: 100 })
      items.value = res.data.content
      loaded.value = true
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  // 승인 API 성공 직후 응답 데이터를 store에 추가해 페이지 이동 없이 게시판에 즉시 반영한다.
  function push(item: KnowledgeDataResponse) {
    items.value.push(item)
  }

  return { items, loading, loaded, error, load, push }
})
