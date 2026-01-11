// Web shim for @tauri-apps/api/window
// Provides stub implementations for web mode

export function getCurrentWindow() {
  return {
    setFullscreen: async (_fullscreen: boolean) => {
      // Use browser fullscreen API if available
      if (_fullscreen) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    },
    isFullscreen: async () => {
      return !!document.fullscreenElement;
    },
  };
}
