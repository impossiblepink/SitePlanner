import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const isPrivateAddress = (address) => {
  if (address === '::1' || address.startsWith('fe80:') || address.startsWith('fc') || address.startsWith('fd')) return true
  if (isIP(address) !== 4) return false
  const [a, b] = address.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
}

const validateRemoteUrl = async (value) => {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS sitemap URLs are supported.')
  if (url.username || url.password) throw new Error('Sitemap URLs cannot contain credentials.')
  const addresses = await lookup(url.hostname, { all: true })
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private and local network addresses are not supported.')
  }
  return url
}

const fetchSitemap = async (startingUrl) => {
  let currentUrl = await validateRemoteUrl(startingUrl)
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/xml,text/xml,*/*',
        'User-Agent': 'SitePlanner/1.0 sitemap importer'
      }
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('The sitemap redirected without a destination.')
      currentUrl = await validateRemoteUrl(new URL(location, currentUrl).href)
      continue
    }
    if (!response.ok) throw new Error(`The sitemap server returned HTTP ${response.status}.`)
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 10_000_000) throw new Error('The sitemap file is larger than 10 MB.')
    const xml = await response.text()
    if (xml.length > 10_000_000) throw new Error('The sitemap file is larger than 10 MB.')
    return xml
  }
  throw new Error('The sitemap redirected too many times.')
}

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
  base: '/SitePlanner/',
})
