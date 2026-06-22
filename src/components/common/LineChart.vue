<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  data: number[]
  color: string
  labels?: string[]
  tooltipLabel?: string
  fixedMax?: number   // 설정 시 y축 max 고정, 눈금 25/50/75/100 사용
  max?: number
  w?: number
  h?: number
}>()

const W = computed(() => props.w ?? 460)
const H = computed(() => props.h ?? 220)
const pad = { l: 42, r: 12, t: 14, b: 28 }

// 원시 최댓값(예: 265)을 그대로 y축에 쓰면 265/199/133/66/0 같은 비직관적 눈금이 생김.
// 5/10/25/50 단위로 올림해 눈금 수가 5개 이하인 가장 작은 nice 값을 선택.
function niceAxisMax(dataMax: number): { max: number; step: number } {
  if (dataMax <= 0) return { max: 10, step: 2 }
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
  for (const s of candidates) {
    const m = Math.ceil(dataMax / s) * s
    if (m / s <= 5) return { max: m, step: s }
  }
  return { max: dataMax, step: Math.ceil(dataMax / 5) }
}

const geo = computed(() => {
  const iw = W.value - pad.l - pad.r
  const ih = H.value - pad.t - pad.b
  const rawMax = Math.max(0, props.max ?? 0, ...(props.data.length ? props.data : [0]))
  const { max: mx, step } = props.fixedMax
    ? { max: props.fixedMax, step: 25 }
    : niceAxisMax(rawMax)
  const n = Math.max(props.data.length - 1, 1)
  const pts = props.data.map((v, i) => ({
    x: pad.l + (i / n) * iw,
    y: pad.t + ih - (v / mx) * ih,
  }))
  const path = pts
    .map((p, i) => `${i ? 'L' : 'M'}${(p?.x ?? 0).toFixed(1)} ${(p?.y ?? 0).toFixed(1)}`)
    .join(' ')

  const yt = props.fixedMax
    ? [100, 75, 50, 25, 0].map(v => ({
        y: pad.t + ih - (v / mx) * ih,
        label: v,
      }))
    : Array.from({ length: Math.round(mx / step) + 1 }, (_, i) => ({
        y: pad.t + ih - ((mx - i * step) / mx) * ih,
        label: mx - i * step,
      }))

  const xl = props.data.map((_, i) => ({
    x: pad.l + (i / n) * iw,
    label: props.labels?.[i] ?? `${i + 1}월`,
  }))
  return { pts, path, yt, xl }
})

const vb = computed(() => `0 0 ${W.value} ${H.value}`)
const hoveredIdx = ref<number | null>(null)

function onMouseMove(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  let minD = Infinity, best = 0
  geo.value.pts.forEach((p, i) => {
    const d = Math.abs((p?.x ?? 0) - svgPt.x)
    if (d < minD) { minD = d; best = i }
  })
  hoveredIdx.value = best
}

// vue-tsc strict 모드에서 배열 인덱스 접근은 T | undefined를 반환하므로
// 템플릿에서 직접 geo.value.pts[idx]?.x 형태로 쓰면 타입 에러 발생 → 독립 computed로 분리
const tipRaw = computed(() =>
  hoveredIdx.value !== null ? (geo.value.pts[hoveredIdx.value] ?? null) : null,
)
const tipX = computed(() => tipRaw.value?.x ?? 0)
const tipY = computed(() => tipRaw.value?.y ?? 0)
const tipLabel = computed(() =>
  hoveredIdx.value !== null ? (geo.value.xl[hoveredIdx.value]?.label ?? '') : '',
)
const tipValue = computed(() =>
  hoveredIdx.value !== null ? (props.data[hoveredIdx.value] ?? '') : '',
)
const tipPos = computed(() => {
  if (tipRaw.value === null) return { x: 0, y: 0 }
  const tw = 140
  return {
    x: tipX.value + 12 + tw > W.value ? tipX.value - tw - 4 : tipX.value + 12,
    y: Math.max(pad.t, tipY.value - 50),
  }
})
const tipVisible = computed(() => tipRaw.value !== null)
</script>

<template>
  <svg :viewBox="vb" style="width:100%;height:auto;cursor:crosshair;overflow:visible"
    @mousemove="onMouseMove" @mouseleave="hoveredIdx = null">

    <g v-for="(t, i) in geo.yt" :key="'y' + i">
      <line :x1="pad.l" :y1="t.y" :x2="W - pad.r" :y2="t.y"
        stroke="#eef0f3" stroke-width="1" stroke-dasharray="3 4" />
      <text :x="pad.l - 6" :y="t.y + 4" text-anchor="end" font-size="11" fill="#9a9aa8">{{ t.label }}</text>
    </g>

    <text v-for="(x, i) in geo.xl" :key="'x' + i"
      :x="x.x" :y="H - 8" text-anchor="middle" font-size="11" fill="#9a9aa8">{{ x.label }}</text>

    <!-- hover 수직 안내선 -->
    <line v-if="tipVisible"
      :x1="tipX" :y1="pad.t" :x2="tipX" :y2="H - pad.b"
      stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3" />

    <path :d="geo.path" fill="none" :stroke="color"
      stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />

    <circle v-for="(p, i) in geo.pts" :key="'p' + i"
      :cx="p?.x ?? 0" :cy="p?.y ?? 0" :r="hoveredIdx === i ? 6 : 4"
      :fill="hoveredIdx === i ? color : '#fff'" :stroke="color" stroke-width="2.5" />

    <!-- SVG 인라인 툴팁 -->
    <g v-if="tipVisible">
      <rect :x="tipPos.x" :y="tipPos.y" width="140" height="50"
        rx="6" fill="white" stroke="#e2e8f0" stroke-width="1.2"
        style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
      <text :x="tipPos.x + 10" :y="tipPos.y + 18"
        font-size="12" font-weight="700" fill="#1f2430">{{ tipLabel }}</text>
      <text :x="tipPos.x + 10" :y="tipPos.y + 37"
        font-size="11.5" :fill="color" font-weight="600">
        {{ tooltipLabel ?? '값' }} : {{ tipValue }}
      </text>
    </g>
  </svg>
</template>
