<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: number[]; color: string; max?: number; w?: number; h?: number }>()

const geo = computed(() => {
  const W = props.w ?? 460, H = props.h ?? 220
  const pad = { l: 38, r: 12, t: 14, b: 28 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const mx = props.max ?? Math.max(...props.data) * 1.15
  const pts = props.data.map((v, i) => ({
    x: pad.l + (i / (props.data.length - 1)) * iw,
    y: pad.t + ih - (v / mx) * ih,
  }))
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const yt = Array.from({ length: 5 }).map((_, i) => ({
    y: pad.t + (i / 4) * ih,
    label: Math.round(mx - (i / 4) * mx),
  }))
  const xl = props.data.map((_, i) => ({
    x: pad.l + (i / (props.data.length - 1)) * iw,
    label: `${i + 1}월`,
  }))
  return { pts, path, yt, xl }
})
const vb = computed(() => `0 0 ${props.w ?? 460} ${props.h ?? 220}`)
</script>

<template>
  <svg :viewBox="vb" style="width:100%;height:auto">
    <g v-for="(t, i) in geo.yt" :key="'y' + i">
      <line :x1="38" :y1="t.y" :x2="(w ?? 460) - 12" :y2="t.y" stroke="#eef0f3" stroke-width="1" stroke-dasharray="3 4" />
      <text :x="30" :y="t.y + 4" text-anchor="end" font-size="11" fill="#9a9aa8">{{ t.label }}</text>
    </g>
    <text v-for="(x, i) in geo.xl" :key="'x' + i" :x="x.x" :y="(h ?? 220) - 8" text-anchor="middle" font-size="11" fill="#9a9aa8">{{ x.label }}</text>
    <path :d="geo.path" fill="none" :stroke="color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    <circle v-for="(p, i) in geo.pts" :key="'p' + i" :cx="p.x" :cy="p.y" r="4" fill="#fff" :stroke="color" stroke-width="2.5" />
  </svg>
</template>
