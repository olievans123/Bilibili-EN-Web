import type { VercelRequest, VercelResponse } from '@vercel/node';

const BILIBILI_API = 'https://api.bilibili.com';
const TRANSLATE_API = 'https://translate.googleapis.com';
const PASSPORT_API = 'https://passport.bilibili.com';

function generateBuvid(): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { service, path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';

  let targetUrl: string;
  let headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  if (service === 'bili') {
    const buvid3 = generateBuvid();
    const buvid4 = generateBuvid();
    targetUrl = `${BILIBILI_API}/${pathStr}`;
    headers = {
      ...headers,
      'Referer': 'https://www.bilibili.com',
      'Origin': 'https://www.bilibili.com',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cookie': `buvid3=${buvid3}; buvid4=${buvid4}; b_nut=${Date.now()}`,
    };
  } else if (service === 'translate') {
    targetUrl = `${TRANSLATE_API}/${pathStr}`;
  } else if (service === 'passport') {
    targetUrl = `${PASSPORT_API}/${pathStr}`;
    headers['Referer'] = 'https://www.bilibili.com';
  } else {
    return res.status(400).json({ error: 'Invalid service' });
  }

  // Append query string (excluding service and path)
  const url = new URL(targetUrl);
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'service' && key !== 'path') {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: req.method || 'GET',
      headers,
    });

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy failed', details: String(error) });
  }
}
