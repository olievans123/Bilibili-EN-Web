// Vercel Edge Function to proxy Bilibili Passport API requests (for QR login)

export const config = {
  runtime: 'edge',
};

const BILIBILI_PASSPORT = 'https://passport.bilibili.com';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Extract the path after /api/passport/
  const pathMatch = url.pathname.match(/^\/api\/passport\/(.*)$/);
  const passportPath = pathMatch?.[1] || '';

  if (!passportPath) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the Bilibili Passport API URL
  const passportUrl = `${BILIBILI_PASSPORT}/${passportPath}${url.search}`;

  try {
    const response = await fetch(passportUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });

    const data = await response.text();

    // Forward Set-Cookie headers if present
    const responseHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };

    return new Response(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Passport proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Passport API request failed' }),
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
