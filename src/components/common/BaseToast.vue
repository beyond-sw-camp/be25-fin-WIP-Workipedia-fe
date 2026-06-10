<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { CheckCircle, X } from '@lucide/vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  sub?: string
  duration?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

let timer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (val) => {
  if (val) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => emit('update:modelValue', false), props.duration ?? 4000)
  }
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="modelValue" class="toast">
        <CheckCircle :size="22" color="#22c55e" class="toast-icon" />
        <div class="toast-body">
          <div class="toast-title">{{ title }}</div>
          <div v-if="sub" class="toast-sub">{{ sub }}</div>
        </div>
        <button class="toast-close" @click="emit('update:modelValue', false)">
          <X :size="16" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 400;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 12px;
  padding: 14px 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  min-width: 380px;
  max-width: 520px;
}
.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-body { flex: 1; }
.toast-title { font-weight: 700; font-size: 14px; color: #1f2430; }
.toast-sub { font-size: 13px; color: #16a34a; margin-top: 3px; }
.toast-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
}
.toast-close:hover { color: #374151; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>