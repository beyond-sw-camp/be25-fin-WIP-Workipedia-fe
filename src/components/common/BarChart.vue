<script setup lang="ts">
import { computed, ref } from 'vue'

interface Bar { label: string; v: number }
const props = defineProps<{
  data: Bar[]
  color: string
  tooltipLabel?: string
  fixedMax?: number   // 설정 시 해당 값을 차트 max로 고정 (x축 25/50/75/100 눈금 사용)
  w?: number
  h?: number
}>()

const W = computed(() => props.w ?? 460)
const H = computed(() => props.h ?? 260)
const pad = { l: 78, r: 18, t: 8, b: 30 }

const C = computed(() => {
  const iw = W.value - pad.l - pad.r
  const ih = H.value - pad.t - pad.b
  const rawMax = props.data.length ? Math.max(...props.data.map(d => d.v)) : 0
  // 1.1 배수로 10% 여백을 둬 최대 바가 차트 끝에 딱 붙지 않게 함. || 1은 모든 값이 0일 때 0-division 방지
  const mx = props.fixedMax ?? (rawMax * 1.1 || 1)
  const bh = ih / Math.max(props.data.length, 1)
  const items = props.data.map((d, i) => {
    const y = pad.t + i * bh + bh * 0.15
    return {
      label: d.label, v: d.v,
      lx: pad.l - 10, ty: y + bh * 0.45,
      x: pad.l, y, bw: (d.v / mx) * iw, bh: bh * 0.7,
    }
  })
  // fixedMax 설정 시 25/50/75/100 고정 눈금, 아니면 데이터 기반 5단계
  const xt = props.fixedMax
    ? [0, 25, 50, 75, 100].map(v => ({ x: pad.l + (v / props.fixedMax!) * iw, label: v }))
    : Array.from({ length: 5 }).map((_, i) => ({
        x: pad.l + (i / 4) * iw,
        label: Math.round((i / 4) * mx),
      }))
  return { iw, items, xt, axisY: H.value - pad.b }
})

const vb = computed(() => `0 0 ${W.value} ${H.value}`)
const hoveredIdx = ref<number | null>(null)

// 툴팁이 오른쪽을 벗어나면 바 왼쪽에 표시
const tipItem = computed(() =>
  hoveredIdx.value !== null ? (C.value.items[hoveredIdx.value] ?? null) : null,
)
const tipPos = computed(() => {
  if (tipItem.value === null) return { x: 0, y: 0 }
  const { x, bw, y } = tipItem.value
  const tw = 140
  const tx = x + bw + 8 + tw > W.value ? x + bw - tw - 4 : x + bw + 8
  return { x: tx, y: Math.max(pad.t, y - 2) }
})
</script>

<template>
  <svg :viewBox="vb" style="width:100%;height:auto;overflow:visible">

    <!-- x축 수직 그리드라인 + 눈금 레이블 -->
    <g v-for="(t, i) in C.xt" :key="'xt' + i">
      <line :x1="t.x" :y1="pad.t" :x2="t.x" :y2="C.axisY"
        stroke="#eef0f3" stroke-width="1" stroke-dasharray="3 4" />
      <text :x="t.x" :y="H - 6" text-anchor="middle" font-size="11" fill="#9a9aa8">{{ t.label }}</text>
    </g>

    <!-- x축 베이스라인 -->
    <line :x1="pad.l" :y1="C.axisY" :x2="W - pad.r" :y2="C.axisY"
      stroke="#e2e8f0" stroke-width="1" />

    <!-- 바 + 레이블 -->
    <g v-for="(b, i) in C.items" :key="i" style="cursor:pointer"
      @mouseenter="hoveredIdx = i" @mouseleave="hoveredIdx = null">
      <text :x="b.lx" :y="b.ty" text-anchor="end" font-size="12" fill="#4b5563">{{ b.label }}</text>
      <rect :x="b.x" :y="b.y" :width="b.bw" :height="b.bh" rx="4"
        :fill="color" :opacity="hoveredIdx === i ? 0.75 : 1" />
    </g>

    <!-- SVG 인라인 툴팁 -->
    <g v-if="tipItem !== null">
      <rect :x="tipPos.x" :y="tipPos.y" width="140" height="50"
        rx="6" fill="white" stroke="#e2e8f0" stroke-width="1.2"
        style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
      <text :x="tipPos.x + 10" :y="tipPos.y + 18"
        font-size="12" font-weight="700" fill="#1f2430">
        {{ tipItem?.label }}
      </text>
      <text :x="tipPos.x + 10" :y="tipPos.y + 37"
        font-size="11.5" :fill="color" font-weight="600">
        {{ tooltipLabel ?? '값' }} : {{ tipItem?.v }}
      </text>
    </g>
  </svg>
</template>
