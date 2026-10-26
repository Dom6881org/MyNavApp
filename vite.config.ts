import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pkg from './package.json' with { type: 'json' }

const gpxReplayMiddleware = (): Plugin => ({
  name: 'local-gpx-replay',
  configureServer(server) {
    server.middlewares.use('/__test-data/navionics-track.json', async (request, response, next) => {
      if (request.method !== 'GET') {
        next()
        return
      }

      const remoteAddress = request.socket.remoteAddress
      const isLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'
      if (!isLoopback) {
        response.statusCode = 403
        response.end('Forbidden')
        return
      }

      try {
        const fixturePath = fileURLToPath(new URL('./test-data/navionics-track.json', import.meta.url))
        const fixture = await readFile(fixturePath)
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(fixture)
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
          response.statusCode = 404
          response.end('Local GPX replay fixture not found')
          return
        }
        next(error)
      }
    })
  }
})

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
    plugins: [react(), gpxReplayMiddleware()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
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
