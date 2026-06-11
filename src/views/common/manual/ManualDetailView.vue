<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, BookOpen, ExternalLink, Calendar, FileDown } from '@lucide/vue'
import { getManualDetail } from '@/api/manualApi'
import type { ManualDetailResponse } from '@/types/manual'

const router = useRouter()
const route = useRoute()

const manual = ref<ManualDetailResponse | null>(null)
const loading = ref(false)
const error = ref('')

// TODO: BE가 departmentName을 응답에 포함하면 제거
const DEPT_NAME: Record<number, string> = {}
function deptName(id: number | null) {
  if (id == null) return '공통'
  return DEPT_NAME[id] ?? `부서 ${id}`
}

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
  <div class="content-inner">

    <button class="btn" style="margin-bottom: 20px;" @click="router.push('/manuals')">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <template v-else-if="manual">

      <!-- Header Card -->
      <div class="card header-card">
        <div class="header-icon">
          <BookOpen :size="28" color="#10b981" />
        </div>
        <div class="header-body">
          <div class="header-badges">
            <span class="badge solid-blue">{{ deptName(manual.departmentId) }}</span>
            <span v-if="manual.version" class="badge gray">v{{ manual.version }}</span>
          </div>
          <h1 class="header-title">{{ manual.title }}</h1>
          <div class="header-meta">
            <Calendar :size="14" color="#aeb2bb" />
            <span>최종 수정 {{ formatDate(manual.updatedAt) }}</span>
          </div>
        </div>
        <div class="header-actions">
          <a
            v-if="manual.fileUrl"
            class="btn source-btn"
            :href="manual.fileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown :size="14" /> PDF 다운로드
          </a>
          <a
            v-if="manual.sourceUrl"
            class="btn source-btn"
            :href="manual.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink :size="14" /> 원문 보기
          </a>
        </div>
      </div>

      <!-- Content Card -->
      <div class="card content-card">
        <div class="content-label">매뉴얼 내용</div>
        <div class="manual-body">{{ manual.content }}</div>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* ── Header Card ── */
.header-card {
  display: flex; align-items: flex-start; gap: 20px;
  padding: 28px 32px; margin-bottom: 16px;
}
.header-icon {
  width: 56px; height: 56px; border-radius: 14px;
  background: #ecfdf5;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.header-body { flex: 1; min-width: 0; }
.header-badges { display: flex; gap: 8px; margin-bottom: 10px; }
.header-title { font-size: 24px; font-weight: 800; color: #1f2430; margin: 0 0 10px; line-height: 1.3; }
.header-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #aeb2bb; }
.header-actions { display: flex; flex-direction: column; gap: 8px; align-self: flex-start; flex-shrink: 0; }
.source-btn { text-decoration: none; }

/* ── Content Card ── */
.content-card { padding: 28px 32px; }
.content-label {
  font-size: 12.5px; font-weight: 600; color: #aeb2bb;
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;
}
.manual-body {
  font-size: 15px; color: #404055;
  line-height: 1.8; white-space: pre-wrap; word-break: break-word;
}
</style>
