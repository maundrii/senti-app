// api/news.js
// Backend route — safely calls GNews API so your key stays secret

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Missing keyword parameter' });
  }

  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(keyword)}&max=10&lang=en&token=${process.env.GNEWS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // Return simplified articles
    const articles = (data.articles || []).map(a => ({
      title: a.title || '',
      description: a.description || '',
      source: a.source?.name || 'Unknown',
      url: a.url || '#',
      publishedAt: a.publishedAt,
    }));

    return res.status(200).json({ articles });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch from GNews', details: error.message });
  }
}
