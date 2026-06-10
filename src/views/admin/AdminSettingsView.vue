<script setup lang="ts">
import { ref } from 'vue'
import { Settings, Building2, Shield, Plus, Trash2 } from '@lucide/vue'

const activeSection = ref<'departments' | 'roles' | 'system'>('departments')

interface Dept {
  id: number
  name: string
  memberCount: number
}

const departments = ref<Dept[]>([
  { id: 1, name: '인사팀', memberCount: 12 },
  { id: 2, name: 'IT지원팀', memberCount: 8 },
  { id: 3, name: '재무팀', memberCount: 9 },
  { id: 4, name: '개발1팀', memberCount: 15 },
  { id: 5, name: '마케팅팀', memberCount: 11 },
  { id: 6, name: '보안팀', memberCount: 6 },
])

const newDeptName = ref('')

function addDept() {
  const name = newDeptName.value.trim()
  if (!name) return
  departments.value.push({ id: Date.now(), name, memberCount: 0 })
  newDeptName.value = ''
}

function removeDept(id: number) {
  departments.value = departments.value.filter(d => d.id !== id)
}

const systemConfig = ref({
  maxTicketDays: 7,
  autoCloseEnabled: true,
  kbPublic: false,
  pointsPerAnswer: 30,
  pointsPerAccepted: 100,
})

const navItems = [
  { key: 'departments' as const, label: '부서 관리', icon: Building2 },
  { key: 'roles' as const, label: '역할 설정', icon: Shield },
  { key: 'system' as const, label: '시스템 설정', icon: Settings },
]
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Settings :size="28" color="#1f2430" />
        시스템 설정
      </h1>
      <p class="page-sub">플랫폼 전반 설정을 관리합니다</p>
    </div>

    <div class="settings-layout">
      <nav class="settings-nav card">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeSection === item.key }"
          @click="activeSection = item.key"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </button>
      </nav>

      <div class="settings-content">
        <!-- 부서 관리 -->
        <div v-if="activeSection === 'departments'" class="card section-card">
          <h3 class="section-title"><Building2 :size="17" /> 부서 관리</h3>

          <div class="add-row">
            <input
              v-model="newDeptName"
              class="add-input"
              placeholder="새 부서명 입력"
              @keydown.enter="addDept"
            />
            <button class="btn primary" @click="addDept">
              <Plus :size="15" /> 추가
            </button>
          </div>

          <div class="dept-list">
            <div v-for="d in departments" :key="d.id" class="dept-row">
              <Building2 :size="16" color="#aeb2bb" />
              <span class="dept-name">{{ d.name }}</span>
              <span class="badge gray">{{ d.memberCount }}명</span>
              <button class="btn" style="padding: 6px 10px; margin-left: auto;" @click="removeDept(d.id)">
                <Trash2 :size="14" color="#ef4444" />
              </button>
            </div>
          </div>
        </div>

        <!-- 역할 설정 -->
        <div v-else-if="activeSection === 'roles'" class="card section-card">
          <h3 class="section-title"><Shield :size="17" /> 역할 설정</h3>
          <div class="role-list">
            <div class="role-row">
              <div>
                <div class="role-name">USER</div>
                <div class="role-desc">일반 사용자. 티켓 요청, 워키 질문 가능.</div>
              </div>
              <span class="badge gray">기본</span>
            </div>
            <div class="role-row">
              <div>
                <div class="role-name">TEAM_ADMIN</div>
                <div class="role-desc">팀 관리자. 팀 대시보드, 티켓 처리 권한.</div>
              </div>
              <span class="badge blue">관리자</span>
            </div>
            <div class="role-row" style="border-bottom: none;">
              <div>
                <div class="role-name">SYSTEM_ADMIN</div>
                <div class="role-desc">시스템 관리자. 모든 기능 및 설정 접근 가능.</div>
              </div>
              <span class="badge green">최고 관리자</span>
            </div>
          </div>
        </div>

        <!-- 시스템 설정 -->
        <div v-else class="card section-card">
          <h3 class="section-title"><Settings :size="17" /> 시스템 설정</h3>
          <div class="config-list">
            <div class="config-row">
              <div>
                <div class="config-label">티켓 자동 종료 기간</div>
                <div class="config-desc">지정 기간 후 미처리 티켓 자동 종료</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input v-model.number="systemConfig.maxTicketDays" type="number" class="num-input" min="1" max="30" />
                <span style="color: #717182; font-size: 14px;">일</span>
              </div>
            </div>
            <div class="config-row">
              <div><div class="config-label">자동 종료 활성화</div></div>
              <label class="toggle">
                <input v-model="systemConfig.autoCloseEnabled" type="checkbox" />
                <span class="toggle-track"></span>
              </label>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">지식 베이스 외부 공개</div>
                <div class="config-desc">사내망 외 접근 허용</div>
              </div>
              <label class="toggle">
                <input v-model="systemConfig.kbPublic" type="checkbox" />
                <span class="toggle-track"></span>
              </label>
            </div>
            <div class="config-row">
              <div><div class="config-label">답변 포인트</div></div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input v-model.number="systemConfig.pointsPerAnswer" type="number" class="num-input" min="1" />
                <span style="color: #717182; font-size: 14px;">pt</span>
              </div>
            </div>
            <div class="config-row" style="border-bottom: none;">
              <div><div class="config-label">채택 답변 포인트</div></div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input v-model.number="systemConfig.pointsPerAccepted" type="number" class="num-input" min="1" />
                <span style="color: #717182; font-size: 14px;">pt</span>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
            <button class="btn primary">저장</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-layout { display: flex; gap: 20px; align-items: flex-start; }
.settings-nav { padding: 12px; width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 9px;
  border: none;
  background: none;
  color: #717182;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  width: 100%;
  text-align: left;
}
.nav-item:hover { background: #f5f6f8; }
.nav-item.active { background: #eff6ff; color: #2b7fff; }

.settings-content { flex: 1; }
.section-card { padding: 28px 32px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 22px; }

.add-row { display: flex; gap: 10px; margin-bottom: 20px; }
.add-input { flex: 1; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 14px; outline: none; }
.add-input:focus { border-color: #2b7fff; }

.dept-list { display: flex; flex-direction: column; gap: 8px; }
.dept-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); }
.dept-name { font-size: 14px; font-weight: 600; color: #1f2430; flex: 1; }

.role-list { display: flex; flex-direction: column; }
.role-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--line); }
.role-name { font-size: 14.5px; font-weight: 700; color: #1f2430; margin-bottom: 3px; }
.role-desc { font-size: 13px; color: #aeb2bb; }

.config-list { display: flex; flex-direction: column; }
.config-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--line); gap: 20px; }
.config-label { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 2px; }
.config-desc { font-size: 12.5px; color: #aeb2bb; }
.num-input { width: 64px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 14px; text-align: center; outline: none; }
.num-input:focus { border-color: #2b7fff; }

.toggle { position: relative; display: inline-block; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-track { display: block; width: 44px; height: 24px; background: #d1d5db; border-radius: 99px; transition: background 0.2s; position: relative; }
.toggle input:checked + .toggle-track { background: #2b7fff; }
.toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle input:checked + .toggle-track::after { left: 23px; }
</style>
