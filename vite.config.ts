import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Generate stable buvid cookies for the dev session
function generateBuvid(): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

const buvid3 = generateBuvid();
const buvid4 = generateBuvid();
const buvidCookie = `buvid3=${buvid3}; buvid4=${buvid4}; b_nut=${Date.now()}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      // Redirect Tauri imports to web shims
      '@tauri-apps/plugin-http': path.resolve(__dirname, 'src/shims/tauri-plugin-http.ts'),
      '@tauri-apps/plugin-store': path.resolve(__dirname, 'src/shims/tauri-plugin-store.ts'),
      '@tauri-apps/plugin-shell': path.resolve(__dirname, 'src/shims/tauri-plugin-shell.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, 'src/shims/tauri-api-window.ts'),
    },
  },
  server: {
    strictPort: true,
    proxy: {
      '/api/bili': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bili/, ''),
        headers: {
          'Referer': 'https://www.bilibili.com',
          'Origin': 'https://www.bilibili.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cookie': buvidCookie,
        },
      },
      '/api/translate': {
        target: 'https://translate.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/translate/, ''),
        timeout: 5000,
      },
      '/api/passport': {
        target: 'https://passport.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/passport/, ''),
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      // Catch-all proxy for all Bilibili images (hdslb.com CDN)
      '/img/hdslb': {
        target: 'https://i0.hdslb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/img\/hdslb/, ''),
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
    },
  },
})
