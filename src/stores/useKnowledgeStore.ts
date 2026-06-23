import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { KnowledgeDataResponse } from '@/types/knowledge'
import { getKnowledgeList, getTeamKnowledgeList } from '@/api/knowledgeApi'
import { useAuthStore } from '@/stores/authStore'

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
      const auth = useAuthStore()
      const isTeamAdmin = auth.role === 'TEAM_ADMIN'
      // 공개 엔드포인트(GET /knowledge-data)는 ticketId를 반환하지 않는다.
      // ticketId가 없으면 KnowledgeDetailView에서 getLatestAnswer를 호출할 수 없어
      // 첨부 파일을 표시할 방법이 없다.
      // TEAM_ADMIN은 admin 엔드포인트(팀 스코프, ticketId 포함)를 병렬 조회한 뒤
      // 같은 knowledgeDataId 항목에 ticketId를 병합해 파일 표시를 가능하게 한다.
      const [pubRes, adminRes] = await Promise.allSettled([
        getKnowledgeList({ page: 1, size: 100 }),
        isTeamAdmin ? getTeamKnowledgeList({ page: 1, size: 100 }) : Promise.reject(null),
      ])
      if (pubRes.status !== 'fulfilled') throw pubRes.reason
      let content = pubRes.value.data.content
      if (adminRes.status === 'fulfilled') {
        const ticketIdMap = new Map(
          adminRes.value.data.content.map(i => [i.knowledgeDataId, i.ticketId]),
        )
        content = content.map(item => ({
          ...item,
          ticketId: ticketIdMap.get(item.knowledgeDataId) ?? item.ticketId,
        }))
      }
      items.value = content
      loaded.value = true
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  // 승인 API 성공 직후 응답 데이터를 store 맨 앞에 추가해 게시판에 즉시 반영한다.
  // BE 응답에 departmentName이 null인 경우 승인자의 부서명(auth.team)으로 보완한다.
  function push(item: KnowledgeDataResponse) {
    const auth = useAuthStore()
    items.value.unshift({
      ...item,
      departmentName: item.departmentName ?? auth.team ?? null,
    })
  }

  function remove(id: number) {
    items.value = items.value.filter(i => i.knowledgeDataId !== id)
  }

  return { items, loading, loaded, error, load, push, remove }
})
