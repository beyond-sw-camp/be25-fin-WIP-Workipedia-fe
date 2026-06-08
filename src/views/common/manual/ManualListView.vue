<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Search, ChevronRight } from '@lucide/vue'

const router = useRouter()
const query = ref('')

interface Manual {
  id: number
  title: string
  updated: string
  dept: string
}

interface Category {
  name: string
  icon: string
  manuals: Manual[]
}

const categories = ref<Category[]>([
  {
    name: '인사·복리후생',
    icon: '👤',
    manuals: [
      { id: 1, title: '연차·휴가 사용 가이드', updated: '2025.03.10', dept: '인사팀' },
      { id: 2, title: '재택근무 운영 기준', updated: '2025.02.28', dept: '인사팀' },
      { id: 3, title: '신입사원 온보딩 체크리스트', updated: '2025.01.15', dept: '인사팀' },
    ],
  },
  {
    name: 'IT·장비',
    icon: '💻',
    manuals: [
      { id: 4, title: '노트북 초기 설정 가이드', updated: '2025.04.02', dept: 'IT지원팀' },
      { id: 5, title: 'VPN 접속 방법', updated: '2025.03.20', dept: 'IT지원팀' },
    ],
  },
  {
    name: '재무·경비',
    icon: '💳',
    manuals: [
      { id: 6, title: '법인카드 사용 기준', updated: '2025.03.05', dept: '재무팀' },
      { id: 7, title: '출장 경비 정산 절차', updated: '2025.02.10', dept: '재무팀' },
    ],
  },
  {
    name: '보안·컴플라이언스',
    icon: '🔒',
    manuals: [
      { id: 8, title: '정보보안 준수 사항', updated: '2025.04.15', dept: '보안팀' },
    ],
  },
])

const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return categories.value
  return categories.value
    .map(c => ({
      ...c,
      manuals: c.manuals.filter(m => m.title.includes(q) || m.dept.includes(q)),
    }))
    .filter(c => c.manuals.length > 0)
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <BookOpen :size="28" color="#ff6900" />
        매뉴얼
      </h1>
      <p class="page-sub">부서별 업무 가이드와 규정을 확인하세요</p>
    </div>

    <div class="search-bar" style="max-width: 480px; margin-bottom: 28px;">
      <Search :size="16" />
      <input v-model="query" placeholder="매뉴얼 검색" />
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
      검색 결과가 없습니다
    </div>

    <div v-else class="cat-grid">
      <div v-for="cat in filtered" :key="cat.name" class="card cat-card">
        <div class="cat-head">
          <span class="cat-icon">{{ cat.icon }}</span>
          <h3 class="cat-name">{{ cat.name }}</h3>
        </div>
        <div class="manual-list">
          <div
            v-for="m in cat.manuals"
            :key="m.id"
            class="manual-row"
            @click="router.push(`/manuals/${m.id}`)"
          >
            <div>
              <div class="manual-title">{{ m.title }}</div>
              <div class="manual-meta">{{ m.dept }} · {{ m.updated }}</div>
            </div>
            <ChevronRight :size="16" color="#aeb2bb" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
.cat-card { padding: 24px; }
.cat-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cat-icon { font-size: 22px; }
.cat-name { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0; }
.manual-list { display: flex; flex-direction: column; }
.manual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 6px;
  border-top: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}
.manual-row:hover { background: #f7f8fa; }
.manual-title { font-size: 14.5px; font-weight: 600; color: #1f2430; }
.manual-meta { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }
</style>
