import { computed, ref } from 'vue'
import { getMyTickets } from '@/api/mypageApi'
import type { MyTicketResponse } from '@/types/mypage'

export type MyIssuedTicketTab = 'waiting' | 'answered'

interface TicketBucket {
  items: MyTicketResponse[]
  total: number
}

const PAGE_SIZE = 50

export function useMyIssuedTickets() {
  const activeTab = ref<MyIssuedTicketTab>('waiting')
  const loading = ref(false)
  const error = ref('')
  const tickets = ref<Record<MyIssuedTicketTab, TicketBucket>>({
    waiting: { items: [], total: 0 },
    answered: { items: [], total: 0 },
  })

  const waitingTickets = computed(() => tickets.value.waiting.items)
  const answeredTickets = computed(() => tickets.value.answered.items)
  const waitingCount = computed(() => tickets.value.waiting.total)
  const answeredCount = computed(() => tickets.value.answered.total)
  const totalCount = computed(() => waitingCount.value + answeredCount.value)
  const currentList = computed(() =>
    activeTab.value === 'waiting' ? waitingTickets.value : answeredTickets.value,
  )

  function setActiveTab(tab: MyIssuedTicketTab) {
    activeTab.value = tab
  }

  async function loadTickets() {
    loading.value = true
    error.value = ''
    try {
      const [waitingRes, answeredRes] = await Promise.all([
        getMyTickets({ status: 'WAITING', page: 0, size: PAGE_SIZE }),
        getMyTickets({ status: 'COMPLETED', page: 0, size: PAGE_SIZE }),
      ])

      tickets.value = {
        waiting: {
          items: waitingRes.data.content,
          total: waitingRes.data.pageInfo.totalElements,
        },
        answered: {
          items: answeredRes.data.content,
          total: answeredRes.data.pageInfo.totalElements,
        },
      }
    } catch {
      error.value = '내 발행 티켓을 불러오지 못했습니다.'
    } finally {
      loading.value = false
    }
  }

  return {
    activeTab,
    loading,
    error,
    waitingTickets,
    answeredTickets,
    waitingCount,
    answeredCount,
    totalCount,
    currentList,
    setActiveTab,
    loadTickets,
  }
}
