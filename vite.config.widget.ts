import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  publicDir: false,  // widget 빌드 시 public 폴더 복사 불필요 (outDir과 동일 경로 경고 방지)
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/open-api/main.ts'),
      formats: ['iife'],
      name: 'WorkipediaChat',
      fileName: 'workipedia-chat',
    },
    rollupOptions: {
      // Vue 등 모든 의존성을 번들에 포함 — 고객사가 별도 설치 없이 스크립트 한 줄로 동작해야 하므로
      external: [],
    },
    outDir: 'public',      // 빌드 결과를 public에 두면 dev 서버에서 바로 접근 가능
    emptyOutDir: false,    // public 폴더의 기존 파일(index.html 등) 삭제 방지
    cssCodeSplit: false,   // CSS를 별도 파일로 분리 (workipedia-chat.css → 데모 HTML에서 함께 로드)
  },
})
