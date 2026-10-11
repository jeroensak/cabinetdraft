import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { seoPlugin } from './build/seo.ts'
import { defaultSiteUrl } from './src/app/pageMetadata.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      seoPlugin(env.SITE_URL || defaultSiteUrl),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'build/**/*.test.ts'],
    },
  }
})
