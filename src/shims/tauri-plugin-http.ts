// Web shim for @tauri-apps/plugin-http
// In web mode, we use the browser's native fetch

export const fetch = window.fetch.bind(window);
