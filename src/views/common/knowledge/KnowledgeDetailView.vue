<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Library, BookMarked } from '@lucide/vue'

const router = useRouter()
const route = useRoute()

const article = ref({
  id: Number(route.params.id),
  title: '연차 사용 기준 완벽 정리',
  team: '인사팀',
  author: '박이화',
  date: '2025.05.10',
  tags: ['HR', '연차'],
  views: 842,
  saved: 130,
  sections: [
    {
      heading: '연차 신청 기한',
      body: '연차는 사용 예정일 기준 72시간(3일) 전까지 HR 시스템에서 신청해야 합니다. 긴급한 경우 팀장 구두 승인 후 당일 등록이 가능합니다.',
    },
    {
      heading: '잔여 연차 확인 방법',
      body: 'HR 시스템 → 나의 휴가 → 잔여 연차 메뉴에서 확인할 수 있습니다. 연말 기준 최대 10일까지 이월됩니다.',
    },
    {
      heading: '반차 신청',
      body: "오전(~13시) / 오후(13시~)로 구분됩니다. 신청 절차는 연차와 동일하며 HR 시스템에서 '반차'를 선택하면 됩니다.",
    },
  ],
  sources: [
    { kind: '티켓 답변', ref: '#TICKET-4520' },
    { kind: '워키', ref: '#WORKI-12' },
  ],
})

const isSaved = ref(false)

function toggleSave() {
  isSaved.value = !isSaved.value
  if (isSaved.value) article.value.saved++
  else article.value.saved--
}
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <button class="btn" style="margin-bottom: 24px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div class="card article-wrap">
      <div class="article-header">
        <div class="header-left">
          <span class="badge blue"><Library :size="11" /> 지식 베이스</span>
          <span class="badge gray">{{ article.team }}</span>
          <span v-for="t in article.tags" :key="t" class="chip" style="padding: 3px 10px; font-size: 12px;">{{ t }}</span>
        </div>
        <button class="save-btn" :class="{ saved: isSaved }" @click="toggleSave">
          <BookMarked :size="16" />
          {{ isSaved ? '저장됨' : '저장' }} {{ article.saved }}
        </button>
      </div>

      <h1 class="article-title">{{ article.title }}</h1>
      <div class="article-meta">{{ article.author }} · {{ article.date }} · 조회 {{ article.views }}</div>

      <hr class="divider" />

      <div class="article-body">
        <div v-for="(s, i) in article.sections" :key="i" class="section">
          <h2 class="section-heading">{{ s.heading }}</h2>
          <p class="section-body">{{ s.body }}</p>
        </div>
      </div>

      <div class="sources-wrap">
        <h4 class="sources-title">출처</h4>
        <div class="sources-list">
          <span v-for="s in article.sources" :key="s.ref" class="source-chip">
            {{ s.kind }} {{ s.ref }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.article-wrap { padding: 36px 40px; }
.article-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.header-left { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  color: #717182;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.save-btn:hover { background: #f5f6f8; }
.save-btn.saved { background: #eff6ff; border-color: #2b7fff; color: #2b7fff; }

.article-title { font-size: 26px; font-weight: 800; color: #1f2430; margin: 0 0 8px; }
.article-meta { font-size: 13.5px; color: #aeb2bb; }
.divider { border: none; border-top: 1px solid var(--line); margin: 24px 0; }
.article-body { display: flex; flex-direction: column; gap: 28px; margin-bottom: 32px; }
.section-heading { font-size: 17px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.section-body { font-size: 15px; color: #404055; line-height: 1.75; margin: 0; }

.sources-wrap { border-top: 1px solid var(--line); padding-top: 20px; }
.sources-title { font-size: 13px; color: #aeb2bb; font-weight: 600; margin: 0 0 10px; }
.sources-list { display: flex; gap: 8px; flex-wrap: wrap; }
.source-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: #f7f8fa;
  font-size: 12.5px;
  color: #717182;
}
</style>
