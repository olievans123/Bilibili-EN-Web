import { Store } from '@tauri-apps/plugin-store';
import type { BiliVideo } from '../types/bilibili';

const STORE_PATH = 'favorites.json';
const LOCAL_STORAGE_KEY = 'bilibili_favorites';
const isTauri = typeof window !== 'undefined'
  && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);

export interface FavoriteItem {
  video: BiliVideo;
  favoritedAt: number;
}

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri) return null;
  if (store) return store;
  try {
    store = await Store.load(STORE_PATH);
    return store;
  } catch (error) {
    console.error('Failed to load favorites store:', error);
    return null;
  }
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  try {
    if (!isTauri) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
    }
    const s = await getStore();
    if (!s) return [];
    const favorites = await s.get<FavoriteItem[]>('favorites');
    return favorites || [];
  } catch (error) {
    console.error('Failed to get favorites:', error);
    return [];
  }
}

export async function addToFavorites(video: BiliVideo): Promise<void> {
  try {
    const favorites = await getFavorites();

    // Check if already favorited
    if (favorites.some(item => item.video.bvid === video.bvid)) {
      return;
    }

    const newItem: FavoriteItem = {
      video,
      favoritedAt: Date.now(),
    };

    favorites.unshift(newItem);

    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(favorites));
      return;
    }

    const s = await getStore();
    if (!s) return;

    await s.set('favorites', favorites);
    await s.save();
  } catch (error) {
    console.error('Failed to add to favorites:', error);
  }
}

export async function removeFromFavorites(bvid: string): Promise<void> {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter(item => item.video.bvid !== bvid);

    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      return;
    }

    const s = await getStore();
    if (!s) return;

    await s.set('favorites', filtered);
    await s.save();
  } catch (error) {
    console.error('Failed to remove from favorites:', error);
  }
}

export async function isFavorited(bvid: string): Promise<boolean> {
  try {
    const favorites = await getFavorites();
    return favorites.some(item => item.video.bvid === bvid);
  } catch {
    return false;
  }
}

export async function clearFavorites(): Promise<void> {
  try {
    if (!isTauri) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }
    const s = await getStore();
    if (!s) return;

    await s.set('favorites', []);
    await s.save();
  } catch (error) {
    console.error('Failed to clear favorites:', error);
  }
}
