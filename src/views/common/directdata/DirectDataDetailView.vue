<script setup lang="ts">
// 수기 지식 상세 페이지 — 목록에서 진입하면 스토어 캐시를 즉시 활용하고,
// URL 직접 접근(알림 링크 등) 시에는 단건 API로 폴백해 빈 화면을 방지한다.
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Clock, AlertTriangle, Tag } from '@lucide/vue'
import { useDirectDataStore } from '@/stores/useDirectDataStore'
import { getDirectDataDetail } from '@/api/directDataApi'
import type { DirectDataResponse } from '@/api/directDataApi'

const router = useRouter()
const route = useRoute()
const id = Number(route.params.id)

const store = useDirectDataStore()
const fetchedItem = ref<DirectDataResponse | null>(null)
const fallbackLoading = ref(false)

// 캐시 우선 조회: 목록 경유 진입 시 스토어에 항목이 있어 별도 요청이 불필요하다.
const item = computed(() =>
  store.items.find(i => i.directDataId === id) ?? fetchedItem.value
)

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

const elapsed = computed(() => (item.value ? daysSince(item.value.updatedAt) : 0))
// 90일 초과 문서는 내용이 현재와 다를 수 있음을 경고한다.
const isStale = computed(() => elapsed.value > 90)

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
  await store.load()
  if (!item.value) {
    fallbackLoading.value = true
    try {
      const res = await getDirectDataDetail(id)
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

    <div v-if="store.loading || fallbackLoading || (!store.loaded && !store.error)" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="!item" class="empty-ph" style="height: 240px;">문서를 불러올 수 없습니다</div>

    <template v-else>
      <div class="detail-badges">
        <span v-if="item.category" class="badge gray">
          <Tag :size="11" />
          {{ item.category }}
        </span>
        <span class="badge" :style="elapsedStyle(elapsed)">
          <Clock :size="11" /> {{ elapsed }}일 경과
        </span>
      </div>

      <div v-if="isStale" class="stale-banner">
        <AlertTriangle :size="16" />
        이 문서는 작성된 지 {{ elapsed }}일이 지났습니다. 내용이 현재와 다를 수 있습니다.
      </div>

      <h1 class="item-title">{{ item.title }}</h1>

      <div class="card section-card">
        <div class="section-label">내용</div>
        <p class="section-text">{{ item.content }}</p>
      </div>

      <div class="card meta-card">
        <div class="meta-row">
          <span class="meta-key">등록일</span>
          <span class="meta-val">{{ formatDate(item.createdAt) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">수정일</span>
          <span class="meta-val">{{ formatDate(item.updatedAt) }}</span>
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
.item-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 18px; line-height: 1.35; }
.detail-badges { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
.badge.gray { display: inline-flex; align-items: center; gap: 4px; }

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
