// Vercel Edge Function to proxy Bilibili API requests (bypasses CORS)

export const config = {
  runtime: 'edge',
};

const BILIBILI_API = 'https://api.bilibili.com';

// Generate buvid for anonymous API access
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

  // Extract the path after /api/bili/
  const pathMatch = url.pathname.match(/^\/api\/bili\/(.*)$/);
  const biliPath = pathMatch?.[1] || '';

  if (!biliPath) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the Bilibili API URL
  const biliUrl = `${BILIBILI_API}/${biliPath}${url.search}`;

  // Generate session cookies for anonymous access
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
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Bilibili API' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
