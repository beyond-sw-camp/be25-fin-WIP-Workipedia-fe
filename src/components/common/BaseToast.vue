<script setup lang="ts">
import { CheckCircle, XCircle } from '@lucide/vue'
defineProps<{ title: string; sub?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="toast">
    <CheckCircle :size="20" color="#1aa055" class="toast-icon" />
    <div class="toast-body">
      <div class="toast-title">{{ title }}</div>
      <div v-if="sub" class="toast-sub">{{ sub }}</div>
    </div>
    <button class="toast-close" @click="$emit('close')">
      <XCircle :size="18" />
    </button>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  border: 1px solid #bfe9cf;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  min-width: 280px;
}
.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-body { flex: 1; }
.toast-title { font-weight: 700; font-size: 15px; color: #1f2430; }
.toast-sub { font-size: 13.5px; color: #6b7280; margin-top: 3px; }
.toast-close {
  background: none;
  border: none;
  color: #9a9aa8;
  cursor: pointer;
  padding: 0;
  display: flex;
}
</style>
