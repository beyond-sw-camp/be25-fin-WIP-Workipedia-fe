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
        <Send :size="22" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  border-top: 1px solid #eceef2;
  padding: 18px 8%;
  background: #fff;
}
.composer-inner {
  max-width: 940px;
  margin: 0 auto;
  display: flex;
  gap: 14px;
  align-items: center;
}
.composer-input {
  flex: 1;
  padding: 16px 22px;
  border-radius: 14px;
  border: 1px solid #e6e8ec;
  background: #f7f8fa;
  font-size: 16px;
  outline: none;
}
.composer-send {
  width: 54px;
  height: 54px;
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
