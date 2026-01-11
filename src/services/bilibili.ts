import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type {
  BiliVideo,
  BiliUser,
  BiliTrendingResult,
  BiliSearchResult,
  BiliComment,
  BiliCommentsResult,
  BiliChannel,
  BiliChannelVideosResult,
} from '../types/bilibili';
import { translateToEnglish, translateToChinese } from './translate';

const API_BASE = 'https://api.bilibili.com';
const WWW_BASE = 'https://www.bilibili.com';
const SPACE_BASE = 'https://space.bilibili.com';
const PROXY_API_BASE = (import.meta.env.VITE_BILI_PROXY_BASE as string | undefined)?.replace(/\/$/, '')
  || '/api/bili'; // Vite proxy for dev mode or user-provided proxy base
const BVID_TABLE = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF';
const BVID_POSITIONS = [11, 10, 3, 8, 4, 6];
const BVID_XOR = 177451812n;
const BVID_ADD = 8728348608n;
const aidCache = new Map<string, number>();

// Check isTauri dynamically (Tauri 2.0 uses __TAURI_INTERNALS__)
function checkIsTauri(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

const WBI_CACHE_TTL = 60 * 60 * 1000;
const WBI_MIXIN_KEY_MAP = [
  46, 47, 18, 2, 53, 8, 23, 32,
  15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63,
  57, 62, 11, 36, 20, 34, 44, 52,
];

type WbiKeys = {
  imgKey: string;
  subKey: string;
  mixinKey: string;
  fetchedAt: number;
};

// Use Vite proxy in dev mode (more reliable), Tauri fetch in production
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const proxyUrl = url.startsWith(API_BASE) ? url.replace(API_BASE, PROXY_API_BASE) : url;
  const isDev = import.meta.env.DEV;
  const useProxy = isDev || Boolean(import.meta.env.VITE_BILI_PROXY_BASE);

  if (checkIsTauri()) {
    console.log('[API] Using Tauri fetch:', url);
    try {
      const response = await tauriFetch(url, options);
      console.log('[API] Tauri fetch success:', response.status, response.statusText);
      return response;
    } catch (error) {
      console.error('[API] Tauri fetch error:', error);
      // Store error for debugging
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).lastTauriFetchError = {
          url,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  if (useProxy) {
    // In development, use Vite proxy which handles CORS and headers correctly
    console.log('[API] Using Vite proxy:', proxyUrl);
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    return window.fetch(proxyUrl, {
      ...options,
      headers,
    });
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return window.fetch(url, {
    ...options,
    headers,
  });
}

let storedCookies: string = '';

// Generate buvid cookies for anonymous API access (prevents -352 error)
function generateBuvid(): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  // Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

// Cache buvid cookies for the session
let buvidCookies: string | null = null;

export function getBuvidCookies(): string {
  if (!buvidCookies) {
    const buvid3 = generateBuvid();
    const buvid4 = generateBuvid();
    buvidCookies = `buvid3=${buvid3}; buvid4=${buvid4}; b_nut=${Date.now()}`;
  }
  return buvidCookies;
}

export function setCookies(cookies: string) {
  storedCookies = cookies;
}

export function getCookies(): string {
  return storedCookies;
}

// Helper to translate video details (titles and channel names)
async function translateVideoDetails(videos: BiliVideo[]): Promise<void> {
  if (videos.length === 0) return;

  try {
    // Collect unique channel names to avoid translating duplicates
    const uniqueNames = new Map<string, string[]>(); // name -> list of indices
    videos.forEach((video, i) => {
      if (!uniqueNames.has(video.owner.name)) {
        uniqueNames.set(video.owner.name, []);
      }
      uniqueNames.get(video.owner.name)!.push(String(i));
    });

    // Translate titles and unique channel names in parallel
    const [translatedTitles, translatedNames] = await Promise.all([
      Promise.all(videos.map(v => translateToEnglish(v.title).catch(() => v.title))),
      Promise.all([...uniqueNames.keys()].map(name => translateToEnglish(name).catch(() => name))),
    ]);

    // Apply translated titles
    videos.forEach((video, i) => {
      video.titleEn = translatedTitles[i];
    });

    // Apply translated channel names
    const nameEntries = [...uniqueNames.keys()];
    nameEntries.forEach((originalName, i) => {
      const translatedName = translatedNames[i];
      uniqueNames.get(originalName)!.forEach(indexStr => {
        videos[Number(indexStr)].owner.nameEn = translatedName;
      });
    });
  } catch (error) {
    console.warn('[Bilibili] Translation failed:', error);
  }
}

function getHeaders(options?: { includeCookies?: boolean; includeBuvid?: boolean }): Record<string, string> {
  const includeCookies = options?.includeCookies ?? checkIsTauri();
  const includeBuvid = options?.includeBuvid ?? true;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com',
    'Origin': 'https://www.bilibili.com',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  };

  // Build cookie string - include buvid for anonymous API access
  const cookieParts: string[] = [];
  if (storedCookies && includeCookies) {
    cookieParts.push(storedCookies);
  }
  if (includeBuvid && includeCookies) {
    cookieParts.push(getBuvidCookies());
  }
  if (cookieParts.length > 0) {
    headers['Cookie'] = cookieParts.join('; ');
  }

  return headers;
}

function extractWbiKey(url: unknown): string {
  if (typeof url !== 'string') return '';
  const last = url.split('/').pop() || '';
  return last.split('.')[0];
}

function getMixinKey(origin: string): string {
  return WBI_MIXIN_KEY_MAP.map(index => origin[index] || '').join('').slice(0, 32);
}

function encodeWbiComponent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function md5(input: string): string {
  const data = new TextEncoder().encode(input);
  const length = data.length;
  const words: number[] = [];

  for (let i = 0; i < length; i += 4) {
    words[i >> 2] = (data[i] || 0)
      | ((data[i + 1] || 0) << 8)
      | ((data[i + 2] || 0) << 16)
      | ((data[i + 3] || 0) << 24);
  }

  const bitLen = length * 8;
  words[bitLen >> 5] |= 0x80 << (bitLen % 32);
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  const ff = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const gg = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const hh = (x: number, y: number, z: number) => x ^ y ^ z;
  const ii = (x: number, y: number, z: number) => y ^ (x | ~z);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const toHex = (num: number) => {
    const hex = (num >>> 0).toString(16).padStart(8, '0');
    return hex.slice(6, 8) + hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  };

  const round = (func: (x: number, y: number, z: number) => number, a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) => {
    const res = (a0 + func(b0, c0, d0) + x + t) | 0;
    return (b0 + rotl(res, s)) | 0;
  };

  for (let i = 0; i < words.length; i += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = round(ff, a, b, c, d, words[i + 0], 7, -680876936);
    d = round(ff, d, a, b, c, words[i + 1], 12, -389564586);
    c = round(ff, c, d, a, b, words[i + 2], 17, 606105819);
    b = round(ff, b, c, d, a, words[i + 3], 22, -1044525330);
    a = round(ff, a, b, c, d, words[i + 4], 7, -176418897);
    d = round(ff, d, a, b, c, words[i + 5], 12, 1200080426);
    c = round(ff, c, d, a, b, words[i + 6], 17, -1473231341);
    b = round(ff, b, c, d, a, words[i + 7], 22, -45705983);
    a = round(ff, a, b, c, d, words[i + 8], 7, 1770035416);
    d = round(ff, d, a, b, c, words[i + 9], 12, -1958414417);
    c = round(ff, c, d, a, b, words[i + 10], 17, -42063);
    b = round(ff, b, c, d, a, words[i + 11], 22, -1990404162);
    a = round(ff, a, b, c, d, words[i + 12], 7, 1804603682);
    d = round(ff, d, a, b, c, words[i + 13], 12, -40341101);
    c = round(ff, c, d, a, b, words[i + 14], 17, -1502002290);
    b = round(ff, b, c, d, a, words[i + 15], 22, 1236535329);

    a = round(gg, a, b, c, d, words[i + 1], 5, -165796510);
    d = round(gg, d, a, b, c, words[i + 6], 9, -1069501632);
    c = round(gg, c, d, a, b, words[i + 11], 14, 643717713);
    b = round(gg, b, c, d, a, words[i + 0], 20, -373897302);
    a = round(gg, a, b, c, d, words[i + 5], 5, -701558691);
    d = round(gg, d, a, b, c, words[i + 10], 9, 38016083);
    c = round(gg, c, d, a, b, words[i + 15], 14, -660478335);
    b = round(gg, b, c, d, a, words[i + 4], 20, -405537848);
    a = round(gg, a, b, c, d, words[i + 9], 5, 568446438);
    d = round(gg, d, a, b, c, words[i + 14], 9, -1019803690);
    c = round(gg, c, d, a, b, words[i + 3], 14, -187363961);
    b = round(gg, b, c, d, a, words[i + 8], 20, 1163531501);
    a = round(gg, a, b, c, d, words[i + 13], 5, -1444681467);
    d = round(gg, d, a, b, c, words[i + 2], 9, -51403784);
    c = round(gg, c, d, a, b, words[i + 7], 14, 1735328473);
    b = round(gg, b, c, d, a, words[i + 12], 20, -1926607734);

    a = round(hh, a, b, c, d, words[i + 5], 4, -378558);
    d = round(hh, d, a, b, c, words[i + 8], 11, -2022574463);
    c = round(hh, c, d, a, b, words[i + 11], 16, 1839030562);
    b = round(hh, b, c, d, a, words[i + 14], 23, -35309556);
    a = round(hh, a, b, c, d, words[i + 1], 4, -1530992060);
    d = round(hh, d, a, b, c, words[i + 4], 11, 1272893353);
    c = round(hh, c, d, a, b, words[i + 7], 16, -155497632);
    b = round(hh, b, c, d, a, words[i + 10], 23, -1094730640);
    a = round(hh, a, b, c, d, words[i + 13], 4, 681279174);
    d = round(hh, d, a, b, c, words[i + 0], 11, -358537222);
    c = round(hh, c, d, a, b, words[i + 3], 16, -722521979);
    b = round(hh, b, c, d, a, words[i + 6], 23, 76029189);
    a = round(hh, a, b, c, d, words[i + 9], 4, -640364487);
    d = round(hh, d, a, b, c, words[i + 12], 11, -421815835);
    c = round(hh, c, d, a, b, words[i + 15], 16, 530742520);
    b = round(hh, b, c, d, a, words[i + 2], 23, -995338651);

    a = round(ii, a, b, c, d, words[i + 0], 6, -198630844);
    d = round(ii, d, a, b, c, words[i + 7], 10, 1126891415);
    c = round(ii, c, d, a, b, words[i + 14], 15, -1416354905);
    b = round(ii, b, c, d, a, words[i + 5], 21, -57434055);
    a = round(ii, a, b, c, d, words[i + 12], 6, 1700485571);
    d = round(ii, d, a, b, c, words[i + 3], 10, -1894986606);
    c = round(ii, c, d, a, b, words[i + 10], 15, -1051523);
    b = round(ii, b, c, d, a, words[i + 1], 21, -2054922799);
    a = round(ii, a, b, c, d, words[i + 8], 6, 1873313359);
    d = round(ii, d, a, b, c, words[i + 15], 10, -30611744);
    c = round(ii, c, d, a, b, words[i + 6], 15, -1560198380);
    b = round(ii, b, c, d, a, words[i + 13], 21, 1309151649);
    a = round(ii, a, b, c, d, words[i + 4], 6, -145523070);
    d = round(ii, d, a, b, c, words[i + 11], 10, -1120210379);
    c = round(ii, c, d, a, b, words[i + 2], 15, 718787259);
    b = round(ii, b, c, d, a, words[i + 9], 21, -343485551);

    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }

  return `${toHex(a)}${toHex(b)}${toHex(c)}${toHex(d)}`;
}

let cachedWbiKeys: WbiKeys | null = null;

async function getWbiKeys(): Promise<WbiKeys | null> {
  if (cachedWbiKeys && Date.now() - cachedWbiKeys.fetchedAt < WBI_CACHE_TTL) {
    return cachedWbiKeys;
  }

  try {
    const response = await apiFetch(`${API_BASE}/x/web-interface/nav`, { headers: getHeaders() });
    const data = await response.json();
    const wbi = data.data?.wbi_img;
    const imgKey = extractWbiKey(wbi?.img_url || wbi?.img);
    const subKey = extractWbiKey(wbi?.sub_url || wbi?.sub);

    if (!imgKey || !subKey) {
      return null;
    }

    const mixinKey = getMixinKey(`${imgKey}${subKey}`);
    cachedWbiKeys = { imgKey, subKey, mixinKey, fetchedAt: Date.now() };
    return cachedWbiKeys;
  } catch (error) {
    console.error('Failed to get WBI keys:', error);
    return null;
  }
}

async function buildWbiUrl(path: string, params: Record<string, string | number | undefined>): Promise<string | null> {
  const wbiKeys = await getWbiKeys();
  if (!wbiKeys) return null;

  const wts = Math.floor(Date.now() / 1000);
  const entries = Object.entries({ ...params, wts })
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const query = entries
    .map(([key, value]) => `${encodeWbiComponent(key)}=${encodeWbiComponent(value)}`)
    .join('&');
  const wRid = md5(`${query}${wbiKeys.mixinKey}`);
  return `${API_BASE}${path}?${query}&w_rid=${wRid}`;
}

// Debug helper - exposes last error to window for visibility
declare global {
  interface Window {
    biliDebug?: { lastError?: string; lastResponse?: unknown };
  }
}

// Always expose debug info (needed for troubleshooting in production)
if (typeof window !== 'undefined') {
  window.biliDebug = {};

  // Test function to verify HTTP plugin works
  (window as unknown as Record<string, unknown>).testFetch = async () => {
    const results: Record<string, unknown> = {
      isTauri: checkIsTauri(),
      hasTauriInternals: !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
    };

    try {
      console.log('[Test] Starting test fetch...');
      console.log('[Test] isTauri:', results.isTauri);

      if (checkIsTauri()) {
        // Try Tauri fetch with full browser headers
        try {
          console.log('[Test] Attempting Tauri fetch...');
          const headers = getHeaders({ includeCookies: true, includeBuvid: true });
          console.log('[Test] Headers:', JSON.stringify(headers));
          const response = await tauriFetch('https://api.bilibili.com/x/web-interface/popular?ps=1&pn=1', {
            method: 'GET',
            headers,
          });
          console.log('[Test] Tauri fetch status:', response.status);
          const text = await response.text();
          console.log('[Test] Response length:', text.length);
          console.log('[Test] Response preview:', text.substring(0, 300));
          return { ...results, method: 'tauri', success: true, status: response.status, length: text.length, preview: text.substring(0, 300), headers };
        } catch (tauriErr) {
          console.error('[Test] Tauri fetch failed:', tauriErr);
          return { ...results, method: 'tauri', success: false, error: tauriErr instanceof Error ? tauriErr.message : String(tauriErr) };
        }
      }

      // Try proxy fetch (for dev/browser)
      console.log('[Test] Attempting proxy fetch...');
      const response = await window.fetch('/api/bili/x/web-interface/popular?ps=1&pn=1');
      console.log('[Test] Proxy fetch status:', response.status);
      const text = await response.text();
      console.log('[Test] Response length:', text.length);
      console.log('[Test] Response preview:', text.substring(0, 300));
      return { ...results, method: 'proxy', success: true, status: response.status, length: text.length, preview: text.substring(0, 300) };
    } catch (error) {
      console.error('[Test] Error:', error);
      return { ...results, success: false, error: String(error) };
    }
  };
}

export async function getTrending(pageNum: number = 1): Promise<BiliTrendingResult> {
  try {
    console.log('[Bilibili] START getTrending, page:', pageNum);
    if (import.meta.env.DEV && window.biliDebug) window.biliDebug.lastError = undefined;

    const pageSize = 20;
    const url = `${API_BASE}/x/web-interface/popular?ps=${pageSize}&pn=${pageNum}`;
    console.log('[Bilibili] URL:', url);
    console.log('[Bilibili] Headers:', JSON.stringify(getHeaders()));

    console.log('[Bilibili] Calling apiFetch...');
    const response = await apiFetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    console.log('[Bilibili] Fetch completed, status:', response.status);
    if (import.meta.env.DEV && window.biliDebug) window.biliDebug.lastResponse = { status: response.status };

    if (!response.ok) {
      const errorMsg = `HTTP error: ${response.status} ${response.statusText}`;
      console.error('[Bilibili]', errorMsg);
      if (import.meta.env.DEV && window.biliDebug) window.biliDebug.lastError = errorMsg;
      return { videos: [] };
    }

    console.log('[Bilibili] Getting response text...');
    const text = await response.text();
    console.log('[Bilibili] Response length:', text.length, 'preview:', text.substring(0, 200));

    if (text.length === 0) {
      console.error('[Bilibili] Empty response received');
      if (import.meta.env.DEV && window.biliDebug) window.biliDebug.lastError = 'Empty response from API';
      return { videos: [], error: 'Empty response from API' };
    }

    console.log('[Bilibili] Parsing JSON...');
    const data = JSON.parse(text);
    console.log('[Bilibili] API code:', data.code, 'message:', data.message);
    console.log('[Bilibili] Data keys:', Object.keys(data));
    if (data.data) {
      console.log('[Bilibili] data.data keys:', Object.keys(data.data));
      console.log('[Bilibili] data.data.list length:', data.data.list?.length);
    }
    if (import.meta.env.DEV && window.biliDebug) {
      window.biliDebug.lastResponse = {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasList: !!data.data?.list,
        listLength: data.data?.list?.length,
        rawPreview: text.substring(0, 500),
      };
    }

    if (data.code !== 0) {
      const errorMsg = `Bilibili API error: ${data.message}`;
      console.error('[Bilibili]', errorMsg);
      if (import.meta.env.DEV && window.biliDebug) window.biliDebug.lastError = errorMsg;
      return { videos: [] };
    }

    console.log('[Bilibili] Got', data.data?.list?.length || 0, 'videos');

    const videos: BiliVideo[] = data.data.list.map((item: Record<string, unknown>) => ({
      bvid: item.bvid as string,
      aid: Number(item.aid) || 0,
      title: item.title as string,
      desc: item.desc as string,
      pic: normalizeImageUrl(item.pic),
      duration: item.duration as number,
      view: (item.stat as Record<string, number>).view,
      danmaku: (item.stat as Record<string, number>).danmaku,
      reply: (item.stat as Record<string, number>).reply,
      favorite: (item.stat as Record<string, number>).favorite,
      coin: (item.stat as Record<string, number>).coin,
      share: (item.stat as Record<string, number>).share,
      like: (item.stat as Record<string, number>).like,
      owner: item.owner as { mid: number; name: string; face: string },
      pubdate: item.pubdate as number,
      cid: item.cid as number,
    }));

    // Translate titles and channel names
    await translateVideoDetails(videos);

    return {
      videos,
      page: pageNum,
      pageSize,
      hasMore: videos.length === pageSize,
    };
  } catch (error) {
    const errorMsg = `Error fetching trending: ${error instanceof Error ? error.message : String(error)}`;
    console.error('[Bilibili]', errorMsg, error);
    if (window.biliDebug) window.biliDebug.lastError = errorMsg;
    return { videos: [], error: errorMsg };
  }
}

export interface SearchFilters {
  order?: 'totalrank' | 'click' | 'pubdate' | 'dm' | 'stow'; // relevance, views, date, danmaku, favorites
  duration?: 0 | 1 | 2 | 3 | 4; // 0=all, 1=<10min, 2=10-30, 3=30-60, 4=>60
}

function hasCjkCharacters(value: string): boolean {
  return /[\u4E00-\u9FFF]/.test(value);
}

export async function searchVideos(
  query: string,
  page: number = 1,
  translateQuery: boolean = true,
  filters?: SearchFilters
): Promise<BiliSearchResult> {
  try {
    // Translate English query to Chinese
    const shouldTranslate = translateQuery && !hasCjkCharacters(query);
    const searchQuery = shouldTranslate ? await translateToChinese(query) : query;

    // Build URL with optional filters
    let url = `${API_BASE}/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(searchQuery)}&page=${page}&page_size=20`;

    if (filters?.order) {
      url += `&order=${filters.order}`;
    }
    if (filters?.duration !== undefined && filters.duration !== 0) {
      url += `&duration=${filters.duration}`;
    }

    const response = await apiFetch(url, { headers: getHeaders() });

    const data = await response.json();

    if (data.code !== 0) {
      console.error('Bilibili search error:', data.message);
      return { videos: [], total: 0, page, pageSize: 20 };
    }

    const results = data.data.result || [];

    const videos: BiliVideo[] = results.map((item: Record<string, unknown>) => ({
      bvid: item.bvid as string,
      aid: Number(item.aid) || 0,
      title: (item.title as string).replace(/<[^>]*>/g, ''), // Remove HTML tags from search results
      desc: item.description as string || '',
      pic: normalizeImageUrl(item.pic),
      duration: parseDuration(item.duration as string),
      view: parseCount(item.play),
      danmaku: parseCount(item.danmaku),
      reply: 0,
      favorite: parseCount(item.favorites),
      coin: 0,
      share: 0,
      like: parseCount(item.like),
      owner: {
        mid: item.mid as number,
        name: item.author as string,
        face: item.upic as string || '',
      },
      pubdate: item.pubdate as number,
    }));

    // Translate titles and channel names
    await translateVideoDetails(videos);

    return {
      videos,
      total: data.data.numResults || 0,
      page,
      pageSize: 20,
    };
  } catch (error) {
    console.error('Error searching:', error);
    return { videos: [], total: 0, page, pageSize: 20 };
  }
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed.replace(/^http:/, 'https:');
}

function extractCategoryList(data: Record<string, unknown>): { list: Record<string, unknown>[]; total?: number } {
  const payload = data.data as Record<string, unknown> | unknown[] | undefined;
  if (Array.isArray(payload)) {
    return { list: payload as Record<string, unknown>[] };
  }

  const listCandidate = payload as Record<string, unknown> | undefined;
  const list = Array.isArray(listCandidate?.list)
    ? listCandidate?.list as Record<string, unknown>[]
    : Array.isArray(listCandidate?.archives)
      ? listCandidate?.archives as Record<string, unknown>[]
      : Array.isArray(listCandidate?.result)
        ? listCandidate?.result as Record<string, unknown>[]
        : [];

  const pageInfo = listCandidate?.page as Record<string, unknown> | undefined;
  const total = typeof pageInfo?.count === 'number'
    ? pageInfo.count
    : typeof pageInfo?.total === 'number'
      ? pageInfo.total
      : typeof listCandidate?.numResults === 'number'
        ? listCandidate.numResults as number
        : undefined;

  return { list, total };
}

function mapCategoryItem(item: Record<string, unknown>): BiliVideo {
  const stat = item.stat as Record<string, unknown> | undefined;
  const owner = item.owner as Record<string, unknown> | undefined;
  const rawTitle = typeof item.title === 'string' ? item.title : '';
  const durationValue = item.duration as string | number | undefined;
  const duration = typeof durationValue === 'string' || typeof durationValue === 'number'
    ? parseDuration(durationValue)
    : 0;

  return {
    bvid: (item.bvid as string) || '',
    aid: (item.aid as number) || 0,
    title: rawTitle.replace(/<[^>]*>/g, ''),
    desc: (item.desc as string) || (item.description as string) || '',
    pic: normalizeImageUrl(item.pic),
    duration,
    view: parseCount(stat?.view ?? item.play ?? item.view),
    danmaku: parseCount(stat?.danmaku ?? item.danmaku ?? item.video_review),
    reply: parseCount(stat?.reply ?? item.reply),
    favorite: parseCount(stat?.favorite ?? item.favorites),
    coin: parseCount(stat?.coin ?? item.coins),
    share: parseCount(stat?.share ?? item.share),
    like: parseCount(stat?.like ?? item.like),
    owner: {
      mid: (owner?.mid as number) || (item.mid as number) || 0,
      name: (owner?.name as string) || (item.author as string) || '',
      face: normalizeImageUrl(owner?.face ?? item.face ?? item.upic),
    },
    pubdate: (item.pubdate as number) || (item.create as number) || (item.ctime as number) || 0,
  };
}

export async function getVideosByCategory(
  tid: number,
  page: number = 1
): Promise<BiliTrendingResult> {
  try {
    const pageSize = 20;

    const fetchCategory = async (url: string) => {
      const response = await apiFetch(url, { headers: getHeaders() });
      const data = await response.json();
      if (data.code !== 0) {
        return null;
      }
      return extractCategoryList(data);
    };

    if (tid === 0) {
      const url = `${API_BASE}/x/web-interface/popular?ps=${pageSize}&pn=${page}`;
      const response = await apiFetch(url, { headers: getHeaders() });
      const data = await response.json();

      if (data.code !== 0) {
        console.error('Bilibili API error:', data.message);
        return { videos: [] };
      }

      const list = Array.isArray(data.data?.list) ? data.data.list : [];
      const videos: BiliVideo[] = list.map((item: Record<string, unknown>) => ({
        bvid: item.bvid as string,
        aid: Number(item.aid) || 0,
        title: item.title as string,
        desc: item.desc as string || item.description as string || '',
        pic: item.pic as string,
        duration: typeof item.duration === 'string' ? parseDuration(item.duration) : item.duration as number,
        view: item.stat ? parseCount((item.stat as Record<string, number>).view) : parseCount(item.play),
        danmaku: item.stat ? parseCount((item.stat as Record<string, number>).danmaku) : parseCount(item.video_review),
        reply: item.stat ? parseCount((item.stat as Record<string, number>).reply) : 0,
        favorite: item.stat ? parseCount((item.stat as Record<string, number>).favorite) : parseCount(item.favorites),
        coin: item.stat ? parseCount((item.stat as Record<string, number>).coin) : parseCount(item.coins),
        share: item.stat ? parseCount((item.stat as Record<string, number>).share) : 0,
        like: item.stat ? parseCount((item.stat as Record<string, number>).like) : 0,
        owner: item.owner || { mid: item.mid, name: item.author, face: '' },
        pubdate: item.pubdate as number || item.create as number || 0,
      }));

      // Translate titles and channel names
      await translateVideoDetails(videos);

      return {
        videos,
        page,
        pageSize,
        hasMore: videos.length === pageSize,
      };
    }

    const pagedEndpoints = [
      `${API_BASE}/x/web-interface/dynamic/region?rid=${tid}&pn=${page}&ps=${pageSize}`,
      `${API_BASE}/x/web-interface/newlist?rid=${tid}&pn=${page}&ps=${pageSize}`,
    ];

    let listData: { list: Record<string, unknown>[]; total?: number } | null = null;
    let usesPagedEndpoint = true;

    for (const endpoint of pagedEndpoints) {
      listData = await fetchCategory(endpoint);
      if (listData) {
        break;
      }
    }

    if (!listData) {
      if (page > 1) {
        return { videos: [], page, pageSize, hasMore: false };
      }
      usesPagedEndpoint = false;
      listData = await fetchCategory(`${API_BASE}/x/web-interface/ranking/region?rid=${tid}&day=7&original=0`)
        || { list: [] };
    }

    const list = listData.list;
    const total = listData.total;

    const videos: BiliVideo[] = list.map(mapCategoryItem);

    // Translate titles and channel names
    await translateVideoDetails(videos);

    const hasMore = usesPagedEndpoint
      ? typeof total === 'number' && total > 0
        ? page * pageSize < total
        : list.length === pageSize
      : false;

    return { videos, page, pageSize, total, hasMore };
  } catch (error) {
    console.error('Error fetching category:', error);
    return { videos: [] };
  }
}

export async function getCurrentUser(): Promise<BiliUser | null> {
  try {
    const response = await apiFetch(
      `${API_BASE}/x/web-interface/nav`,
      { headers: getHeaders() }
    );

    const data = await response.json();

    if (data.code !== 0 || !data.data.isLogin) {
      return null;
    }

    return {
      mid: data.data.mid,
      name: data.data.uname,
      face: data.data.face,
      sign: data.data.sign || '',
      level: data.data.level_info?.current_level || 0,
      isLogin: true,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function getVideoUrl(bvid: string): string {
  return `${WWW_BASE}/video/${bvid}`;
}

export function getChannelUrl(mid: number): string {
  return `${SPACE_BASE}/${mid}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatViewCount(count: number): string {
  if (count >= 100000000) {
    return `${(count / 100000000).toFixed(1)}B`;
  }
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}W`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function decodeAidFromBvid(bvid: string): number | null {
  if (!bvid || !bvid.startsWith('BV') || bvid.length < 12) return null;
  let r = 0n;
  for (let i = 0; i < BVID_POSITIONS.length; i += 1) {
    const index = BVID_TABLE.indexOf(bvid[BVID_POSITIONS[i]]);
    if (index < 0) return null;
    r += BigInt(index) * (58n ** BigInt(i));
  }
  const aid = (r - BVID_ADD) ^ BVID_XOR;
  if (aid <= 0n) return null;
  const asNumber = Number(aid);
  if (!Number.isSafeInteger(asNumber)) return null;
  return asNumber;
}

// Get aid from bvid
export async function getAidFromBvid(bvid: string): Promise<number | null> {
  const cached = aidCache.get(bvid);
  if (cached) {
    return cached;
  }
  const decoded = decodeAidFromBvid(bvid);
  try {
    console.log('[getAidFromBvid] Fetching aid for bvid:', bvid);
    const url = `${API_BASE}/x/web-interface/view?bvid=${bvid}`;
    const response = await apiFetch(url, { headers: getHeaders() });
    const data = await response.json();
    console.log('[getAidFromBvid] Response code:', data.code, 'aid:', data.data?.aid);
    if (data.code === 0 && data.data?.aid) {
      const aid = Number(data.data.aid);
      if (Number.isSafeInteger(aid) && aid > 0) {
        aidCache.set(bvid, aid);
        return aid;
      }
    }
    console.error('[getAidFromBvid] Failed to get aid:', data.message || 'No aid in response');
    if (decoded) {
      console.warn('[getAidFromBvid] Falling back to decoded aid:', decoded);
      aidCache.set(bvid, decoded);
      return decoded;
    }
    return null;
  } catch (err) {
    console.error('[getAidFromBvid] Error:', err);
    if (decoded) {
      console.warn('[getAidFromBvid] Falling back to decoded aid:', decoded);
      aidCache.set(bvid, decoded);
      return decoded;
    }
    return null;
  }
}

export async function getVideoComments(
  aid: number,
  cursor: number = 0,
  pageSize: number = 20,
  bvid?: string
): Promise<BiliCommentsResult> {
  // If aid is 0 or missing, try to get it from bvid
  let effectiveAid = Number(aid);
  if (!Number.isFinite(effectiveAid) || effectiveAid <= 0) {
    effectiveAid = 0;
  }
  if (bvid) {
    const fetchedAid = await getAidFromBvid(bvid);
    if (fetchedAid) {
      if (effectiveAid && effectiveAid !== fetchedAid) {
        console.log('[Comments] aid mismatch, using bvid-derived aid:', fetchedAid, 'was:', effectiveAid);
      }
      effectiveAid = fetchedAid;
      console.log('[Comments] Using aid from bvid:', effectiveAid);
    }
  }

  // Calculate page number (cursor is treated as page index: 0, 1, 2, ...)
  const pageCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
  const pageNum = pageCursor + 1;
  const isFirstPage = pageNum === 1;
  console.log('[Comments] Fetching page:', pageNum, 'cursor:', pageCursor, 'aid:', effectiveAid);

  if (!effectiveAid) {
    console.error('[Comments] No valid aid available, cannot fetch comments');
    return { comments: [], total: 0, page: 1, pageSize, hasMore: false };
  }

  try {
    const offset = pageCursor * pageSize;
    const paginationStr = JSON.stringify({ offset: offset === 0 ? '' : String(offset) });
    const wbiUrl = await buildWbiUrl('/x/v2/reply/wbi/main', {
      oid: effectiveAid,
      type: 1,
      mode: 3,
      pagination_str: paginationStr,
      ps: pageSize,
      plat: 1,
      web_location: 1315875,
    });
    const mainUrl = `${API_BASE}/x/v2/reply/main?oid=${effectiveAid}&type=1&mode=3&next=${pageCursor}&ps=${pageSize}&plat=1&web_location=1315875`;
    const legacyUrl = `${API_BASE}/x/v2/reply?oid=${effectiveAid}&type=1&pn=${pageNum}&ps=${pageSize}&sort=0`;

    const urlsToTry = [
      ...(wbiUrl ? [{ url: wbiUrl, label: 'wbi' as const }] : []),
      { url: mainUrl, label: 'main' as const },
      { url: legacyUrl, label: 'legacy' as const },
    ];

    let data: Record<string, unknown> | null = null;
    let lastError: string | undefined;

    for (const { url, label } of urlsToTry) {
      console.log('[Comments] Fetching', label, 'endpoint:', url.replace(API_BASE, ''));
      const response = await apiFetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.error('[Comments] HTTP error:', response.status, response.statusText);
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const text = await response.text();
      if (text.startsWith('<!') || text.startsWith('<html')) {
        console.error('[Comments] Got HTML instead of JSON (likely 403 block):', text.substring(0, 200));
        lastError = 'API returned HTML (blocked)';
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch (parseErr) {
        console.error('[Comments] JSON parse error:', parseErr, 'Response:', text.substring(0, 200));
        lastError = 'Invalid JSON response';
        continue;
      }

      console.log('[Comments] Response code:', parsed?.code, 'message:', parsed?.message);

      if (parsed?.code !== 0) {
        console.warn('[Comments] API error:', parsed?.message);
        lastError = String(parsed?.message || 'API error');
        continue;
      }

      data = parsed;
      break;
    }

    if (!data) {
      return { comments: [], total: 0, page: pageNum, pageSize, hasMore: false, error: lastError || 'Failed to load comments' };
    }

    const dataPayload = data.data as Record<string, unknown> | undefined;
    const replyContainer = dataPayload?.reply as Record<string, unknown> | undefined;
    const repliesArr = Array.isArray(dataPayload?.replies)
      ? dataPayload?.replies as unknown[]
      : Array.isArray(replyContainer?.replies)
        ? replyContainer?.replies as unknown[]
        : [];
    const topRepliesArr = isFirstPage && Array.isArray(dataPayload?.top_replies)
      ? dataPayload?.top_replies as unknown[]
      : isFirstPage && Array.isArray(dataPayload?.top)
        ? dataPayload?.top as unknown[]
        : [];
    const pageInfo = (dataPayload?.page || replyContainer?.page) as Record<string, unknown> | undefined;
    const cursorInfo = dataPayload?.cursor as Record<string, unknown> | undefined;
    const paginationInfo = cursorInfo?.pagination_reply as Record<string, unknown> | undefined;

    // Get total count
    const apiTotal = typeof pageInfo?.count === 'number' ? pageInfo.count :
                     typeof pageInfo?.acount === 'number' ? pageInfo.acount :
                     typeof cursorInfo?.all_count === 'number' ? cursorInfo?.all_count :
                     typeof cursorInfo?.count === 'number' ? cursorInfo?.count : 0;

    console.log('[Comments] replies:', Array.isArray(repliesArr) ? repliesArr.length : 'null',
                'top_replies:', Array.isArray(topRepliesArr) ? topRepliesArr.length : 'null',
                'total:', apiTotal);

    // Get replies arrays
    const regularReplies = Array.isArray(repliesArr) ? repliesArr as Record<string, unknown>[] : [];
    // Include top_replies only on the first page
    const topReplies = Array.isArray(topRepliesArr) ? topRepliesArr as Record<string, unknown>[] : [];
    const replies = [...topReplies, ...regularReplies];

    // Check if login is required for more comments
    // If API says there are more comments but we got empty replies, login is needed
    const totalPages = apiTotal > 0 ? Math.ceil(apiTotal / pageSize) : 0;
    const cursorIsEnd = cursorInfo?.is_end;
    const cursorHasMore = typeof cursorIsEnd === 'boolean' ? !cursorIsEnd : undefined;
    const shouldHaveMore = typeof cursorHasMore === 'boolean' ? cursorHasMore : pageNum < totalPages;
    const requiresLogin = shouldHaveMore && regularReplies.length === 0 && !isFirstPage;

    if (requiresLogin) {
      console.log('[Comments] More comments available but requires login');
    }

    const comments: BiliComment[] = replies.map((item: Record<string, unknown>) => parseComment(item));

    // Translate comments
    try {
      const translatedMessages = await Promise.all(
        comments.map(c => translateToEnglish(c.content.message).catch(() => c.content.message))
      );
      comments.forEach((comment, i) => {
        comment.content.messageEn = translatedMessages[i];
      });
    } catch {
      console.warn('[Comments] Translation failed');
    }

    // Calculate pagination
    const hasMore = typeof cursorHasMore === 'boolean'
      ? cursorHasMore
      : regularReplies.length > 0 && pageNum < totalPages;
    let nextCursor: number | undefined;
    if (hasMore) {
      const nextOffsetRaw = paginationInfo?.next_offset;
      if (typeof nextOffsetRaw === 'string') {
        const parsed = Number.parseInt(nextOffsetRaw, 10);
        if (Number.isFinite(parsed)) {
          nextCursor = Math.floor(parsed / pageSize);
        }
      }
      if (nextCursor === undefined) {
        const cursorNext = cursorInfo?.next;
        if (typeof cursorNext === 'number') {
          nextCursor = cursorNext;
        }
      }
      if (nextCursor === undefined) {
        nextCursor = pageCursor + 1;
      }
    }
    console.log('[Comments] Page:', pageNum, '/', totalPages, 'hasMore:', hasMore, 'requiresLogin:', requiresLogin);

    return {
      comments,
      total: apiTotal,
      page: pageNum,
      pageSize,
      hasMore,
      nextCursor,
      requiresLogin,
    };
  } catch (error) {
    console.error('[Comments] Error fetching:', error);
    return { comments: [], total: 0, page: 1, pageSize, hasMore: false };
  }
}

function parseComment(item: Record<string, unknown>): BiliComment {
  const content = item.content as Record<string, string> | undefined;
  const member = item.member as Record<string, unknown> | undefined;
  const levelInfo = member?.level_info as Record<string, number> | undefined;

  return {
    rpid: (item.rpid as number) || 0,
    oid: (item.oid as number) || 0,
    mid: (item.mid as number) || 0,
    content: {
      message: content?.message || '',
    },
    ctime: (item.ctime as number) || 0,
    like: (item.like as number) || 0,
    rcount: (item.rcount as number) || 0,
    member: {
      mid: (member?.mid as number) || 0,
      uname: (member?.uname as string) || '',
      avatar: (member?.avatar as string) || '',
      level_info: {
        current_level: levelInfo?.current_level || 0,
      },
    },
    replies: (Array.isArray(item.replies) ? item.replies : []).map((r: unknown) => {
      const reply = r as Record<string, unknown>;
      const replyContent = reply.content as Record<string, string> | undefined;
      const replyMember = reply.member as Record<string, unknown> | undefined;
      const replyLevelInfo = replyMember?.level_info as Record<string, number> | undefined;
      return {
        rpid: (reply.rpid as number) || 0,
        oid: (reply.oid as number) || 0,
        mid: (reply.mid as number) || 0,
        content: {
          message: replyContent?.message || '',
        },
        ctime: (reply.ctime as number) || 0,
        like: (reply.like as number) || 0,
        rcount: (reply.rcount as number) || 0,
        member: {
          mid: (replyMember?.mid as number) || 0,
          uname: (replyMember?.uname as string) || '',
          avatar: (replyMember?.avatar as string) || '',
          level_info: {
            current_level: replyLevelInfo?.current_level || 0,
          },
        },
      };
    }),
  };
}

function parseCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const last = trimmed.slice(-1);
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) return 0;
  if (last === '万') return Math.round(num * 10000);
  if (last === '亿') return Math.round(num * 100000000);
  if (last === 'K' || last === 'k') return Math.round(num * 1000);
  if (last === 'M' || last === 'm') return Math.round(num * 1000000);
  return Math.round(num);
}

export async function getChannelInfo(mid: number): Promise<BiliChannel | null> {
  try {
    // Try multiple endpoints - prefer WBI signed API when possible
    const endpoints: string[] = [];
    const wbiUrl = await buildWbiUrl('/x/space/wbi/acc/info', { mid });
    if (wbiUrl) {
      endpoints.push(wbiUrl);
    }
    endpoints.push(
      `${API_BASE}/x/space/acc/info?mid=${mid}`,
      `${API_BASE}/x/web-interface/card?mid=${mid}`,
    );

    let infoData: { code: number; data?: Record<string, unknown>; message?: string } | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await apiFetch(endpoint, { headers: getHeaders() });
        const data = await response.json();
        if (data.code === 0 && data.data) {
          infoData = data;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!infoData?.data) {
      console.error('Bilibili channel info: all endpoints failed');
      return null;
    }

    // Handle different response formats
    const info = infoData.data.card || infoData.data;
    const cardData = info as Record<string, unknown>;

    // Get follower stats separately
    let follower = 0;
    let following = 0;
    try {
      const statResponse = await apiFetch(
        `${API_BASE}/x/relation/stat?vmid=${mid}`,
        { headers: getHeaders() }
      );
      const statData = await statResponse.json();
      if (statData.code === 0 && statData.data) {
        follower = statData.data.follower || 0;
        following = statData.data.following || 0;
      }
    } catch {
      // Use inline stats if available
      follower = (cardData.fans as number) || (cardData.follower as number) || 0;
      following = (cardData.attention as number) || (cardData.following as number) || 0;
    }

    return {
      mid: (cardData.mid as number) || mid,
      name: (cardData.name as string) || '',
      face: (cardData.face as string) || '',
      sign: (cardData.sign as string) || '',
      level: (cardData.level as number) || (cardData.level_info as Record<string, number>)?.current_level || 0,
      follower,
      following,
      videoCount: 0,
    };
  } catch (error) {
    console.error('Error fetching channel info:', error);
    return null;
  }
}

function mapChannelVideo(
  item: Record<string, unknown>,
  channelInfo: BiliChannel | null,
  mid: number
): BiliVideo {
  const stat = item.stat as Record<string, unknown> | undefined;
  const title = (item.title as string) || '';
  const durationValue = item.length ?? item.duration;
  const duration = typeof durationValue === 'string' || typeof durationValue === 'number'
    ? parseDuration(durationValue)
    : 0;

  return {
    bvid: (item.bvid as string) || '',
    aid: (item.aid as number) || 0,
    title: title.replace(/<[^>]*>/g, ''),
    desc: (item.description as string) || (item.desc as string) || '',
    pic: normalizeImageUrl(item.pic),
    duration,
    view: parseCount(stat?.view ?? item.play ?? item.view),
    danmaku: parseCount(stat?.danmaku ?? item.video_review ?? item.danmaku),
    reply: parseCount(stat?.reply ?? item.reply),
    favorite: parseCount(stat?.favorite ?? item.favorites),
    coin: parseCount(stat?.coin ?? item.coins),
    share: parseCount(stat?.share ?? item.share),
    like: parseCount(stat?.like ?? item.like),
    owner: {
      mid: mid || (item.mid as number) || 0,
      name: (item.author as string) || channelInfo?.name || '',
      face: channelInfo?.face || '',
    },
    pubdate: (item.created as number) || (item.pubdate as number) || (item.ctime as number) || 0,
  };
}

export async function getChannelVideos(
  mid: number,
  page: number = 1,
  pageSize: number = 20
): Promise<BiliChannelVideosResult> {
  console.log('[Channel] Fetching videos for mid:', mid, 'page:', page);
  const channelInfo = await getChannelInfo(mid);
  console.log('[Channel] Channel info:', channelInfo?.name || 'unknown');

  const wbiUrl = await buildWbiUrl('/x/space/wbi/arc/search', {
    mid,
    pn: page,
    ps: pageSize,
    order: 'pubdate',
  });
  console.log('[Channel] WBI URL:', wbiUrl ? 'built successfully' : 'failed to build');

  if (wbiUrl) {
    try {
      const response = await apiFetch(wbiUrl, { headers: getHeaders() });
      const data = await response.json();
      console.log('[Channel] WBI response code:', data.code, 'message:', data.message);
      if (data.code === 0 && data.data) {
        const list = data.data?.list?.vlist
          || data.data?.list?.archives
          || data.data?.list?.result
          || [];
        console.log('[Channel] Got', list.length, 'videos from WBI API');
        const pageInfo = data.data?.page;
        const total = (pageInfo?.count as number) || (pageInfo?.total as number) || list.length;
        const videos: BiliVideo[] = list.map((item: Record<string, unknown>) =>
          mapChannelVideo(item, channelInfo, mid)
        );
        await translateVideoDetails(videos);
        return { videos, total, page, pageSize };
      }
    } catch (error) {
      console.warn('[Channel] WBI channel videos failed, falling back:', error);
    }
  }

  console.log('[Channel] Falling back to search-based method');
  return await getChannelVideosViaSearch(mid, page, pageSize);
}

// Fallback: try multiple methods to get channel videos
async function getChannelVideosViaSearch(
  mid: number,
  page: number,
  pageSize: number
): Promise<BiliChannelVideosResult> {
  console.log('[Channel] Trying fallback methods for mid:', mid);

  // First get channel info
  const channelInfo = await getChannelInfo(mid);

  // Try unsigned space API first
  try {
    const url = `${API_BASE}/x/space/arc/search?mid=${mid}&pn=${page}&ps=${pageSize}&order=pubdate`;
    console.log('[Channel] Trying unsigned space API');
    const response = await apiFetch(url, { headers: getHeaders() });
    const data = await response.json();

    if (data.code === 0 && data.data?.list?.vlist?.length > 0) {
      console.log('[Channel] Unsigned API worked, got', data.data.list.vlist.length, 'videos');
      const list = data.data.list.vlist;
      const videos: BiliVideo[] = list.map((item: Record<string, unknown>) =>
        mapChannelVideo(item, channelInfo, mid)
      );
      await translateVideoDetails(videos);
      return {
        videos,
        total: data.data.page?.count || videos.length,
        page,
        pageSize,
      };
    }
    console.log('[Channel] Unsigned API failed:', data.code, data.message);
  } catch (err) {
    console.log('[Channel] Unsigned API error:', err);
  }

  // Try search fallback
  try {
    if (!channelInfo?.name) {
      console.log('[Channel] No channel info found for mid:', mid);
      return { videos: [], total: 0, page, pageSize };
    }

    console.log('[Channel] Searching videos for:', channelInfo.name);

    // Search by uploader mid directly
    const url = `${API_BASE}/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(channelInfo.name)}&page=${page}&page_size=${pageSize}&order=pubdate`;
    const response = await apiFetch(url, { headers: getHeaders() });
    const data = await response.json();

    if (data.code !== 0) {
      console.log('[Channel] Search failed:', data.message);
      return { videos: [], total: 0, page, pageSize };
    }

    const allResults = data.data?.result || [];
    console.log('[Channel] Search returned', allResults.length, 'results');

    // Filter by mid - check both 'mid' and 'author_mid' fields
    let results = allResults.filter((item: Record<string, unknown>) => {
      const itemMid = Number(item.mid) || Number(item.author_mid);
      return itemMid === mid;
    });

    if (results.length === 0 && allResults.length > 0) {
      console.log('[Channel] Mid filter removed all results, using first 20');
      results = allResults.slice(0, 20);
    }

    console.log('[Channel] Using', results.length, 'videos');

    const videos: BiliVideo[] = results.map((item: Record<string, unknown>) => ({
      bvid: item.bvid as string,
      aid: Number(item.aid) || 0,
      title: (item.title as string).replace(/<[^>]*>/g, ''),
      desc: (item.description as string) || '',
      pic: normalizeImageUrl(item.pic),
      duration: parseDuration(item.duration as string),
      view: parseCount(item.play),
      danmaku: parseCount(item.danmaku),
      reply: 0,
      favorite: parseCount(item.favorites),
      coin: 0,
      share: 0,
      like: parseCount(item.like),
      owner: {
        mid: Number(item.mid) || mid,
        name: (item.author as string) || channelInfo.name,
        face: normalizeImageUrl(channelInfo.face),
      },
      pubdate: (item.pubdate as number) || 0,
    }));

    await translateVideoDetails(videos);

    return {
      videos,
      total: data.data?.numResults || results.length,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('Error fetching channel videos via search:', error);
    return { videos: [], total: 0, page, pageSize };
  }
}

// Video stream quality options
export interface VideoQuality {
  quality: number;
  description: string;
}

export interface VideoStreamInfo {
  videoUrl: string;
  audioUrl?: string;
  format: 'dash' | 'progressive';
  videoMimeType?: string;
  audioMimeType?: string;
  quality: number;
  qualityDescription: string;
  availableQualities: VideoQuality[];
  size?: number;
  duration?: number;
}

export async function getVideoStreamInfo(
  bvid: string,
  quality: number = 80,
  options: { preferProgressive?: boolean } = {}
): Promise<VideoStreamInfo | null> {
  try {
    // First get the CID (content ID) for the video
    const infoUrl = `${API_BASE}/x/web-interface/view?bvid=${bvid}`;
    const infoResponse = await apiFetch(infoUrl, { headers: getHeaders() });
    const infoData = await infoResponse.json();

    if (infoData.code !== 0 || !infoData.data?.cid) {
      console.error('Failed to get video info:', infoData.message);
      return null;
    }

    const cid = infoData.data.cid;
    const preferProgressive = options.preferProgressive === true;

    const fetchPlayData = async (fnval: number) => {
      const playUrl = `${API_BASE}/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${quality}&fnval=${fnval}&fourk=1`;
      const playResponse = await apiFetch(playUrl, { headers: getHeaders() });
      const playData = await playResponse.json();

      if (playData.code !== 0) {
        console.error('Failed to get play URL:', playData.message);
        return null;
      }

      return playData.data;
    };

    let data = await fetchPlayData(preferProgressive ? 0 : 16);
    if (!data) {
      return null;
    }

    let fallbackData: Record<string, unknown> | null = null;
    const hasDurl = Array.isArray((data as Record<string, unknown>).durl)
      && ((data as Record<string, unknown>).durl as unknown[]).length > 0;

    if (preferProgressive && !hasDurl) {
      fallbackData = await fetchPlayData(16);
      if (fallbackData) {
        data = fallbackData;
      }
    }

    if (!preferProgressive && !data.dash && !hasDurl) {
      fallbackData = await fetchPlayData(0);
      if (fallbackData) {
        data = fallbackData;
      }
    }

    const buildQualities = (source: Record<string, unknown> | null) => {
      const acceptQuality = source?.accept_quality as number[] | undefined;
      const acceptDescription = source?.accept_description as string[] | undefined;
      if (!Array.isArray(acceptQuality)) return [];
      return acceptQuality.map((q, i) => ({
        quality: q,
        description: acceptDescription?.[i] || `${q}p`,
      }));
    };

    let availableQualities = buildQualities(data as Record<string, unknown>);
    if (availableQualities.length === 0) {
      availableQualities = buildQualities(fallbackData);
    }

    const durlList = data.durl as { url: string; size?: number }[] | undefined;
    if (preferProgressive && Array.isArray(durlList) && durlList.length > 0) {
      const qualityValue = (data.quality as number) || quality;
      return {
        videoUrl: durlList[0].url,
        format: 'progressive',
        quality: qualityValue,
        qualityDescription: availableQualities.find(q => q.quality === qualityValue)?.description || `${qualityValue}p`,
        availableQualities,
        size: durlList[0].size,
        duration: infoData.data.duration,
      };
    }

    // DASH format (preferred when progressive isn't available)
    if (data.dash) {
      const video = data.dash.video?.[0];
      const audio = data.dash.audio?.[0];

      if (video) {
        const rawVideoMime = (video.mimeType || video.mime_type) as string | undefined;
        const rawAudioMime = (audio?.mimeType || audio?.mime_type) as string | undefined;
        const videoMimeType = rawVideoMime && video.codecs
          ? `${rawVideoMime}; codecs="${video.codecs}"`
          : rawVideoMime;
        const audioMimeType = rawAudioMime && audio?.codecs
          ? `${rawAudioMime}; codecs="${audio?.codecs}"`
          : rawAudioMime;

        return {
          videoUrl: video.baseUrl || video.base_url,
          audioUrl: audio?.baseUrl || audio?.base_url,
          format: 'dash',
          videoMimeType,
          audioMimeType,
          quality: video.id || quality,
          qualityDescription: availableQualities.find(q => q.quality === video.id)?.description || `${video.id}p`,
          availableQualities,
          size: (video.size || 0) + (audio?.size || 0),
          duration: infoData.data.duration,
        };
      }
    }

    // FLV format fallback
    if (Array.isArray(durlList) && durlList.length > 0) {
      const qualityValue = (data.quality as number) || quality;
      return {
        videoUrl: durlList[0].url,
        format: 'progressive',
        videoMimeType: 'video/mp4',
        quality: qualityValue,
        qualityDescription: availableQualities.find(q => q.quality === qualityValue)?.description || `${qualityValue}p`,
        availableQualities,
        size: durlList[0].size,
        duration: infoData.data.duration,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting video stream:', error);
    return null;
  }
}

// Subtitle types
export interface SubtitleCue {
  from: number;
  to: number;
  content: string;
  contentEn?: string;
}

export interface SubtitleTrack {
  id: number;
  language: string;
  languageDoc: string;
  url: string;
  cues: SubtitleCue[];
}

export async function getVideoSubtitles(bvid: string): Promise<SubtitleTrack[]> {
  try {
    // Get video info to find CID and subtitle list
    const infoUrl = `${API_BASE}/x/web-interface/view?bvid=${bvid}`;
    const infoResponse = await apiFetch(infoUrl, { headers: getHeaders() });
    const infoData = await infoResponse.json();

    if (infoData.code !== 0 || !infoData.data?.cid) {
      return [];
    }

    const cid = infoData.data.cid;

    // Get player info which contains subtitle list
    const playerUrl = `${API_BASE}/x/player/v2?bvid=${bvid}&cid=${cid}`;
    const playerResponse = await apiFetch(playerUrl, { headers: getHeaders() });
    const playerData = await playerResponse.json();

    if (playerData.code !== 0) {
      return [];
    }

    const subtitleInfo = playerData.data?.subtitle;
    if (!subtitleInfo?.subtitles || subtitleInfo.subtitles.length === 0) {
      return [];
    }

    // Fetch each subtitle track
    const tracks: SubtitleTrack[] = [];

    for (const sub of subtitleInfo.subtitles) {
      try {
        // Subtitle URL needs https
        const subUrl = sub.subtitle_url.startsWith('//')
          ? `https:${sub.subtitle_url}`
          : sub.subtitle_url;

        const subResponse = await apiFetch(subUrl, { headers: getHeaders() });
        const subData = await subResponse.json();

        if (subData.body && Array.isArray(subData.body)) {
          const cues: SubtitleCue[] = subData.body.map((item: { from: number; to: number; content: string }) => ({
            from: item.from,
            to: item.to,
            content: item.content,
          }));

          // Translate cues if Chinese
          if (sub.lan === 'zh-CN' || sub.lan === 'zh-Hans') {
            try {
              const translations = await Promise.all(
                cues.slice(0, 100).map(cue =>
                  translateToEnglish(cue.content).catch(() => cue.content)
                )
              );
              cues.slice(0, 100).forEach((cue, i) => {
                cue.contentEn = translations[i];
              });
            } catch {
              // Ignore translation errors
            }
          }

          tracks.push({
            id: sub.id,
            language: sub.lan,
            languageDoc: sub.lan_doc,
            url: subUrl,
            cues,
          });
        }
      } catch (e) {
        console.error('Failed to fetch subtitle:', e);
      }
    }

    return tracks;
  } catch (error) {
    console.error('Error getting subtitles:', error);
    return [];
  }
}

export async function getRelatedVideos(bvid: string): Promise<BiliVideo[]> {
  try {
    const url = `${API_BASE}/x/web-interface/archive/related?bvid=${bvid}`;
    const response = await apiFetch(url, { headers: getHeaders() });
    const data = await response.json();

    if (data.code !== 0) {
      console.error('Failed to get related videos:', data.message);
      return [];
    }

    const list = data.data || [];
    const videos: BiliVideo[] = list.map((item: Record<string, unknown>) => {
      const stat = item.stat as Record<string, unknown> | undefined;
      const owner = item.owner as Record<string, unknown> | undefined;
      return {
        bvid: (item.bvid as string) || '',
        aid: (item.aid as number) || 0,
        title: (item.title as string) || '',
        desc: (item.desc as string) || '',
        pic: normalizeImageUrl(item.pic),
        duration: (item.duration as number) || 0,
        view: parseCount(stat?.view),
        danmaku: parseCount(stat?.danmaku),
        reply: parseCount(stat?.reply),
        favorite: parseCount(stat?.favorite),
        coin: parseCount(stat?.coin),
        share: parseCount(stat?.share),
        like: parseCount(stat?.like),
        owner: {
          mid: (owner?.mid as number) || 0,
          name: (owner?.name as string) || '',
          face: normalizeImageUrl(owner?.face),
        },
        pubdate: (item.pubdate as number) || 0,
        cid: (item.cid as number) || 0,
      };
    });

    // Translate titles and channel names
    await translateVideoDetails(videos);

    return videos;
  } catch (error) {
    console.error('Error getting related videos:', error);
    return [];
  }
}
