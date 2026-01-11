import { Store } from '@tauri-apps/plugin-store';

const STORE_PATH = 'settings.json';
const LOCAL_STORAGE_KEY = 'bilibili_settings';
const isTauri = typeof window !== 'undefined'
  && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);

export interface AppSettings {
  defaultQuality: number; // 80 (1080p), 64 (720p), 32 (480p), 16 (360p)
  autoplay: boolean;
  // Granular translation settings
  translateTitles: boolean;
  translateDescriptions: boolean;
  translateComments: boolean;
  translateChannelNames: boolean;
  translateSubtitles: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultQuality: 80,
  autoplay: true,
  translateTitles: true,
  translateDescriptions: true,
  translateComments: true,
  translateChannelNames: true,
  translateSubtitles: true,
};

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri) return null;
  if (store) return store;
  try {
    store = await Store.load(STORE_PATH);
    return store;
  } catch (error) {
    console.error('Failed to load settings store:', error);
    return null;
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    if (!isTauri) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
      return DEFAULT_SETTINGS;
    }
    const s = await getStore();
    if (!s) return DEFAULT_SETTINGS;
    const settings = await s.get<AppSettings>('settings');
    return settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
      return;
    }
    const s = await getStore();
    if (!s) return;
    await s.set('settings', settings);
    await s.save();
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const settings = await getSettings();
  settings[key] = value;
  await saveSettings(settings);
}

export async function resetSettings(): Promise<void> {
  await saveSettings(DEFAULT_SETTINGS);
}
