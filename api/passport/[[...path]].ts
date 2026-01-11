// Vercel Edge Function to proxy Bilibili Passport API

export const config = {
  runtime: 'edge',
};

const PASSPORT_API = 'https://passport.bilibili.com';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const passportPath = url.pathname.replace(/^\/api\/passport\/?/, '');

  if (!passportPath) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const passportUrl = `${PASSPORT_API}/${passportPath}${url.search}`;

  try {
    const response = await fetch(passportUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Passport request failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
