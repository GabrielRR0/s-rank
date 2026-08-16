/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    // El pool por defecto ('forks') no arranca en algunos entornos de
    // desarrollo restringidos - mismo ajuste que contract-generator.
    pool: 'threads',
    setupFiles: ['./src/test-setup.ts'],
  },
})
