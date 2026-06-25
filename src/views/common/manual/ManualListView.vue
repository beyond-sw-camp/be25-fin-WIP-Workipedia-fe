<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BookOpen, Search, Clock3, FileText, X, Building2,
  History, Eye, Download, ExternalLink,
} from '@lucide/vue'
import { getManuals, type ManualSortType } from '@/api/manualApi'
import {
  getAdminManualVersions,
  type AdminManualVersion,
} from '@/api/adminApi'
import { useDeptStore } from '@/stores/deptStore'
import { useAuthStore } from '@/stores/authStore'
import { ROLES } from '@/constants/roles'
import type { ManualSummaryResponse } from '@/types/manual'

type ManualTab = 'recent' | 'all'

const router = useRouter()
const deptStore = useDeptStore()
const auth = useAuthStore()

const PAGE_SIZE = 12
const activeTab = ref<ManualTab>('recent')
const query = ref('')
const manuals = ref<ManualSummaryResponse[]>([])
const versions = ref<Record<number, AdminManualVersion[]>>({})
const page = ref(1)
const totalPages = ref(0)
const loading = ref(false)
const error = ref('')

const detailOpen = ref(false)
const selectedManual = ref<ManualSummaryResponse | null>(null)
const selectedVersions = ref<AdminManualVersion[]>([])
const versionsLoading = ref(false)

const isSystemAdmin = computed(() => auth.role === ROLES.SYSTEM_ADMIN)

const sortTypeByTab: Record<ManualTab, ManualSortType> = {
  recent: 'RECENTLY_UPDATED',
  all: 'RECENTLY_CREATED',
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return manuals.value.filter((m) => {
    return !q ||
      m.title.toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q)
  })
})

const visibleManuals = computed(() => activeTab.value === 'recent' ? filtered.value.slice(0, 6) : filtered.value)

const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

function fmtVersion(v: string | null | undefined): string {
  if (!v) return 'v1'
  return v.startsWith('v') ? v : `v${v}`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function statusLabel(status: string | null | undefined) {
  return ({ PUBLISHED: '공개', DRAFT: '초안', ARCHIVED: '보관' } as Record<string, string>)[status ?? ''] ?? '상태 없음'
}

function statusClass(status: string | null | undefined) {
  if (status === 'PUBLISHED') return 'green'
  if (status === 'DRAFT') return 'orange'
  if (status === 'ARCHIVED') return 'gray'
  return 'gray'
}

function deptName(id: number | null) {
  return id == null ? '공통' : deptStore.getName(id)
}

function fileUrlsOf(m: ManualSummaryResponse | null | undefined) {
  if (!m) return []
  if (m.fileUrls?.length) return m.fileUrls.filter(Boolean)
  return m.fileUrl ? [m.fileUrl] : []
}

function fileName(url: string | null | undefined) {
  if (!url) return ''
  try { return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '') } catch { return '' }
}

function fileSummary(m: ManualSummaryResponse) {
  const urls = fileUrlsOf(m)
  if (urls.length === 0) return '첨부 파일 없음'
  if (urls.length === 1) return fileName(urls[0]) || '첨부 파일 1개'
  return `첨부 파일 ${urls.length}개`
}

function latestVersion(manualId: number) {
  const list = versions.value[manualId] ?? []
  return [...list].sort((a, b) => {
    const idDiff = (b.manualVersionId ?? 0) - (a.manualVersionId ?? 0)
    if (idDiff !== 0) return idDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })[0] ?? null
}

function formatContentDiff(diff: string | null | undefined) {
  if (!diff?.trim()) return ''
  const added: string[] = []
  const removed: string[] = []

  for (const rawLine of diff.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('@@')) continue
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const text = line.slice(1).trim()
      if (text) added.push(text)
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const text = line.slice(1).trim()
      if (text) removed.push(text)
    }
  }

  const parts: string[] = []
  if (added.length > 0) parts.push(`추가: ${added.join(' ')}`)
  if (removed.length > 0) parts.push(`삭제: ${removed.join(' ')}`)
  return parts.join(' / ') || diff.replace(/^@@.*@@\s*/gm, '').trim()
}

function formatUpdateReason(reason: string | null | undefined) {
  if (!reason?.trim()) return ''
  const normalized = reason.trim().toUpperCase()
  const labels: Record<string, string> = {
    INITIAL_PDF_UPLOAD: 'PDF 매뉴얼이 처음 등록되었습니다.',
    PDF_UPLOAD: 'PDF 파일이 새 버전으로 업로드되었습니다.',
    FILE_ADDED: '첨부 파일이 추가되었습니다.',
    FILE_REMOVED: '첨부 파일이 삭제되었습니다.',
    FILE_REPLACED: '첨부 파일이 교체되었습니다.',
    ADMIN_UPDATE: '관리자가 매뉴얼 정보를 수정했습니다.',
    CONTENT_UPDATE: '매뉴얼 본문이 수정되었습니다.',
    METADATA_UPDATE: '매뉴얼 기본 정보가 수정되었습니다.',
  }
  return labels[normalized] ?? reason
}

function versionChangeText(v: AdminManualVersion | null | undefined) {
  if (!v) return ''
  // AI 한 줄 요약 우선, 없으면 BE 라벨 → 기존 diff 가공 → 사유 코드 순으로 표시
  return (
    v.changeSummary ||
    v.updateReasonLabel ||
    formatContentDiff(v.contentDiff) ||
    formatUpdateReason(v.updateReason)
  )
}

function latestChange(m: ManualSummaryResponse) {
  const v = latestVersion(m.manualId)
  return versionChangeText(v) || m.description || '최근 변경사항이 아직 기록되지 않았습니다.'
}

async function loadVersions(manualId: number, force = false) {
  if (!isSystemAdmin.value) return
  if (!force && versions.value[manualId]) return
  if (force) versionsLoading.value = true
  try {
    const res = await getAdminManualVersions(manualId)
    versions.value = { ...versions.value, [manualId]: res.data }
    if (selectedManual.value?.manualId === manualId) selectedVersions.value = res.data
  } catch {
    // 일반 조회 흐름은 유지한다. 권한/네트워크 실패 시 변경사항은 설명으로 대체된다.
  } finally {
    if (force) versionsLoading.value = false
  }
}

async function fetchPage(pageNum: number) {
  loading.value = true
  error.value = ''
  try {
    const res = await getManuals({
      page: pageNum,
      size: PAGE_SIZE,
      sortType: sortTypeByTab[activeTab.value],
    })
    manuals.value = res.data.content
    totalPages.value = res.data.pageInfo.totalPages
    page.value = pageNum
    await Promise.all(res.data.content.slice(0, 12).map((m) => loadVersions(m.manualId)))
  } catch {
    error.value = '매뉴얼을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function switchTab(tab: ManualTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  query.value = ''
  fetchPage(1)
}

async function openDetail(m: ManualSummaryResponse) {
  selectedManual.value = m
  selectedVersions.value = versions.value[m.manualId] ?? []
  detailOpen.value = true
  await loadVersions(m.manualId, true)
}

onMounted(() => {
  deptStore.load()
  fetchPage(1)
})
</script>

<template>
  <div class="content-inner">
    <div class="page-head manual-head">
      <div>
        <h1 class="page-title">
          <BookOpen :size="28" color="#10b981" />
          매뉴얼
        </h1>
        <p class="page-sub">사내 매뉴얼과 최근 변경사항, 첨부 파일, 버전 이력을 확인하세요.</p>
      </div>
    </div>

    <div class="manual-controls">
      <div class="search-bar manual-search">
        <Search :size="16" />
        <input v-model="query" placeholder="매뉴얼 제목 또는 설명 검색" />
      </div>
      <div class="seg compact">
        <button :class="{ on: activeTab === 'recent' }" @click="switchTab('recent')">
          <Clock3 :size="14" /> 최근
        </button>
        <button :class="{ on: activeTab === 'all' }" @click="switchTab('all')">
          <FileText :size="14" /> 전체
        </button>
      </div>
    </div>

    <div v-if="loading && manuals.length === 0" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error && manuals.length === 0" class="empty-ph" style="height: 240px;">{{ error }}</div>
    <div v-else-if="visibleManuals.length === 0" class="empty-ph" style="height: 240px;">
      {{ query.trim() ? '검색 결과가 없습니다' : '등록된 매뉴얼이 없습니다' }}
    </div>

    <template v-else>
      <!-- 최근 탭: 카드 그리드 -->
      <div v-if="activeTab === 'recent'" class="manual-gallery">
        <article v-for="m in visibleManuals" :key="m.manualId" class="manual-card" @click="router.push(`/manuals/${m.manualId}`)">
          <div :class="['manual-card-bar', statusClass(m.status)]" />
          <div class="manual-card-body">
            <div class="manual-card-head">
              <div class="manual-title-wrap">
                <div class="manual-icon"><FileText :size="18" /></div>
                <div>
                  <h3>{{ m.title }}</h3>
                  <p><Building2 :size="12" /> {{ deptName(m.departmentId) }}</p>
                </div>
              </div>
            </div>

            <div class="manual-change-box">
              <div class="change-label"><Clock3 :size="12" /> 최근 변경사항</div>
              <p>{{ latestChange(m) }}</p>
              <span>{{ formatDate(latestVersion(m.manualId)?.createdAt ?? m.updatedAt) }} · {{ fileSummary(m) }}</span>
              <div v-if="fileUrlsOf(m).length > 0" class="manual-file-list">
                <a
                  v-for="(url, index) in fileUrlsOf(m)"
                  :key="`${m.manualId}-${index}-${url}`"
                  :href="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  <FileText :size="12" />
                  {{ fileName(url) || `파일 ${index + 1}` }}
                </a>
              </div>
            </div>
          </div>

          <div class="manual-card-footer">
            <div class="manual-version">
              <History :size="13" />
              <strong>{{ fmtVersion(m.version) }}</strong>
              <span>· {{ versions[m.manualId]?.length ?? 0 }}개 이력</span>
            </div>
            <div class="manual-actions" @click.stop>
              <button class="icon-btn" title="상세" @click="router.push(`/manuals/${m.manualId}`)"><Eye :size="15" /></button>
              <button class="icon-btn" title="버전 이력" @click="openDetail(m)"><History :size="15" /></button>
              <a
                v-for="(url, index) in fileUrlsOf(m)"
                :key="`download-${m.manualId}-${index}-${url}`"
                class="icon-btn"
                :title="`파일 ${index + 1} 열기`"
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download :size="15" />
              </a>
            </div>
          </div>
        </article>
      </div>

      <!-- 전체 탭: 목록 리스트 -->
      <div v-else class="manual-list-wrap">
        <table class="manual-list-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>부서</th>
              <th>상태</th>
              <th>버전</th>
              <th>수정일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in visibleManuals"
              :key="m.manualId"
              class="manual-list-row"
              @click="router.push(`/manuals/${m.manualId}`)"
            >
              <td>
                <div class="list-title-cell">
                  <div class="list-file-icon"><FileText :size="14" /></div>
                  <span>{{ m.title }}</span>
                </div>
              </td>
              <td class="list-meta">{{ deptName(m.departmentId) }}</td>
              <td>
                <span :class="['list-status-badge', statusClass(m.status)]">{{ statusLabel(m.status) }}</span>
              </td>
              <td class="list-meta">{{ fmtVersion(m.version) }}</td>
              <td class="list-meta">{{ formatDate(m.updatedAt) }}</td>
              <td>
                <div class="list-actions" @click.stop>
                  <button class="icon-btn" title="상세" @click="router.push(`/manuals/${m.manualId}`)"><Eye :size="15" /></button>
                  <button class="icon-btn" title="버전 이력" @click="openDetail(m)"><History :size="15" /></button>
                  <a
                    v-for="(url, idx) in fileUrlsOf(m)"
                    :key="`dl-${m.manualId}-${idx}`"
                    class="icon-btn"
                    :title="`파일 ${idx + 1} 열기`"
                    :href="url"
                    target="_blank"
                    rel="noopener noreferrer"
                  ><Download :size="15" /></a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="activeTab === 'all' && totalPages > 1 && !query.trim()" class="pagination">
      <button class="btn" :disabled="page === 1 || loading" @click="fetchPage(page - 1)">이전</button>
      <button
        v-for="p in pageNumbers"
        :key="p"
        :class="['btn', 'page-btn', { on: p === page }]"
        :disabled="loading"
        @click="fetchPage(p)"
      >{{ p }}</button>
      <button class="btn" :disabled="page === totalPages || loading" @click="fetchPage(page + 1)">다음</button>
    </div>

    <Teleport to="body">
      <div v-if="detailOpen && selectedManual" class="modal-overlay" @click.self="detailOpen = false">
        <div class="modal-box manual-detail-modal">
          <div class="modal-head">
            <div>
              <h3>버전 이력</h3>
              <p>{{ selectedManual.title }}</p>
            </div>
            <button class="icon-btn" @click="detailOpen = false"><X :size="16" /></button>
          </div>
          <div v-if="versionsLoading" class="empty-ph" style="height: 120px;">버전 이력을 불러오는 중...</div>
          <div v-else-if="selectedVersions.length === 0" class="empty-ph" style="height: 120px;">버전 이력이 없습니다.</div>
          <div v-else class="version-list">
            <div v-for="(v, idx) in selectedVersions" :key="v.manualVersionId" class="version-row">
              <div class="version-dot-wrap">
                <div :class="['version-dot', { now: idx === 0 }]" />
                <div class="version-line" />
              </div>
              <div class="version-content">
                <div class="version-head">
                  <strong>{{ v.manualNum || fmtVersion(v.version) }}</strong>
                  <span :class="['badge', idx === 0 ? 'blue' : 'gray']">{{ idx === 0 ? '현재' : '이전' }}</span>
                  <span>{{ formatDate(v.createdAt) }}</span>
                </div>
                <p v-if="versionChangeText(v)">{{ versionChangeText(v) }}</p>
                <a v-if="v.sourceUrl" :href="v.sourceUrl" target="_blank" rel="noopener noreferrer">
                  <ExternalLink :size="12" /> 원문 열기
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Teleport>
  </div>
</template>

<style scoped>
.manual-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.blue { color: #2b7fff; }
.green { color: #0a8a43; }
.orange { color: #f97316; }
.red { color: #dc2626; }
.manual-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.manual-search { flex: 1; min-width: 240px; margin-bottom: 0 !important; }
.seg.compact { margin: 0; }
.seg.compact button { display: inline-flex; align-items: center; gap: 5px; }
.manual-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.manual-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.15s, transform 0.15s;
}
.manual-card:hover { box-shadow: 0 8px 24px rgba(15,23,42,0.08); transform: translateY(-2px); }
.manual-card-bar { height: 5px; background: #2b7fff; }
.manual-card-bar.green { background: linear-gradient(90deg, #00a63e, #4ade80); }
.manual-card-bar.orange { background: linear-gradient(90deg, #f97316, #fb923c); }
.manual-card-bar.gray { background: linear-gradient(90deg, #64748b, #94a3b8); }
.manual-card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
.manual-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.manual-title-wrap { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.manual-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #ecfdf5;
  color: #0a8a43;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.manual-title-wrap h3 {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.35;
  color: #1f2430;
  overflow-wrap: anywhere;
}
.manual-title-wrap p {
  margin: 4px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
}
.manual-change-box {
  background: #f8f9ff;
  border: 1px solid #e2e8ff;
  border-radius: 8px;
  padding: 10px 12px;
}
.manual-change-box.pending { background: #fffbeb; border-color: #fed7aa; }
.change-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #64748b;
  font-weight: 800;
  margin-bottom: 5px;
}
.manual-change-box p {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #374151;
  /* stylelint-disable property-no-vendor-prefix */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  /* stylelint-enable property-no-vendor-prefix */
  overflow: hidden;
}
.manual-change-box span { display: block; margin-top: 6px; font-size: 11px; color: #94a3b8; }
.manual-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.manual-file-list a {
  max-width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  padding: 4px 7px;
  background: #fff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.manual-file-list a:hover { background: #eff6ff; }
.manual-card-footer {
  border-top: 1px solid #f1f5f9;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.manual-version { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #94a3b8; }
.manual-version strong { color: #374151; }
.manual-actions { display: flex; gap: 3px; }
.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
}
.icon-btn:hover { background: #f1f5f9; color: #334155; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 18px 0 4px; }
.page-btn { min-width: 36px; }
.page-btn.on { background: #2b7fff; color: #fff; border-color: #2b7fff; }
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal-box {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: 90vh;
  overflow: auto;
}
.manual-detail-modal { width: 680px; }
.confirm-modal { width: 400px; }
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}
.modal-head h3 { margin: 0; font-size: 17px; color: #1f2430; }
.modal-head p, .confirm-modal p { margin: 4px 0 0; color: #717182; font-size: 13px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.form-grid label, .full-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.form-grid span, .full-field > span { font-size: 13px; font-weight: 700; color: #4b5563; }
.text-input, .textarea-input {
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 14px;
  color: #1f2430;
  background: #fff;
  outline: none;
  font-family: inherit;
}
.textarea-input { resize: vertical; }
.hidden-input { display: none; }
.upload-zone {
  border: 2px dashed var(--line);
  border-radius: 9px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-align: center;
  color: #94a3b8;
}
.upload-zone:hover { background: #f8fafc; border-color: #2b7fff; color: #2b7fff; }
.upload-error { border-color: #ef4444; background: #fff5f5; }
.upload-zone strong { color: #0a8a43; font-size: 13px; overflow-wrap: anywhere; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.btn.danger { background: #fef2f2; color: #ef4444; border: none; }
.version-list { display: flex; flex-direction: column; gap: 0; }
.version-row { display: flex; gap: 12px; padding-bottom: 16px; }
.version-row:last-child { padding-bottom: 0; }
.version-dot-wrap { width: 18px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: 5px; }
.version-dot { width: 10px; height: 10px; border-radius: 50%; background: #cbd5e1; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #cbd5e1; }
.version-dot.now { background: #2b7fff; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #2b7fff; }
.version-line { width: 2px; flex: 1; background: #e2e8f0; margin-top: 7px; }
.version-row:last-child .version-line { display: none; }
.version-content { flex: 1; min-width: 0; }
.version-head { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 12px; color: #94a3b8; }
.version-head strong { color: #1f2430; font-size: 14px; }
.version-content p {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-left: 3px solid #bfdbfe;
  border-radius: 6px;
  background: #f8f9ff;
  font-size: 12px;
  color: #475569;
  white-space: pre-wrap;
}
.version-content a {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #2b7fff;
  text-decoration: none;
  font-weight: 700;
}

/* 전체 탭: 목록 리스트 */
.manual-list-wrap { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.manual-list-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.manual-list-table thead th {
  padding: 11px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  white-space: nowrap;
}
.manual-list-table thead th:last-child { width: 110px; }
.manual-list-row { border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.12s, box-shadow 0.12s; }
.manual-list-row:last-child { border-bottom: none; }
.manual-list-row:hover { background: #f0f9ff; box-shadow: inset 3px 0 0 #10b981; }
.manual-list-table td { padding: 14px 16px; vertical-align: middle; }
.list-title-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
.list-file-icon {
  width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 8px; background: #ecfdf5; color: #0a8a43;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #d1fae5;
}
.list-title-cell span { font-size: 14px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; }
.list-meta { color: #64748b; font-size: 12.5px; white-space: nowrap; }
.list-status-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
.list-status-badge.green { background: #d1fae5; color: #065f46; }
.list-status-badge.orange { background: #fef3c7; color: #b45309; }
.list-status-badge.gray { background: #f3f4f6; color: #6b7280; }
.list-actions { display: flex; gap: 3px; justify-content: flex-end; opacity: 0.45; transition: opacity 0.12s; }
.manual-list-row:hover .list-actions { opacity: 1; }

@media (max-width: 1180px) {
  .manual-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .manual-head, .manual-card-head, .manual-card-footer { align-items: flex-start; flex-direction: column; }
  .manual-gallery, .form-grid { grid-template-columns: 1fr; }
  .list-title-cell span { max-width: 160px; }
}
</style>
