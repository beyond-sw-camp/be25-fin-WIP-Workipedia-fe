<script setup lang="ts">
import { computed } from 'vue'

interface Bar { label: string; v: number }
const props = defineProps<{ data: Bar[]; color: string; w?: number; h?: number }>()

const bars = computed(() => {
  const W = props.w ?? 460, H = props.h ?? 260
  const pad = { l: 78, r: 18, t: 8, b: 24 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const mx = Math.max(...props.data.map(d => d.v)) * 1.1
  const bh = ih / props.data.length
  return props.data.map((d, i) => {
    const y = pad.t + i * bh + bh * 0.18
    return { label: d.label, lx: pad.l - 10, ty: y + bh * 0.42, x: pad.l, y, bw: (d.v / mx) * iw, bh: bh * 0.62 }
  })
})
const vb = computed(() => `0 0 ${props.w ?? 460} ${props.h ?? 260}`)
</script>

<template>
  <svg :viewBox="vb" style="width:100%;height:auto">
    <g v-for="(b, i) in bars" :key="i">
      <text :x="b.lx" :y="b.ty" text-anchor="end" font-size="12" fill="#4b5563">{{ b.label }}</text>
      <rect :x="b.x" :y="b.y" :width="b.bw" :height="b.bh" rx="4" :fill="color" />
    </g>
  </svg>
</template>
