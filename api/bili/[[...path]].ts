// Vercel Edge Function to proxy Bilibili API requests

export const config = {
  runtime: 'edge',
};

const BILIBILI_API = 'https://api.bilibili.com';

function generateBuvid(): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Extract path after /api/bili
  const biliPath = url.pathname.replace(/^\/api\/bili\/?/, '');

  if (!biliPath) {
    return new Response(JSON.stringify({ error: 'Missing path', pathname: url.pathname }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const biliUrl = `${BILIBILI_API}/${biliPath}${url.search}`;

  const buvid3 = generateBuvid();
  const buvid4 = generateBuvid();
  const cookies = `buvid3=${buvid3}; buvid4=${buvid4}; b_nut=${Date.now()}`;

  try {
    const response = await fetch(biliUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': cookies,
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy failed', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
