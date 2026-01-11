import { LazyStore } from '@tauri-apps/plugin-store';
import type { Playlist, BiliVideo } from '../types/bilibili';

const STORE_KEY = 'playlists';
const STORE_PATH = 'playlists.json';
const LOCAL_STORAGE_KEY = 'bilibili_playlists';
const isTauri = typeof window !== 'undefined'
  && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
let store: LazyStore | null = null;

function getStore(): LazyStore | null {
  if (!isTauri) return null;
  if (!store) {
    store = new LazyStore(STORE_PATH);
  }
  return store;
}

export async function getPlaylists(): Promise<Playlist[]> {
  try {
    if (!isTauri) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Playlist[]) : [];
    }
    const s = getStore();
    if (!s) return [];
    const playlists = await s.get<Playlist[]>(STORE_KEY);
    return playlists || [];
  } catch (error) {
    console.error('Error loading playlists:', error);
    return [];
  }
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  try {
    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(playlists));
      return;
    }
    const s = getStore();
    if (!s) return;
    await s.set(STORE_KEY, playlists);
    await s.save();
  } catch (error) {
    console.error('Error saving playlists:', error);
  }
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const playlists = await getPlaylists();
  const newPlaylist: Playlist = {
    id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    videos: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  playlists.push(newPlaylist);
  await savePlaylists(playlists);
  return newPlaylist;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const playlists = await getPlaylists();
  const filtered = playlists.filter(p => p.id !== playlistId);
  await savePlaylists(filtered);
}

export async function renamePlaylist(playlistId: string, newName: string): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.name = newName;
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
  }
}

export async function addVideoToPlaylist(playlistId: string, video: BiliVideo): Promise<boolean> {
  const playlists = await getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    // Check if video already exists
    if (playlist.videos.some(v => v.bvid === video.bvid)) {
      return false;
    }
    playlist.videos.push(video);
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
    return true;
  }
  return false;
}

export async function removeVideoFromPlaylist(playlistId: string, bvid: string): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.videos = playlist.videos.filter(v => v.bvid !== bvid);
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
  }
}

export async function reorderPlaylistVideos(playlistId: string, videos: BiliVideo[]): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.videos = videos;
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
  }
}
