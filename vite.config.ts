import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/momentum/', // 新增：适配部署在 /momentum 子目录的路径配置
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});