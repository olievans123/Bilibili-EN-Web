import { useState, useEffect, useCallback } from 'react';
import type { BiliVideo } from '../types/bilibili';
import {
  getFavorites,
  addToFavorites as addToFavoritesService,
  removeFromFavorites as removeFromFavoritesService,
  clearFavorites as clearFavoritesService,
  type FavoriteItem,
} from '../services/favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    const items = await getFavorites();
    setFavorites(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const addToFavorites = useCallback(async (video: BiliVideo) => {
    await addToFavoritesService(video);
    setFavorites(prev => {
      // Check if already exists
      if (prev.some(item => item.video.bvid === video.bvid)) {
        return prev;
      }
      return [{ video, favoritedAt: Date.now() }, ...prev];
    });
  }, []);

  const removeFromFavorites = useCallback(async (bvid: string) => {
    await removeFromFavoritesService(bvid);
    setFavorites(prev => prev.filter(item => item.video.bvid !== bvid));
  }, []);

  const toggleFavorite = useCallback(async (video: BiliVideo) => {
    const isFav = favorites.some(item => item.video.bvid === video.bvid);
    if (isFav) {
      await removeFromFavorites(video.bvid);
    } else {
      await addToFavorites(video);
    }
  }, [favorites, addToFavorites, removeFromFavorites]);

  const isFavorited = useCallback((bvid: string) => {
    return favorites.some(item => item.video.bvid === bvid);
  }, [favorites]);

  const clearFavorites = useCallback(async () => {
    await clearFavoritesService();
    setFavorites([]);
  }, []);

  return {
    favorites,
    loading,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
    clearFavorites,
    refreshFavorites: loadFavorites,
  };
}
