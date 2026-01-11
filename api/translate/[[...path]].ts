// Vercel Edge Function to proxy Google Translate API

export const config = {
  runtime: 'edge',
};

const TRANSLATE_API = 'https://translate.googleapis.com';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const translatePath = url.pathname.replace(/^\/api\/translate\/?/, '');

  if (!translatePath) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const translateUrl = `${TRANSLATE_API}/${translatePath}${url.search}`;

  try {
    const response = await fetch(translateUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Translation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
