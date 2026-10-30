/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import pkg from './package.json' with { type: 'json' }

// Optional HTTPS for LAN access (browser geolocation requires a secure context):
// set VITE_HTTPS_CERT and VITE_HTTPS_KEY (in .env or the environment) to the
// paths of a certificate trusted by the client devices, e.g. generated with
// mkcert for "localhost <pc-lan-ip>".
const loadHttpsConfig = async (env: Record<string, string>) => {
  const certPath = env.VITE_HTTPS_CERT
  const keyPath = env.VITE_HTTPS_KEY
  if (!certPath || !keyPath) return undefined

  try {
    return {
      cert: await readFile(certPath),
      key: await readFile(keyPath)
    }
  } catch (error) {
    console.warn(`Unable to read HTTPS certificate files (${certPath}, ${keyPath}); starting without HTTPS.`)
    console.warn(error instanceof Error ? error.message : String(error))
    return undefined
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_HTTPS_')

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}']
    },
    server: {
      host: process.env.VITE_HOST ?? '127.0.0.1',
      https: await loadHttpsConfig(env),
      proxy: {
        '/api': `http://127.0.0.1:${process.env.PORT ?? '3001'}`
      }
    }
  }
})
