// api/news.js
// Backend route — safely calls NewsAPI so your key stays secret

export default async function handler(req, res) {
  // CORS headers — restrict to your own domain in production
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle preflight request
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Guard against missing API key at startup
  if (!process.env.NEWS_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  const { keyword, pageSize = 20, sortBy = 'publishedAt' } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Missing keyword parameter' });
  }

  if (keyword.length > 100) {
    return res.status(400).json({ error: 'Keyword too long (max 100 characters)' });
  }

  const safePage = Math.min(Math.max(parseInt(pageSize) || 20, 1), 100);

  // Cache responses for 60s to reduce NewsAPI rate limit usage
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&pageSize=${safePage}&sortBy=${sortBy}&language=en`;

    // Abort fetch if NewsAPI doesn't respond within 5 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': process.env.NEWS_API_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // Return simplified articles, filtering out removed/empty entries
    const articles = (data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]')
      .map(a => ({
        title: a.title || '',
        description: a.description || '',
        source: a.source?.name || 'Unknown',
        url: a.url,
        publishedAt: a.publishedAt,
      }));

    return res.status(200).json({ articles, totalResults: data.totalResults });

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'NewsAPI request timed out' });
    }
    return res.status(500).json({ error: 'Failed to fetch from NewsAPI', details: error.message });
  }
}
