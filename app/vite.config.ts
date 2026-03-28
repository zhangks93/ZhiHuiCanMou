import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 必须：Tauri 使用自定义协议加载，相对路径才能正确解析资源
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/__proxy__/ai-last-ee': {
        target: 'https://ai.last.ee',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__proxy__\/ai-last-ee/, ''),
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('react-syntax-highlighter')
            || id.includes('highlight.js')
            || id.includes('refractor')
            || id.includes('prismjs')
            || id.includes('react-markdown')
            || id.includes('remark-gfm')
            || id.includes('mdast')
            || id.includes('micromark')
            || id.includes('unified')
          ) {
            return 'vendor-markdown'
          }

          if (id.includes('recharts') || id.includes('victory-vendor')) {
            return 'vendor-charts'
          }

          if (
            id.includes('@tanstack/react-table')
            || id.includes('@dnd-kit/')
            || id.includes('@hello-pangea/dnd')
          ) {
            return 'vendor-table'
          }

          if (id.includes('@supabase/') || id.includes('@tauri-apps/')) {
            return 'vendor-platform'
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
        },
      },
    },
  },
})
