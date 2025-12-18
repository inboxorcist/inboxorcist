import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { execSync } from 'child_process'

// Backend API URL for proxying in development
const API_URL = 'http://localhost:6616'

// Get version from git tag at build time
function getVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  plugins: [
    TanStackRouterVite({
      quoteStyle: 'single',
      semicolons: false,
    }),
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    react(),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
      '/health': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
