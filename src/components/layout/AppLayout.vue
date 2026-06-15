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
        <!-- 경로가 바뀌면 컴포넌트를 새로 마운트한다.
             같은 라우트의 param만 변할 때(예: /worki/5 → /worki/questions/10) 컴포넌트 재사용으로
             onMounted가 다시 안 돌아 데이터가 갱신되지 않는 문제를 막는다.
             query만 바뀌는 경우(목록 페이지네이션 등)는 path가 같아 remount되지 않는다. -->
        <RouterView :key="$route.path" />
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
