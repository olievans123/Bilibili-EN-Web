import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getVideoStreamInfo, type VideoQuality } from './bilibili';
import type { BiliVideo } from '../types/bilibili';

export type { VideoQuality };

export interface DownloadProgress {
  bvid: string;
  status: 'pending' | 'downloading' | 'merging' | 'completed' | 'error';
  progress: number; // 0-100
  speed?: string;
  eta?: string;
  error?: string;
  filePath?: string;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

// Active downloads map
const activeDownloads = new Map<string, AbortController>();

export function cancelDownload(bvid: string): void {
  const controller = activeDownloads.get(bvid);
  if (controller) {
    controller.abort();
    activeDownloads.delete(bvid);
  }
}

export async function getAvailableQualities(bvid: string): Promise<VideoQuality[]> {
  const streamInfo = await getVideoStreamInfo(bvid);
  return streamInfo?.availableQualities || [];
}

export async function downloadVideo(
  video: BiliVideo,
  quality: number = 80,
  onProgress?: DownloadProgressCallback
): Promise<string | null> {
  const bvid = video.bvid;

  try {
    // Report initial status
    onProgress?.({
      bvid,
      status: 'pending',
      progress: 0,
    });

    // Get stream info
    const streamInfo = await getVideoStreamInfo(bvid, quality, { preferProgressive: true });
    if (!streamInfo) {
      onProgress?.({
        bvid,
        status: 'error',
        progress: 0,
        error: 'Failed to get video stream URL',
      });
      return null;
    }

    if (streamInfo.format === 'dash') {
      onProgress?.({
        bvid,
        status: 'error',
        progress: 0,
        error: 'This quality is DASH-only. Audio/video merging is not supported yet. Try a lower quality.',
      });
      return null;
    }

    // Create abort controller
    const controller = new AbortController();
    activeDownloads.set(bvid, controller);

    // Sanitize filename
    const title = (video.titleEn || video.title)
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    const fileName = `${title} [${bvid}].mp4`;

    onProgress?.({
      bvid,
      status: 'downloading',
      progress: 0,
    });

    // Download video
    const videoBlob = await downloadWithProgress(
      streamInfo.videoUrl,
      streamInfo.size,
      (progress, speed) => {
        onProgress?.({
          bvid,
          status: 'downloading',
          progress,
          speed,
        });
      },
      controller.signal
    );

    if (!videoBlob) {
      throw new Error('Failed to download video stream');
    }

    // Save file
    onProgress?.({
      bvid,
      status: 'merging',
      progress: 95,
    });

    // Create blob and trigger browser download
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    activeDownloads.delete(bvid);

    onProgress?.({
      bvid,
      status: 'completed',
      progress: 100,
      filePath: fileName,
    });

    return fileName;
  } catch (error) {
    activeDownloads.delete(bvid);

    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.({
      bvid,
      status: 'error',
      progress: 0,
      error: errorMsg,
    });

    console.error('Download failed:', error);
    return null;
  }
}

// Check isTauri dynamically (Tauri 2.0 uses __TAURI_INTERNALS__)
function checkIsTauri(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

async function downloadWithProgress(
  url: string,
  expectedSize: number | undefined,
  onProgress: (progress: number, speed: string) => void,
  signal: AbortSignal
): Promise<Blob | null> {
  try {
    const startTime = Date.now();

    const requestInit = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
      signal,
    };
    const response = checkIsTauri()
      ? await tauriFetch(url, requestInit)
      : await window.fetch(url, requestInit);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLength = expectedSize || parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No response body');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // Calculate progress and speed
      const progress = contentLength > 0 ? (receivedLength / contentLength) * 100 : 0;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? formatSpeed(receivedLength / elapsed) : '';

      onProgress(Math.min(progress, 100), speed);
    }

    return new Blob(chunks as BlobPart[], { type: 'video/mp4' });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Download cancelled');
      return null;
    }
    throw error;
  }
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytesPerSecond)} B/s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
