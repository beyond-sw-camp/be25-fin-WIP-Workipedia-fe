<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Clock, AlertTriangle } from '@lucide/vue'
import { useKnowledgeStore } from '@/stores/useKnowledgeStore'
import { getKnowledgeDetail } from '@/api/knowledgeApi'
import type { KnowledgeDataResponse } from '@/types/knowledge'

const router = useRouter()
const route = useRoute()
const id = Number(route.params.id)

const knowledgeStore = useKnowledgeStore()
// store에 없는 항목(size 상한 초과 등)을 위한 단건 조회 fallback 결과
const fetchedItem = ref<KnowledgeDataResponse | null>(null)
const fallbackLoading = ref(false)

// store 목록에서 먼저 찾고, 없으면 onMounted에서 단건 API로 보완한다.
const item = computed(() =>
  knowledgeStore.items.find(m => m.knowledgeDataId === id) ?? fetchedItem.value
)

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

const elapsed = computed(() => (item.value ? daysSince(item.value.approvedAt) : 0))
// 90일 경과 시 '내용이 오래됐을 수 있다'는 배너를 표시해 독자에게 신뢰도를 경고한다.
const isStale = computed(() => elapsed.value > 90)

// 경과일에 따라 초록→파랑→주황→빨강 순으로 색을 강조해 정보 신선도를 직관적으로 표현한다.
function elapsedStyle(days: number) {
  if (days <= 7) return { color: '#00a63e' }
  if (days <= 30) return { color: '#2b7fff' }
  if (days <= 90) return { color: '#e25c1e' }
  return { color: '#e03131' }
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

onMounted(async () => {
  await knowledgeStore.load()
  // 목록 로드 후에도 없으면 단건 API로 재조회한다. (직접 URL 진입 또는 size 한도 초과 항목)
  if (!item.value) {
    fallbackLoading.value = true
    try {
      const res = await getKnowledgeDetail(id)
      fetchedItem.value = res.data
    } catch {
      // 단건 조회도 실패하면 not-found 화면 표시
    } finally {
      fallbackLoading.value = false
    }
  }
})
</script>

<template>
  <div class="content-inner">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="knowledgeStore.loading || fallbackLoading || (!knowledgeStore.loaded && !knowledgeStore.error)" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="!item" class="empty-ph" style="height: 240px;">문서를 불러올 수 없습니다</div>

    <template v-else>
      <div class="detail-badges">
        <span class="badge gray">{{ item.departmentName ?? '알 수 없는 부서' }}</span>
        <span class="badge" :style="elapsedStyle(elapsed)">
          <Clock :size="11" /> {{ elapsed }}일 경과
        </span>
      </div>

      <div v-if="isStale" class="stale-banner">
        <AlertTriangle :size="16" />
        이 문서는 작성된 지 {{ elapsed }}일이 지났습니다. 내용이 현재와 다를 수 있습니다.
      </div>

      <div class="card section-card">
        <div class="section-label">질문</div>
        <p class="section-text">{{ item.question }}</p>
      </div>

      <div class="card section-card">
        <div class="section-label">답변</div>
        <p class="section-text">{{ item.answer }}</p>
      </div>

      <div class="card meta-card">
        <div class="meta-row">
          <span class="meta-key">발행일</span>
          <span class="meta-val">{{ formatDate(item.approvedAt) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">정보 경과</span>
          <span class="meta-val" :style="elapsedStyle(elapsed)">{{ elapsed }}일</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-badges { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }

.stale-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fff4e5;
  border: 1px solid #fcd4b0;
  color: #e25c1e;
  font-size: 13.5px;
  margin-bottom: 14px;
}

.section-card { padding: 24px 28px; margin-bottom: 14px; }
.section-label {
  font-size: 12px;
  font-weight: 700;
  color: #aeb2bb;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.section-text { font-size: 15px; color: #1f2430; line-height: 1.75; margin: 0; white-space: pre-wrap; }

.meta-card { padding: 20px 28px; display: flex; flex-direction: column; gap: 12px; }
.meta-row { display: flex; align-items: center; gap: 16px; }
.meta-key { font-size: 13px; color: #aeb2bb; width: 72px; }
.meta-val { font-size: 14px; font-weight: 600; color: #1f2430; }
</style>
