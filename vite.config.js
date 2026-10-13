import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchSitemap } from './server/sitemapFetcher.js'

const sitemapProxy = () => {
  const handleRequest = async (request, response, next) => {
    const requestUrl = new URL(request.url, 'http://localhost')
    if (!requestUrl.pathname.endsWith('/api/sitemap')) return next()

    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      const target = requestUrl.searchParams.get('url')
      if (!target) throw new Error('A sitemap URL is required.')
      const xml = await fetchSitemap(target)
      response.statusCode = 200
      response.end(JSON.stringify({ xml }))
    } catch (error) {
      response.statusCode = 400
      response.end(JSON.stringify({ error: error.message || 'The sitemap could not be fetched.' }))
    }
  }

  return {
    name: 'site-planner-sitemap-proxy',
    configureServer(server) {
      server.middlewares.use(handleRequest)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sitemapProxy()],
  base: process.env.VERCEL ? '/' : '/SitePlanner/',
})
