import { useState, useEffect, useCallback } from 'react';
import {
  getSettings,
  saveSettings,
  type AppSettings,
} from '../services/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    defaultQuality: 80,
    autoplay: true,
    translateTitles: true,
    translateDescriptions: true,
    translateComments: true,
    translateChannelNames: true,
    translateSubtitles: true,
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const loaded = await getSettings();
    setSettings(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
  }, [settings]);

  const resetSettings = useCallback(async () => {
    const defaultSettings: AppSettings = {
      defaultQuality: 80,
      autoplay: true,
      translateTitles: true,
      translateDescriptions: true,
      translateComments: true,
      translateChannelNames: true,
      translateSubtitles: true,
    };
    setSettings(defaultSettings);
    await saveSettings(defaultSettings);
  }, []);

  return {
    settings,
    loading,
    updateSetting,
    resetSettings,
    refreshSettings: loadSettings,
  };
}
