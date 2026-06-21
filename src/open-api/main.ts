import { createApp } from 'vue'
import WidgetApp from './WidgetApp.vue'

// 고객사 DOM에 위젯 루트 엘리먼트를 동적으로 주입하고 Vue 앱을 마운트한다.
// DOMContentLoaded 이후 실행되므로 async/defer 속성과 함께 사용해야 한다.
window.addEventListener('DOMContentLoaded', () => {
  const root = document.createElement('div')
  root.id = 'workipedia-chat-root'
  document.body.appendChild(root)
  createApp(WidgetApp).mount('#workipedia-chat-root')
})
