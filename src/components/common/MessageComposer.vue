<script setup lang="ts">
import { Send } from '@lucide/vue'
defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; send: [] }>()

// 한글 등 IME 조합 중에 눌린 Enter는 무시한다.
// (조합 중 Enter는 글자 확정용이라, 이걸 전송으로 처리하면 "테스"/"테스트"가 중복 전송됨)
function onEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  emit('send')
}
</script>

<template>
  <div class="composer">
    <div class="composer-inner">
      <input
        :value="modelValue"
        :placeholder="placeholder"
        class="composer-input"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="onEnter"
      />
      <button
        class="composer-send"
        :class="{ active: modelValue?.trim() }"
        @click="$emit('send')"
      >
        <Send :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  border-top: 1px solid #eceef2;
  padding: 16px 2%;
  background: #fff;
}
.composer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  gap: 12px;
  align-items: center;
}
.composer-input {
  flex: 1;
  padding: 14px 20px;
  border-radius: 12px;
  border: 1px solid #e6e8ec;
  background: #f7f8fa;
  font-size: 15px;
  outline: none;
  font-family: inherit;
}
.composer-send {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #8a8f99;
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.15s;
}
.composer-send.active { background: #2b7fff; }
</style>
