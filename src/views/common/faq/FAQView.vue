<script setup lang="ts">
import { ref, computed } from 'vue'
import { HelpCircle, ChevronDown, Search } from '@lucide/vue'

interface FAQ {
  id: number
  q: string
  a: string
  category: string
}

const query = ref('')
const openId = ref<number | null>(null)
const activeCategory = ref('전체')

const categories = ['전체', 'HR', 'IT', '재무', '총무']

const faqs = ref<FAQ[]>([
  { id: 1, category: 'HR', q: '연차는 며칠 전까지 신청해야 하나요?', a: '연차는 사용일 기준 72시간(3일) 전까지 HR 시스템에서 신청해 주세요. 긴급 시에는 팀장 구두 승인 후 당일 등록 가능합니다.' },
  { id: 2, category: 'HR', q: '퇴직금은 언제 지급되나요?', a: '퇴직일로부터 14일 이내에 등록된 계좌로 지급됩니다. 계좌 변경이 필요한 경우 인사팀으로 연락하세요.' },
  { id: 3, category: 'IT', q: '비밀번호를 잊어버렸을 때 어떻게 하나요?', a: '헬프데스크(내선 1234)로 연락하거나 IT 지원 티켓을 통해 비밀번호 초기화를 요청해 주세요.' },
  { id: 4, category: 'IT', q: 'VPN 없이 재택 시 사내 시스템에 접근할 수 있나요?', a: '아니요, 사내 시스템 접근은 VPN이 필수입니다. VPN 설정 방법은 IT 매뉴얼을 참조하세요.' },
  { id: 5, category: '재무', q: '법인카드로 개인 용품 구매가 가능한가요?', a: '법인카드는 업무 관련 지출에만 사용 가능합니다. 개인 용품 구매 시 환수 및 징계 처리될 수 있습니다.' },
  { id: 6, category: '총무', q: '사무용품은 어디서 신청하나요?', a: '총무팀 포털 → 비품 신청 메뉴에서 신청 가능합니다. 결재 후 2~3 영업일 내 지급됩니다.' },
])

const filtered = computed(() => {
  let list = faqs.value
  if (activeCategory.value !== '전체') list = list.filter(f => f.category === activeCategory.value)
  if (query.value.trim()) list = list.filter(f => f.q.includes(query.value.trim()) || f.a.includes(query.value.trim()))
  return list
})

function toggle(id: number) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <div class="content-inner" style="max-width: 860px;">
    <div class="page-head">
      <h1 class="page-title">
        <HelpCircle :size="28" color="#f5c000" />
        자주 묻는 질문
      </h1>
      <p class="page-sub">자주 묻는 질문에 빠르게 답을 찾으세요</p>
    </div>

    <div class="search-bar" style="max-width: 480px; margin-bottom: 20px;">
      <Search :size="16" />
      <input v-model="query" placeholder="질문 검색" />
    </div>

    <div class="tag-bar">
      <button
        v-for="c in categories"
        :key="c"
        class="chip"
        :class="{ 'chip--on': activeCategory === c }"
        @click="activeCategory = c"
      >
        {{ c }}
      </button>
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 200px;">
      검색 결과가 없습니다
    </div>

    <div v-else class="faq-list">
      <div v-for="f in filtered" :key="f.id" class="card faq-item">
        <button class="faq-q" @click="toggle(f.id)">
          <span class="faq-num">Q</span>
          <span class="faq-text">{{ f.q }}</span>
          <ChevronDown :size="18" class="faq-chevron" :class="{ open: openId === f.id }" />
        </button>
        <div v-if="openId === f.id" class="faq-a">
          <span class="faq-num faq-num--a">A</span>
          <p>{{ f.a }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.chip--on { background: #2b7fff; border-color: #2b7fff; color: #fff; }
.faq-list { display: flex; flex-direction: column; gap: 10px; }
.faq-item { padding: 0; overflow: hidden; }
.faq-q {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}
.faq-num {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: #2b7fff;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.faq-num--a { background: #00a63e; }
.faq-text { flex: 1; font-size: 15px; font-weight: 600; color: #1f2430; }
.faq-chevron { color: #aeb2bb; transition: transform 0.2s; flex-shrink: 0; }
.faq-chevron.open { transform: rotate(180deg); }
.faq-a {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--line);
  background: #f9fafb;
}
.faq-a p { margin: 0; font-size: 14.5px; color: #404055; line-height: 1.7; padding-top: 2px; }
</style>
