<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import { useDeptStore } from '@/stores/deptStore'

const deptStore = useDeptStore()
const route = useRoute()
onMounted(() => deptStore.load())
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="app-main">
      <Header />
      <main class="app-content">
        <!-- meta.keepAlive=true인 뷰(SearchView 등)는 keep-alive로 인스턴스를 캐시해
             상세 → 뒤로가기 시 검색 결과 등 상태를 그대로 유지한다.
             나머지 뷰는 :key="route.path"로 경로 변경 시 항상 remount된다. -->
        <RouterView v-slot="{ Component }">
          <keep-alive :include="['SearchView']">
            <component
              :is="Component"
              :key="route.meta?.keepAlive ? String(route.name) : route.path"
            />
          </keep-alive>
        </RouterView>
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
