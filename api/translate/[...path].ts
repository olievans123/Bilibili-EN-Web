// Vercel Edge Function to proxy Google Translate API requests

export const config = {
  runtime: 'edge',
};

const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Extract the path after /api/translate/
  const pathMatch = url.pathname.match(/^\/api\/translate\/(.*)$/);
  const translatePath = pathMatch?.[1] || '';

  if (!translatePath) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the Google Translate API URL
  const translateUrl = `${GOOGLE_TRANSLATE_API}/${translatePath}${url.search}`;

  try {
    const response = await fetch(translateUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Translate proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Translation failed' }),
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
