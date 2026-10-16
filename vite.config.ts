/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 项目站点的地址是 https://用户名.github.io/game-prova/，
// 所以构建后的资源路径必须以 /game-prova/ 开头。
export default defineConfig({
  base: '/game-prova/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
