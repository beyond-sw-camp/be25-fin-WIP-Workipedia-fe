<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, BookOpen, ExternalLink } from '@lucide/vue'
import { getManualDetail } from '@/api/manualApi'
import { useDeptStore } from '@/stores/deptStore'
import type { ManualDetailResponse } from '@/types/manual'

const router = useRouter()
const route = useRoute()
const deptStore = useDeptStore()

const manual = ref<ManualDetailResponse | null>(null)
const loading = ref(false)
const error = ref('')

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

onMounted(async () => {
  const id = Number(route.params.id)
  if (!Number.isFinite(id)) {
    error.value = '잘못된 접근입니다.'
    return
  }
  loading.value = true
  try {
    const res = await getManualDetail(id)
    manual.value = res.data
  } catch {
    error.value = '매뉴얼을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <button class="btn" style="margin-bottom: 24px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <div v-else-if="manual" class="card manual-wrap">
      <div class="manual-header">
        <div class="manual-header-left">
          <span class="badge blue"><BookOpen :size="11" /> {{ deptStore.getName(manual.departmentId) }}</span>
          <span v-if="manual.version" class="badge gray">v{{ manual.version }}</span>
        </div>
        <a
          v-if="manual.sourceUrl"
          class="btn"
          style="padding: 8px 14px; font-size: 13px; text-decoration: none;"
          :href="manual.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink :size="14" /> 원문 보기
        </a>
      </div>

      <h1 class="manual-title">{{ manual.title }}</h1>
      <div class="manual-meta">최종 수정 {{ formatDate(manual.updatedAt) }}</div>

      <hr class="divider" />

      <div class="manual-body">{{ manual.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.manual-wrap { padding: 36px 40px; }
.manual-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.manual-header-left { display: flex; gap: 8px; }
.manual-title { font-size: 26px; font-weight: 800; color: #1f2430; margin: 0 0 8px; }
.manual-meta { font-size: 13.5px; color: #aeb2bb; }
.divider { border: none; border-top: 1px solid var(--line); margin: 24px 0; }
/* BE content 는 단일 텍스트 본문. 줄바꿈/공백을 보존해 표시. */
.manual-body {
  font-size: 15px;
  color: #404055;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
