import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getDirectDataList } from '@/api/directDataApi'
import type { DirectDataResponse } from '@/api/directDataApi'

// 수기 지식 목록을 전역 캐시로 관리해 목록→상세 탐색 시 재요청을 줄인다.
// 전체 항목(size:100)을 한 번에 로드하고 클라이언트 필터링·페이지네이션을 수행한다.
export const useDirectDataStore = defineStore('directData', () => {
  const items = ref<DirectDataResponse[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref(false)

  // force=true: 관리자가 항목을 활성화한 직후 목록 진입 시 캐시를 강제 갱신해야 하는 경우 사용한다.
  // force=false(기본): 이미 로드됐으면 재요청 없이 캐시를 재사용한다.
  async function load(force = false) {
    if (!force && (loaded.value || loading.value)) return
    loading.value = true
    error.value = false
    try {
      const res = await getDirectDataList({ page: 1, size: 100 })
      items.value = res.data.content
      loaded.value = true
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { items, loading, loaded, error, load }
})
