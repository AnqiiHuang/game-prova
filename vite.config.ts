/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让构建结果使用相对路径，
// 这样放到 GitHub Pages 的仓库子路径（如 /仓库名/）下也能正常加载。
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
