/**
 * 고객사 페이지에 Workipedia 챗봇 위젯을 삽입하는 엔트리 포인트.
 * vite.config.widget.ts의 lib 모드로 IIFE 번들로 빌드되어
 * <script src="...widget.js" data-key data-theme data-position> 한 줄로 제공된다.
 */
import { createApp } from 'vue'
import WidgetApp from './WidgetApp.vue'
import { readWidgetConfig } from './config'

// ⚠️ 모듈 평가(= 스크립트 동기 실행) 시점에 설정을 읽어야 한다.
// readWidgetConfig 내부에서 document.currentScript 로 <script> 태그를 찾는데,
// DOMContentLoaded 콜백 등 이후 시점에는 currentScript 가 null 이 되기 때문이다.
const config = readWidgetConfig()

function mountWidget() {
  // 중복 마운트 방지 — SPA 환경에서 스크립트가 두 번 실행될 경우를 대비
  if (document.getElementById('workipedia-chat-root')) return
  const root = document.createElement('div')
  root.id = 'workipedia-chat-root'
  document.body.appendChild(root)
  createApp(WidgetApp, { config }).mount('#workipedia-chat-root')
}

// <script async> 로 로드되면 스크립트 실행 시점에 DOMContentLoaded가
// 이미 지나 있어 이벤트 리스너가 영원히 트리거되지 않는다.
// readyState로 현재 상태를 먼저 확인하고, DOM이 준비됐으면 즉시 마운트한다.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', mountWidget)
} else {
  mountWidget()
}
