<script setup lang="ts">
import { ref } from 'vue'

const isOpen = ref(false)
</script>

<template>
  <div class="wk-widget">
    <!-- 챗봇 창 -->
    <div v-if="isOpen" class="wk-chat-window">
      <div class="wk-chat-header">
        <span>Workipedia AI</span>
        <button class="wk-close-btn" @click="isOpen = false">✕</button>
      </div>
      <div class="wk-chat-body">
        <p class="wk-placeholder">안녕하세요! 무엇을 도와드릴까요?</p>
      </div>
    </div>

    <!-- 버블 버튼 -->
    <button class="wk-bubble-btn" @click="isOpen = !isOpen">
      <svg v-if="!isOpen" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.wk-widget {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 99999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.wk-bubble-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #1769c2;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(23, 105, 194, 0.4);
  transition: background 0.2s, transform 0.15s;
}
.wk-bubble-btn:hover { background: #105daf; transform: scale(1.06); }

.wk-chat-window {
  position: absolute;
  bottom: 68px;
  right: 0;
  width: 340px;
  height: 460px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wk-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: #1769c2;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}
.wk-close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.wk-chat-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
.wk-placeholder {
  color: #8a939e;
  font-size: 14px;
  text-align: center;
  margin-top: 60px;
}
</style>
