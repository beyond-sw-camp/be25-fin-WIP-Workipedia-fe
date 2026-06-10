<script setup lang="ts">
defineProps<{ initial: string; size?: number }>()
</script>

<template>
  <span
    class="avatar"
    :style="{
      width: (size ?? 44) + 'px',
      height: (size ?? 44) + 'px',
      fontSize: ((size ?? 44) / 3.2) + 'px',
    }"
  >{{ initial }}</span>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  background: #eef0f3;
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
