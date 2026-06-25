import { fileURLToPath, URL } from 'node:url'
import { existsSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// public/<폴더>/index.html 을 `.html` 없이 디렉터리 주소(예: /widget/)로 접근 가능하게 한다.
// Vite dev 서버는 public 디렉터리 인덱스를 자동으로 열지 않고 SPA 폴백이 메인 앱을 내보내므로,
// 정적 파일이 실제로 존재하면 폴백보다 먼저 해당 index.html로 rewrite 한다.
function publicDirIndexFallback(): Plugin {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url))
  return {
    name: 'public-dir-index-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method === 'GET' && req.url) {
          const [path, query = ''] = req.url.split('?')
          const base = path.replace(/\/$/, '') // 끝 슬래시 제거
          if (base && !base.includes('.')) {
            const file = `${publicDir}${base}/index.html`
            if (existsSync(file)) {
              req.url = `${base}/index.html${query ? `?${query}` : ''}`
            }
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  // sockjs-client가 참조하는 Node 전역 `global`을 브라우저용 globalThis로 매핑 (Vite + SockJS 표준 해결책)
  define: {
    global: 'globalThis',
  },
  plugins: [
    vue(),
    tailwindcss(),
    publicDirIndexFallback(),
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
