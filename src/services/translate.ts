import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const MAX_CACHE_SIZE = 500;
const TRANSLATE_CACHE = new Map<string, string>();
const TRANSLATE_API = 'https://translate.googleapis.com';
const TRANSLATE_PROXY = (import.meta.env.VITE_TRANSLATE_PROXY_BASE as string | undefined)?.replace(/\/$/, '')
  || '/api/translate';
// Check isTauri dynamically (Tauri 2.0 uses __TAURI_INTERNALS__)
function checkIsTauri(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

// Evict oldest entries when cache exceeds max size
function cacheSet(key: string, value: string): void {
  if (TRANSLATE_CACHE.size >= MAX_CACHE_SIZE) {
    // Delete the first (oldest) entry
    const firstKey = TRANSLATE_CACHE.keys().next().value;
    if (firstKey !== undefined) {
      TRANSLATE_CACHE.delete(firstKey);
    }
  }
  TRANSLATE_CACHE.set(key, value);
}

// Use Vite proxy in dev mode, Tauri fetch in production
async function translateFetch(url: string): Promise<Response> {
  const isDev = import.meta.env.DEV;
  const useProxy = isDev || Boolean(import.meta.env.VITE_TRANSLATE_PROXY_BASE);
  const canUseWindowFetch = typeof window !== 'undefined' && !checkIsTauri();

  if (useProxy || canUseWindowFetch) {
    const targetUrl = useProxy ? url.replace(TRANSLATE_API, TRANSLATE_PROXY) : url;
    return window.fetch(targetUrl);
  }

  return tauriFetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
}

export async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  const cached = TRANSLATE_CACHE.get(text);
  if (cached) return cached;

  try {
    // Using Google Translate unofficial API
    const url = `${TRANSLATE_API}/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;

    const response = await translateFetch(url);

    if (!response.ok) {
      console.error('Translation failed:', response.status);
      return text;
    }

    const data = await response.json();

    // Google Translate returns nested arrays, the translation is in the first element
    let translated = '';
    if (Array.isArray(data) && Array.isArray(data[0])) {
      translated = data[0].map((item: unknown[]) => item[0]).join('');
    }

    if (translated) {
      cacheSet(text, translated);
      return translated;
    }

    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

export async function translateToChinese(text: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  const cacheKey = `en2zh:${text}`;
  const cached = TRANSLATE_CACHE.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${TRANSLATE_API}/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;

    const response = await translateFetch(url);

    if (!response.ok) {
      console.error('Translation failed:', response.status);
      return text;
    }

    const data = await response.json();

    let translated = '';
    if (Array.isArray(data) && Array.isArray(data[0])) {
      translated = data[0].map((item: unknown[]) => item[0]).join('');
    }

    if (translated) {
      cacheSet(cacheKey, translated);
      return translated;
    }

    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

export async function translateBatch(texts: string[]): Promise<string[]> {
  // Translate in parallel with some concurrency limit
  const results = await Promise.all(
    texts.map(text => translateToEnglish(text))
  );
  return results;
}
