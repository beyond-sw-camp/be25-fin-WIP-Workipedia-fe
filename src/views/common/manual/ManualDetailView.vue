<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, BookOpen, Download } from '@lucide/vue'

const router = useRouter()

const manual = ref({
  id: 1,
  title: '연차·휴가 사용 가이드',
  dept: '인사팀',
  updated: '2025.03.10',
  author: '박이화',
  sections: [
    {
      heading: '1. 연차 신청 기준',
      body: '연차는 사용 예정일 기준 72시간(3일) 전까지 신청해야 합니다. HR 시스템에서 신청하면 담당 인사 담당자의 승인을 거쳐 확정됩니다.',
    },
    {
      heading: '2. 긴급 연차 처리',
      body: '불가피한 경우 팀장 구두 승인 후 당일 HR 시스템에 등록할 수 있습니다. 반드시 당일 내로 시스템 등록을 완료하세요.',
    },
    {
      heading: '3. 잔여 연차 확인',
      body: 'HR 시스템 → 나의 휴가 → 잔여 연차 메뉴에서 확인 가능합니다. 회계연도 기준으로 정산되며, 미사용 연차는 연말 기준 최대 10일까지 이월됩니다.',
    },
    {
      heading: '4. 반차 신청',
      body: '반차는 오전/오후로 구분됩니다. 오전 반차는 출근 후 13시까지, 오후 반차는 13시 이후 퇴근 시 사용합니다. 신청 방법은 연차와 동일합니다.',
    },
  ],
})
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <button class="btn" style="margin-bottom: 24px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div class="card manual-wrap">
      <div class="manual-header">
        <div class="manual-header-left">
          <span class="badge blue"><BookOpen :size="11" /> 매뉴얼</span>
          <span class="badge gray">{{ manual.dept }}</span>
        </div>
        <button class="btn" style="padding: 8px 14px; font-size: 13px;">
          <Download :size="14" /> 다운로드
        </button>
      </div>

      <h1 class="manual-title">{{ manual.title }}</h1>
      <div class="manual-meta">{{ manual.author }} · 최종 수정 {{ manual.updated }}</div>

      <hr class="divider" />

      <div class="manual-body">
        <div v-for="(s, i) in manual.sections" :key="i" class="section">
          <h2 class="section-heading">{{ s.heading }}</h2>
          <p class="section-body">{{ s.body }}</p>
        </div>
      </div>
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
.manual-body { display: flex; flex-direction: column; gap: 28px; }
.section-heading { font-size: 17px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.section-body { font-size: 15px; color: #404055; line-height: 1.75; margin: 0; }
</style>
