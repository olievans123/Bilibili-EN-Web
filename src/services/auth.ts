import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { load, Store } from '@tauri-apps/plugin-store';
import { setCookies, getCookies, getCurrentUser, getBuvidCookies } from './bilibili';
import type { BiliUser } from '../types/bilibili';

const STORE_KEY = 'bilibili_auth';
const LOCAL_STORAGE_KEY = 'bilibili_auth';
const AUTH_BASE = 'https://passport.bilibili.com';
const AUTH_SOURCE = 'main_web';
const AUTH_ORIGIN = 'https://passport.bilibili.com';
const AUTH_PROXY_BASE = (import.meta.env.VITE_PASSPORT_PROXY_BASE as string | undefined)?.replace(/\/$/, '')
  || '/api/passport';
let store: Store | null = null;
const AUTH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Check isTauri dynamically (Tauri 2.0 uses __TAURI_INTERNALS__)
function checkIsTauri(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

async function getStore(): Promise<Store> {
  if (!checkIsTauri()) {
    throw new Error('Store not available');
  }
  if (!store) {
    store = await load('auth.json');
  }
  return store;
}

export interface QRCodeData {
  url: string;
  qrcode_key: string;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${AUTH_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
  }

  if (checkIsTauri()) {
    return tauriFetch(url, {
      ...options,
      headers: Object.fromEntries(headers.entries()),
    });
  }

  const isDev = import.meta.env.DEV;
  const useProxy = isDev || Boolean(import.meta.env.VITE_PASSPORT_PROXY_BASE);
  const targetUrl = useProxy ? `${AUTH_PROXY_BASE}${path}` : url;

  return window.fetch(targetUrl, {
    ...options,
    headers,
  });
}

function getAuthHeaders(): Record<string, string> {
  const cookieParts: string[] = [];
  const buvid = getBuvidCookies();
  if (buvid) {
    cookieParts.push(buvid);
  }
  const storedCookies = getCookies();
  if (storedCookies) {
    cookieParts.push(storedCookies);
  }

  return {
    'User-Agent': AUTH_USER_AGENT,
    'Referer': `${AUTH_ORIGIN}/`,
    'Origin': AUTH_ORIGIN,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...(cookieParts.length > 0 ? { 'Cookie': cookieParts.join('; ') } : {}),
  };
}

async function parseAuthResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login request failed (HTTP ${response.status})`);
  }
  if (text.startsWith('<!') || text.startsWith('<html')) {
    throw new Error('Login blocked by Bilibili (HTML response)');
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Login response was not valid JSON');
  }
}

export async function getLoginQRCode(): Promise<QRCodeData> {
  try {
    const response = await authFetch(`/x/passport-login/web/qrcode/generate?source=${AUTH_SOURCE}`, {
      headers: getAuthHeaders(),
    });

    const data = await parseAuthResponse(response);

    if (data.code !== 0) {
      throw new Error(`Failed to get QR code: ${data.message || data.code}`);
    }

    const payload = data.data as Record<string, unknown> | undefined;
    const url = payload?.url as string | undefined;
    const qrcodeKey = payload?.qrcode_key as string | undefined;
    if (!url || !qrcodeKey) {
      throw new Error('Login response missing QR code data');
    }

    return { url, qrcode_key: qrcodeKey };
  } catch (error) {
    console.error('Error getting QR code:', error);
    throw error instanceof Error ? error : new Error('Failed to generate QR code');
  }
}

export interface QRCodeStatus {
  code: number;
  message: string;
  cookies?: string;
}

export async function checkQRCodeStatus(qrcode_key: string): Promise<QRCodeStatus> {
  try {
    const response = await authFetch(`/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}&source=${AUTH_SOURCE}`, {
      headers: getAuthHeaders(),
    });

    const data = await parseAuthResponse(response);

    // Status codes:
    // 0 = Success (logged in)
    // 86038 = QR code expired
    // 86090 = QR code scanned, waiting for confirmation
    // 86101 = QR code not scanned

    if (data.code !== 0) {
      return { code: data.code as number, message: String(data.message || 'Login error') };
    }

    const payload = data.data as Record<string, unknown> | undefined;
    const statusCode = payload?.code as number;

    if (statusCode === 0) {
      // Login successful - extract cookies from response
      // The cookies are in the URL parameters of the refresh_token URL
      const url = payload?.url as string;
      const cookies = extractCookiesFromUrl(url);

      if (cookies) {
        await saveCookies(cookies);
        setCookies(cookies);
      }

      return { code: 0, message: 'Login successful', cookies: cookies || undefined };
    }

    return {
      code: statusCode,
      message: getStatusMessage(statusCode),
    };
  } catch (error) {
    console.error('Error checking QR code status:', error);
    return { code: -1, message: error instanceof Error ? error.message : 'Network error' };
  }
}

function extractCookiesFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const cookieParts: string[] = [];

    // Extract key cookies from URL parameters
    const DedeUserID = params.get('DedeUserID');
    const DedeUserID__ckMd5 = params.get('DedeUserID__ckMd5');
    const SESSDATA = params.get('SESSDATA');
    const bili_jct = params.get('bili_jct');

    if (DedeUserID) cookieParts.push(`DedeUserID=${DedeUserID}`);
    if (DedeUserID__ckMd5) cookieParts.push(`DedeUserID__ckMd5=${DedeUserID__ckMd5}`);
    if (SESSDATA) cookieParts.push(`SESSDATA=${SESSDATA}`);
    if (bili_jct) cookieParts.push(`bili_jct=${bili_jct}`);

    if (cookieParts.length > 0) {
      return cookieParts.join('; ');
    }

    return null;
  } catch (error) {
    console.error('Error extracting cookies:', error);
    return null;
  }
}

function getStatusMessage(code: number): string {
  switch (code) {
    case 86038:
      return 'QR code expired';
    case 86090:
      return 'Scanned - please confirm on your phone';
    case 86101:
      return 'Waiting for scan...';
    default:
      return 'Unknown status';
  }
}

export async function saveCookies(cookies: string): Promise<void> {
  try {
    if (!checkIsTauri()) {
      // Avoid persisting session cookies in web builds.
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }
    const s = await getStore();
    await s.set(STORE_KEY, { cookies });
    await s.save();
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

export async function loadSavedCookies(): Promise<string | null> {
  try {
    if (!checkIsTauri()) {
      // Clear any legacy persisted cookies from older builds.
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
    const s = await getStore();
    const data = await s.get<{ cookies: string }>(STORE_KEY);
    if (data?.cookies) {
      setCookies(data.cookies);
      return data.cookies;
    }
    return null;
  } catch (error) {
    console.error('Error loading cookies:', error);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    if (!checkIsTauri()) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      setCookies('');
      return;
    }
    const s = await getStore();
    await s.delete(STORE_KEY);
    await s.save();
    setCookies('');
  } catch (error) {
    console.error('Error logging out:', error);
  }
}

export async function checkLoginStatus(): Promise<BiliUser | null> {
  const cookies = getCookies();
  if (!cookies) {
    await loadSavedCookies();
  }
  return getCurrentUser();
}
