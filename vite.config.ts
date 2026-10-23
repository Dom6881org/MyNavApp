import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const gpxReplayMiddleware = () => ({
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
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          response.statusCode = 404
          response.end('Local GPX replay fixture not found')
          return
        }
        next(error)
      }
    })
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), gpxReplayMiddleware()],
})
