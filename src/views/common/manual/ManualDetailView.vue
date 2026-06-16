<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, BookOpen, ExternalLink, Calendar, FileDown, FileText, Maximize2 } from '@lucide/vue'
import { getManualDetail } from '@/api/manualApi'
import { useDeptStore } from '@/stores/deptStore'
import type { ManualDetailResponse } from '@/types/manual'

const router = useRouter()
const route = useRoute()
const deptStore = useDeptStore()

const manual = ref<ManualDetailResponse | null>(null)
const loading = ref(false)
const error = ref('')

// "v1" / "1.0" / "v1.0" 등 다양한 형식을 화면 표시용 "vN.M"으로 통일한다.
function fmtVersion(v: string | null | undefined): string | null {
  if (!v) return null
  const withDot = v.match(/v?(\d+)\.(\d+)/)
  if (withDot) return `v${withDot[1]}.${withDot[2]}`
  const onlyMajor = v.match(/v?(\d+)/)
  if (onlyMajor) return `v${onlyMajor[1]}.0`
  return v
}

// presigned URL 은 쿼리스트링(?X-Amz-...)이 붙으므로 경로 부분만 떼어 확장자를 본다.
const isPdf = computed(() => {
  const url = manual.value?.fileUrl
  if (!url) return false
  const path = url.split(/[?#]/)[0] ?? url
  return /\.pdf$/i.test(path)
})

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

    <div v-else-if="manual" class="card manual-wrap">
      <div class="manual-header">
        <div class="manual-header-left">
          <span :class="['badge', manual.departmentId != null ? 'blue' : 'gray']">
            <BookOpen :size="11" /> {{ deptStore.getName(manual.departmentId) }}
          </span>
          <span v-if="manual.version" class="badge gray">{{ fmtVersion(manual.version) }}</span>
        </div>
        <div class="header-actions">
          <a
            v-if="manual.sourceUrl"
            class="btn source-btn"
            style="padding: 8px 14px; font-size: 13px; text-decoration: none;"
            :href="manual.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink :size="14" /> 원문 보기
          </a>
          <a
            v-if="manual.fileUrl"
            class="btn"
            style="padding: 8px 14px; font-size: 13px; text-decoration: none;"
            :href="manual.fileUrl"
            download
          >
            <FileDown :size="14" /> 파일 다운로드
          </a>
        </div>
      </div>

      <h1 class="header-title">{{ manual.title }}</h1>
      <div class="header-meta"><Calendar :size="13" /> 최종 수정 {{ formatDate(manual.updatedAt) }}</div>

      <div v-if="!(manual.fileUrl && isPdf)" class="card content-card">
        <div class="content-label">매뉴얼 내용</div>
        <div class="manual-body">{{ manual.content }}</div>
      </div>

      <div v-else class="card content-card pdf-card">
        <div class="pdf-bar">
          <div class="content-label" style="margin-bottom: 0;">
            <FileText :size="13" style="vertical-align: -2px;" /> PDF 미리보기
          </div>
          <a
            class="btn"
            style="padding: 6px 12px; font-size: 12.5px; text-decoration: none;"
            :href="manual.fileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Maximize2 :size="13" /> 새 탭에서 보기
          </a>
        </div>
        <iframe
          class="pdf-frame"
          :src="manual.fileUrl"
          title="매뉴얼 PDF 미리보기"
        ></iframe>
      </div>
    </div>

  </div>
</template>

<style scoped>
.manual-wrap { padding: 36px 40px; }
.manual-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.manual-header-left { display: flex; gap: 8px; }
.header-actions { display: flex; gap: 8px; }
.source-btn { text-decoration: none; }
.header-title { font-size: 24px; font-weight: 800; color: #1f2430; margin: 0 0 8px; line-height: 1.3; }
.header-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #aeb2bb; margin-bottom: 24px; }

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

/* ── PDF Preview ── */
.pdf-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.pdf-frame {
  width: 100%; height: 720px;
  border: 1px solid #e6e8ec; border-radius: 8px;
  background: #f7f8fa;
}
</style>
