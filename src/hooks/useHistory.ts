import { useState, useEffect, useCallback } from 'react';
import type { BiliVideo } from '../types/bilibili';
import {
  getWatchHistory,
  addToHistory as addToHistoryService,
  removeFromHistory as removeFromHistoryService,
  clearHistory as clearHistoryService,
  updateProgress as updateProgressService,
  type WatchHistoryItem,
} from '../services/history';

export function useHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const items = await getWatchHistory();
    setHistory(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch data on mount
    loadHistory();
  }, [loadHistory]);

  const addToHistory = useCallback(async (video: BiliVideo, progress?: number) => {
    await addToHistoryService(video, progress);
    // Update local state
    setHistory(prev => {
      const filtered = prev.filter(item => item.video.bvid !== video.bvid);
      return [
        { video, watchedAt: Date.now(), progress, duration: video.duration },
        ...filtered,
      ].slice(0, 100);
    });
  }, []);

  const updateProgress = useCallback(async (bvid: string, progress: number) => {
    await updateProgressService(bvid, progress);
    setHistory(prev =>
      prev.map(item =>
        item.video.bvid === bvid ? { ...item, progress } : item
      )
    );
  }, []);

  const removeFromHistory = useCallback(async (bvid: string) => {
    await removeFromHistoryService(bvid);
    setHistory(prev => prev.filter(item => item.video.bvid !== bvid));
  }, []);

  const clearHistory = useCallback(async () => {
    await clearHistoryService();
    setHistory([]);
  }, []);

  return {
    history,
    loading,
    addToHistory,
    updateProgress,
    removeFromHistory,
    clearHistory,
    refreshHistory: loadHistory,
  };
}
