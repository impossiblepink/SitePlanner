import { fetchSitemap } from '../server/sitemapFetcher.js';

export default async function handler(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Only GET requests are supported.' });
  }

  try {
    const target = Array.isArray(request.query.url) ? request.query.url[0] : request.query.url;
    if (!target) throw new Error('A sitemap URL is required.');
    const xml = await fetchSitemap(target);
    return response.status(200).json({ xml });
  } catch (error) {
    return response.status(400).json({ error: error.message || 'The sitemap could not be fetched.' });
  }
}
