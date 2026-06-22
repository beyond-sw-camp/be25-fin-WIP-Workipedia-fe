<script setup lang="ts">
// 공통 확인 모달 컴포넌트.
// v-model로 표시 여부를 제어하고, @confirm 이벤트로 확인 액션을 수신한다.
// danger=true 시 확인 버튼이 빨간색으로 전환되어 파괴적 작업(삭제 등)을 시각적으로 구분한다.
// message 외 커스텀 콘텐츠가 필요하면 기본 슬롯을 사용한다.
withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}>(), {
  confirmLabel: '확인',
  cancelLabel: '취소',
  danger: false,
})

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="$emit('update:modelValue', false)">
        <div class="modal-box" role="dialog" aria-modal="true">
          <h3 class="modal-title">{{ title }}</h3>
          <p v-if="message" class="modal-message">{{ message }}</p>
          <slot />
          <div class="modal-footer">
            <button class="btn" @click="$emit('update:modelValue', false)">{{ cancelLabel }}</button>
            <button
              class="btn"
              :class="danger ? 'modal-danger' : 'primary'"
              @click="$emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  min-width: 360px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 17px;
  font-weight: 800;
  color: #1f2430;
  margin: 0 0 10px;
}

.modal-message {
  font-size: 14px;
  color: #717182;
  line-height: 1.65;
  margin: 0 0 4px;
  white-space: pre-line;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

/* danger 확인 버튼 — global .btn 위에 덮어씀 */
.modal-danger {
  background: #e7000b !important;
  color: #fff !important;
  border-color: #e7000b !important;
}
.modal-danger:hover:not(:disabled) {
  background: #c10007 !important;
  border-color: #c10007 !important;
}

/* 페이드 + 살짝 올라오는 진입/퇴장 트랜지션 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: translateY(12px);
  opacity: 0;
}
</style>
