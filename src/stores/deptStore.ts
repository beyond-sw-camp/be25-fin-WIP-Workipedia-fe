import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDepartments, type Department } from '@/api/adminApi'

export const useDeptStore = defineStore('dept', () => {
  const _list = ref<Department[]>([])
  const loaded = ref(false)

  // 드롭다운용 배열
  const departments = computed(() => _list.value)

  async function load() {
    if (loaded.value) return
    try {
      const res = await getDepartments()
      _list.value = res.data
      loaded.value = true
    } catch {
      // 실패 시 빈 목록 유지, 각 뷰의 fallback(부서 N) 유지
    }
  }

  // 부서명 표시용 — null이면 '공통', 매핑 없으면 '부서 N' fallback
  function getName(id: number | null): string {
    if (id == null) return '공통'
    return _list.value.find(d => d.departmentId === id)?.departmentName ?? `부서 ${id}`
  }

  return { departments, loaded, load, getName }
})
