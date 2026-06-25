<script setup lang="ts">
import { AlertCircle } from '@lucide/vue'
import CommonQueuePanel from '@/components/admin/CommonQueuePanel.vue'
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <AlertCircle :size="28" color="#f97316" />
        공통 접수 티켓
      </h1>
      <p class="page-sub">자동 배정 실패 또는 팀 관리자 이관 티켓을 확인하고 담당 부서로 배정하세요.</p>
    </div>

    <CommonQueuePanel />
  </div>
</template>
