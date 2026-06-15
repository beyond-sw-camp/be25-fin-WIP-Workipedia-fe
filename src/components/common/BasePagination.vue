<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{
  page: number // 현재 페이지 (1-based)
  totalPages: number
}>()

const emit = defineEmits<{ change: [page: number] }>()

// 현재 페이지를 중심으로 최대 5개의 번호만 노출한다.
const WINDOW = 5
const pages = computed(() => {
  const total = props.totalPages
  if (total <= 1) return []
  let start = Math.max(1, props.page - Math.floor(WINDOW / 2))
  const end = Math.min(total, start + WINDOW - 1)
  start = Math.max(1, end - WINDOW + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

function go(p: number) {
  if (p < 1 || p > props.totalPages || p === props.page) return
  emit('change', p)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pager">
    <button class="pager-btn" :disabled="page <= 1" @click="go(page - 1)">
      <ChevronLeft :size="16" />
    </button>
    <button
      v-for="p in pages"
      :key="p"
      class="pager-btn pager-num"
      :class="{ active: p === page }"
      @click="go(p)"
    >
      {{ p }}
    </button>
    <button class="pager-btn" :disabled="page >= totalPages" @click="go(page + 1)">
      <ChevronRight :size="16" />
    </button>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
}
.pager-btn {
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.pager-btn:hover:not(:disabled):not(.active) { background: #f8fafc; }
.pager-btn:disabled { opacity: 0.45; cursor: default; }
.pager-num.active {
  background: #2b7fff;
  border-color: #2b7fff;
  color: #fff;
  cursor: default;
}
</style>
