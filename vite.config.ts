import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // sockjs-client가 참조하는 Node 전역 `global`을 브라우저용 globalThis로 매핑 (Vite + SockJS 표준 해결책)
  define: {
    global: 'globalThis',
  },
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    include: ['sockjs-client', '@stomp/stompjs'],
  },
})
