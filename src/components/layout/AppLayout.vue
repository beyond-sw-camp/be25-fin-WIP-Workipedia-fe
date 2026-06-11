<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import { useDeptStore } from '@/stores/deptStore'

const deptStore = useDeptStore()
onMounted(() => deptStore.load())
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="app-main">
      <Header />
      <main class="app-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-soft);
}
</style>
