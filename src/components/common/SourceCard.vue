<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@lucide/vue'

export interface Source {
  type: string
  cls: 'blue' | 'green' | 'gray' | 'purple' | 'orange'
  meta: string
  date?: string
  body?: string   // API에 content snippet 필드 추가 시 채워짐
  link: string
  url?: string    // 내부 라우트 경로 (예: /manuals/10)
}

const props = defineProps<{ source: Source }>()
const router = useRouter()

function navigateToSource() {
  if (props.source.url) router.push(props.source.url)
}

const borderColor = computed(() => ({
  blue: '#cfe0ff', green: '#bfe9cf', gray: '#e5e7eb', purple: '#ddd6fe', orange: '#fed7aa',
}[props.source.cls]))

const bgColor = computed(() => ({
  blue: '#f3f8ff', green: '#f2fcf6', gray: '#fafafa', purple: '#f5f3ff', orange: '#fff7ed',
}[props.source.cls]))

const badgeStyle = computed(() => ({
  blue: { background: '#2b7fff', color: '#fff' },
  green: { background: '#00a63e', color: '#fff' },
  gray: { background: '#eef0f3', color: '#4b5563' },
  purple: { background: '#8b5cf6', color: '#fff' },
  orange: { background: '#ea580c', color: '#fff' },
}[props.source.cls]))
</script>

<template>
  <div class="source-card" :style="{ border: `1px solid ${borderColor}`, background: bgColor }">
    <div class="source-header">
      <span class="source-badge" :style="badgeStyle">{{ source.type }}</span>
      <span class="source-meta">{{ source.meta }}</span>
      <span v-if="source.date" class="source-date">{{ source.date }}</span>
    </div>
    <p v-if="source.body" class="source-body">{{ source.body }}</p>
    <button class="source-link" @click="navigateToSource">
      {{ source.link }} <ArrowRight :size="15" />
    </button>
  </div>
</template>

<style scoped>
.source-card { border-radius: 14px; padding: 18px 20px; }
.source-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.source-badge { padding: 3px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 600; }
.source-meta { color: #717182; font-size: 13px; }
.source-date { margin-left: auto; color: #9a9aa8; font-size: 13px; }
.source-body { font-size: 15.5px; line-height: 1.7; color: #1f2430; margin: 0; }
.source-link {
  margin-top: 12px;
  color: #2b7fff;
  font-weight: 600;
  font-size: 14px;
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
}
</style>
