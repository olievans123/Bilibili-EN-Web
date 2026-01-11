import { Store } from '@tauri-apps/plugin-store';
import type { BiliVideo } from '../types/bilibili';

const STORE_PATH = 'history.json';
const MAX_HISTORY_ITEMS = 100;
const LOCAL_STORAGE_KEY = 'bilibili_history';
const isTauri = typeof window !== 'undefined'
  && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);

export interface WatchHistoryItem {
  video: BiliVideo;
  watchedAt: number;
  progress?: number; // seconds watched
  duration?: number; // total duration
}

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri) return null;
  if (store) return store;
  try {
    store = await Store.load(STORE_PATH);
    return store;
  } catch (error) {
    console.error('Failed to load history store:', error);
    return null;
  }
}

export async function getWatchHistory(): Promise<WatchHistoryItem[]> {
  try {
    if (!isTauri) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WatchHistoryItem[]) : [];
    }
    const s = await getStore();
    if (!s) return [];
    const history = await s.get<WatchHistoryItem[]>('history');
    return history || [];
  } catch (error) {
    console.error('Failed to get watch history:', error);
    return [];
  }
}

export async function addToHistory(
  video: BiliVideo,
  progress?: number
): Promise<void> {
  try {
    if (!isTauri) {
      const history = await getWatchHistory();
      const filtered = history.filter(item => item.video.bvid !== video.bvid);
      const newItem: WatchHistoryItem = {
        video,
        watchedAt: Date.now(),
        progress,
        duration: video.duration,
      };
      filtered.unshift(newItem);
      const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    const s = await getStore();
    if (!s) return;

    const history = await getWatchHistory();

    // Remove existing entry for this video if present
    const filtered = history.filter(item => item.video.bvid !== video.bvid);

    // Add new entry at the beginning
    const newItem: WatchHistoryItem = {
      video,
      watchedAt: Date.now(),
      progress,
      duration: video.duration,
    };

    filtered.unshift(newItem);

    // Limit history size
    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);

    await s.set('history', trimmed);
    await s.save();
  } catch (error) {
    console.error('Failed to add to history:', error);
  }
}

export async function updateProgress(
  bvid: string,
  progress: number
): Promise<void> {
  try {
    if (!isTauri) {
      const history = await getWatchHistory();
      const updated = history.map(item =>
        item.video.bvid === bvid ? { ...item, progress } : item
      );
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return;
    }
    const s = await getStore();
    if (!s) return;

    const history = await getWatchHistory();
    const index = history.findIndex(item => item.video.bvid === bvid);

    if (index !== -1) {
      history[index].progress = progress;
      await s.set('history', history);
      await s.save();
    }
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

export async function removeFromHistory(bvid: string): Promise<void> {
  try {
    if (!isTauri) {
      const history = await getWatchHistory();
      const filtered = history.filter(item => item.video.bvid !== bvid);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      return;
    }
    const s = await getStore();
    if (!s) return;

    const history = await getWatchHistory();
    const filtered = history.filter(item => item.video.bvid !== bvid);

    await s.set('history', filtered);
    await s.save();
  } catch (error) {
    console.error('Failed to remove from history:', error);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    if (!isTauri) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }
    const s = await getStore();
    if (!s) return;

    await s.set('history', []);
    await s.save();
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

export function formatWatchedTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatProgress(progress: number, duration: number): string {
  const percent = Math.round((progress / duration) * 100);
  return `${percent}%`;
}
