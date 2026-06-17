<script setup lang="ts">
// 수기 지식 게시판 — SYSTEM_ADMIN이 수기 지식 관리 탭에서 활성화한 항목을 카드 목록으로 표시한다.
// 검색과 페이지네이션은 서버 요청 없이 클라이언트에서 처리한다(전체 항목을 스토어에 캐시).
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookMarked, Search, Tag, ChevronRight, ChevronLeft } from '@lucide/vue'
import { useDirectDataStore } from '@/stores/useDirectDataStore'

const router = useRouter()
const query = ref('')
const store = useDirectDataStore()

// force=true: 관리자가 방금 활성화한 항목이 즉시 반영되도록 페이지 진입마다 최신 데이터를 요청한다.
onMounted(() => { store.load(true) })

const filteredItems = computed(() => {
  const q = query.value.trim()
  const sorted = [...store.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!q) return sorted
  return sorted.filter(i => i.title.includes(q) || i.content.includes(q))
})

const PAGE_SIZE = 9
const currentPage = ref(0)
watch(query, () => { currentPage.value = 0 })

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() =>
  filteredItems.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE),
)

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

function truncate(text: string, max = 100) {
  return text.length > max ? text.slice(0, max) + '…' : text
}
</script>

<template>
  <div class="content-inner">
    <div class="page-head-row">
      <div>
        <h1 class="page-title">
          <BookMarked :size="28" color="#10b981" />
          수기 지식 게시판
        </h1>
        <p class="page-sub">관리자가 직접 작성하고 공개한 지식을 탐색합니다.</p>
      </div>
      <div class="card summary-card">
        <div class="summary-item">
          <div class="summary-value">{{ store.items.length }}</div>
          <div class="summary-label">등록 건수</div>
        </div>
      </div>
    </div>

    <div v-if="store.loading" class="empty-ph" style="height: 200px;">
      불러오는 중...
    </div>
    <div v-else-if="store.error" class="empty-ph" style="height: 200px; color: #ef4444;">
      데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </div>

    <template v-else>
      <div class="search-bar" style="margin-bottom: 24px;">
        <Search :size="16" />
        <input v-model="query" placeholder="제목 또는 내용으로 검색" />
      </div>

      <div v-if="filteredItems.length === 0" class="empty-ph" style="height: 200px;">
        {{ query ? '검색 결과가 없습니다' : '등록된 수기 지식이 없습니다' }}
      </div>

      <template v-else>
        <div class="card-grid">
          <div
            v-for="item in pagedItems"
            :key="item.directDataId"
            class="card item-card"
            @click="router.push(`/direct-data/${item.directDataId}`)"
          >
            <div class="card-top">
              <span v-if="item.category" class="category-badge">
                <Tag :size="11" />
                {{ item.category }}
              </span>
              <ChevronRight class="card-arrow" :size="14" color="#aeb2bb" />
            </div>
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-preview">{{ truncate(item.content) }}</p>
            <div class="card-footer">
              <span class="card-date">{{ formatDate(item.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button
            class="page-btn"
            :disabled="currentPage === 0"
            @click="currentPage--"
          >
            <ChevronLeft :size="15" />
          </button>
          <span class="page-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
          <button
            class="page-btn"
            :disabled="currentPage >= totalPages - 1"
            @click="currentPage++"
          >
            <ChevronRight :size="15" />
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.summary-card {
  display: flex;
  align-items: center;
  padding: 16px 36px;
  flex-shrink: 0;
}
.summary-item { display: flex; flex-direction: column; align-items: center; }
.summary-value { font-size: 26px; font-weight: 900; color: #10b981; }
.summary-label { font-size: 12.5px; color: #aeb2bb; margin-top: 2px; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.item-card {
  padding: 20px 22px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s, transform 0.15s;
}
.item-card:hover { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }

.card-top { display: flex; align-items: center; justify-content: space-between; min-height: 20px; }
.card-arrow { margin-left: auto; flex-shrink: 0; }

.category-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  background: #ecfdf5;
  color: #059669;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2430;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-preview {
  font-size: 13px;
  color: #717182;
  line-height: 1.6;
  margin: 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer { display: flex; align-items: center; justify-content: flex-end; }
.card-date { font-size: 11.5px; color: #aeb2bb; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  color: #1f2430;
  transition: background 0.1s;
}
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.page-btn:not(:disabled):hover { background: #f1f5f9; }
.page-info { font-size: 13.5px; color: #717182; min-width: 48px; text-align: center; }
</style>
