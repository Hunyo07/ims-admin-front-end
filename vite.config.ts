import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import circleDependency from 'vite-plugin-circular-dependency';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    circleDependency({
      outputFilePath: './circleDepReport.txt',
    }),

  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),  
      vue: 'vue/dist/vue.esm-bundler.js',
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/views/')) {
            return 'views';
          }
          if (id.includes('/src/components/')) {
            return 'components';
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000 // (in KB, e.g., 1500 = 1.5MB)
  }
})
