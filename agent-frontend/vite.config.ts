import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动分割 chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-markdown') || id.includes('remark-gfm')) {
              return 'markdown-vendor';
            }
            // React 核心库
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 生成 sourcemap（生产环境关闭）
    sourcemap: false,
    // 压缩选项
    minify: 'esbuild',
    // 目标浏览器
    target: 'es2020',
  },
  server: {
    proxy: {
      '/agent': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/user': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/conversation': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // 预加载策略
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
