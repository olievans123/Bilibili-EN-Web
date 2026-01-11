import { useState, useEffect, useCallback } from 'react';
import type { BiliUser } from '../types/bilibili';
import { checkLoginStatus, logout as authLogout, loadSavedCookies } from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState<BiliUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      await loadSavedCookies();
      const currentUser = await checkLoginStatus();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  return {
    user,
    loading,
    isLoggedIn: !!user,
    logout,
    refreshAuth,
  };
}
