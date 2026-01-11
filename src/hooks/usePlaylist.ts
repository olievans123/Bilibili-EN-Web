import { useState, useEffect, useCallback } from 'react';
import type { Playlist, BiliVideo } from '../types/bilibili';
import {
  getPlaylists,
  createPlaylist as createPlaylistService,
  deletePlaylist as deletePlaylistService,
  renamePlaylist as renamePlaylistService,
  addVideoToPlaylist as addVideoService,
  removeVideoFromPlaylist as removeVideoService,
} from '../services/playlist';

export function usePlaylist() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    const loaded = await getPlaylists();
    setPlaylists(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch data on mount
    loadPlaylists();
  }, [loadPlaylists]);

  const createPlaylist = useCallback(async (name: string) => {
    const newPlaylist = await createPlaylistService(name);
    setPlaylists(prev => [...prev, newPlaylist]);
    return newPlaylist;
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    await deletePlaylistService(playlistId);
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
  }, []);

  const renamePlaylist = useCallback(async (playlistId: string, newName: string) => {
    await renamePlaylistService(playlistId, newName);
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, name: newName, updatedAt: Date.now() } : p
    ));
  }, []);

  const addVideoToPlaylist = useCallback(async (playlistId: string, video: BiliVideo) => {
    const added = await addVideoService(playlistId, video);
    if (added) {
      setPlaylists(prev => prev.map(p =>
        p.id === playlistId
          ? { ...p, videos: [...p.videos, video], updatedAt: Date.now() }
          : p
      ));
    }
    return added;
  }, []);

  const removeVideoFromPlaylist = useCallback(async (playlistId: string, bvid: string) => {
    await removeVideoService(playlistId, bvid);
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId
        ? { ...p, videos: p.videos.filter(v => v.bvid !== bvid), updatedAt: Date.now() }
        : p
    ));
  }, []);

  return {
    playlists,
    loading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    refreshPlaylists: loadPlaylists,
  };
}
