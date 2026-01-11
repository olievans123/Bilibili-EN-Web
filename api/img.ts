import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow Bilibili image domains
  const allowedDomains = ['hdslb.com', 'bilibili.com', 'bfs'];
  const isAllowed = allowedDomains.some(domain => url.includes(domain));

  if (!isAllowed) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  // Ensure https
  const imageUrl = url.startsWith('//') ? `https:${url}` : url.replace('http:', 'https:');

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image fetch failed' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({ error: 'Image proxy failed' });
  }
}
