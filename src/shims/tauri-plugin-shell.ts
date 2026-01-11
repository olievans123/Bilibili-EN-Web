// Web shim for @tauri-apps/plugin-shell
// Uses window.open instead of Tauri's shell

export async function open(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const Command = {
  create: () => ({
    execute: async () => ({ code: 1, stdout: '', stderr: 'Not available in web mode' }),
  }),
};
