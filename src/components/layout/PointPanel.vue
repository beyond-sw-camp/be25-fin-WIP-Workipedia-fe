<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">포인트 내역</span>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>
    <!-- TODO: 포인트 내역 -->
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  left: var(--sidebar-width);
  top: 0;
  width: 320px;
  height: 100vh;
  background: #fff;
  box-shadow: 4px 0 16px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
}

.panel-title { font-size: 1rem; font-weight: 700; color: #1e293b; }

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
}
</style>
