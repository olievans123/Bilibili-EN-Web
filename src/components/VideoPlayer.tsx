import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { BiliVideo, BiliComment } from '../types/bilibili';
import type { PlaylistContext } from './PlaylistPanel';
import { getVideoComments, getVideoUrl, getRelatedVideos, formatDuration } from '../services/bilibili';
import { downloadVideo, type DownloadProgress, getAvailableQualities, type VideoQuality } from '../services/download';
import { translateToEnglish } from '../services/translate';

// Proxy Bilibili image URLs in dev mode
function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) {
    return url.replace(/^http:/, 'https:');
  }
  const httpsUrl = url.replace(/^http:/, 'https:');
  const hdslbMatch = httpsUrl.match(/https?:\/\/([^/]+\.hdslb\.com)(\/.*)/);
  if (hdslbMatch) {
    return `/img/hdslb${hdslbMatch[2]}`;
  }
  return httpsUrl;
}

interface VideoPlayerProps {
  video: BiliVideo;
  onClose: () => void;
  onAddToPlaylist?: (video: BiliVideo) => void;
  onChannelSelect?: (owner: BiliVideo['owner']) => void;
  onWatched?: (video: BiliVideo) => void;
  onProgress?: (video: BiliVideo, progress: number) => void;
  onFavorite?: (video: BiliVideo) => void;
  isFavorited?: boolean;
  isLoggedIn?: boolean;
  onVideoChange?: (video: BiliVideo) => void;
  playlistContext?: PlaylistContext | null;
  onPlayNext?: () => void;
  translateTitles?: boolean;
  translateDescriptions?: boolean;
  translateComments?: boolean;
  translateChannelNames?: boolean;
  translateSubtitles?: boolean;
}

const COMMENTS_PAGE_SIZE = 20;

export function VideoPlayer({ video, onClose, onAddToPlaylist, onChannelSelect, onWatched, onFavorite, isFavorited, isLoggedIn = false, onVideoChange, playlistContext, onPlayNext, translateTitles = true, translateDescriptions = true, translateComments = true, translateChannelNames = true }: VideoPlayerProps) {
  const [comments, setComments] = useState<BiliComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [commentsRequireLogin, setCommentsRequireLogin] = useState(false);
  const latestAidRef = useRef<number | null>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const isTauri = typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const controlsHideTimerRef = useRef<number | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [qualities, setQualities] = useState<VideoQuality[]>([]);

  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Share toast
  const [showShareToast, setShowShareToast] = useState(false);

  // Description
  const [descExpanded, setDescExpanded] = useState(false);
  const [descEn, setDescEn] = useState<string | null>(null);

  // Related Videos
  const [relatedVideos, setRelatedVideos] = useState<BiliVideo[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  // Sidebar tab (comments vs related videos)
  const [sidebarTab, setSidebarTab] = useState<'comments' | 'related'>('comments');

  // Determine displayed values based on translation settings
  const displayTitle = translateTitles && video.titleEn ? video.titleEn : video.title;
  const displayChannelName = translateChannelNames && video.owner.nameEn ? video.owner.nameEn : video.owner.name;
  const displayDescription = translateDescriptions && descEn ? descEn : video.desc;
  const loginNoteText = commentsRequireLogin ? 'Sign in to load more comments' : 'Sign in to see more comments';

  // Bilibili embed URL
  const embedUrl = `https://player.bilibili.com/player.html?bvid=${video.bvid}&autoplay=1&high_quality=1`;

  const handleShare = useCallback(async () => {
    const url = getVideoUrl(video.bvid);
    try {
      await navigator.clipboard.writeText(url);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch {
      // Fallback for older browsers
      window.prompt('Copy this link:', url);
    }
  }, [video.bvid]);

  const scheduleControlsHide = useCallback(() => {
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
    }
    controlsHideTimerRef.current = window.setTimeout(() => {
      setShowPlayerControls(false);
      controlsHideTimerRef.current = null;
    }, 1500);
  }, []);

  const handlePlayerPointerMove = useCallback(() => {
    setShowPlayerControls(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const isEventInsidePlayer = useCallback((event: MouseEvent) => {
    const container = playerContainerRef.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }, []);

  const handlePlayerPointerLeave = useCallback(() => {
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    setShowPlayerControls(false);
  }, []);

  const requestDomFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    const container = playerContainerRef.current;
    const fullscreenEnabled = document.fullscreenEnabled ?? true;
    if (!container || !fullscreenEnabled || document.fullscreenElement) return;
    try {
      await container.requestFullscreen();
    } catch (err) {
      console.warn('Failed to request DOM fullscreen:', err);
    }
  }, []);

  const exitDomFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.warn('Failed to exit DOM fullscreen:', err);
    }
  }, []);

  const toggleVideoFullscreen = useCallback(() => {
    if (isVideoFullscreen) {
      setIsVideoFullscreen(false);
      setShowPlayerControls(false);
      void exitDomFullscreen();
      return;
    }
    setIsVideoFullscreen(true);
    setShowPlayerControls(true);
    scheduleControlsHide();
    void requestDomFullscreen();
    playerContainerRef.current?.focus({ preventScroll: true });
  }, [isVideoFullscreen, scheduleControlsHide, requestDomFullscreen, exitDomFullscreen]);

  // Track video as watched
  useEffect(() => {
    onWatched?.(video);
  }, [video, onWatched]);

  useEffect(() => {
    setShowDownloadMenu(false);
  }, [video.bvid]);

  // Load available qualities for download
  useEffect(() => {
    getAvailableQualities(video.bvid).then(setQualities).catch(console.error);
  }, [video.bvid]);

  // Handle download
  const handleDownload = useCallback(async (quality: number) => {
    setShowDownloadMenu(false);
    await downloadVideo(video, quality, setDownloadProgress);
  }, [video]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (isVideoFullscreen) {
            toggleVideoFullscreen();
          } else if (showDownloadMenu) {
            setShowDownloadMenu(false);
          } else if (showShortcuts) {
            setShowShortcuts(false);
          } else {
            onClose();
          }
          break;
        case '?':
          setShowShortcuts(prev => !prev);
          break;
        case 'd':
        case 'D':
          if (qualities.length > 0 && !downloadProgress) {
            setShowDownloadMenu(prev => !prev);
          }
          break;
        case 'p':
        case 'P':
          if (onAddToPlaylist) {
            onAddToPlaylist(video);
          }
          break;
        case 'f':
        case 'F':
          toggleVideoFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onAddToPlaylist, video, qualities.length, downloadProgress, showDownloadMenu, showShortcuts, toggleVideoFullscreen, isVideoFullscreen]);

  // Lock body scroll when player is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) {
        window.clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVideoFullscreen) return;
    const handleGlobalMove = (event: MouseEvent) => {
      if (isEventInsidePlayer(event)) {
        handlePlayerPointerMove();
      }
    };
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mousedown', handleGlobalMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mousedown', handleGlobalMove);
    };
  }, [isVideoFullscreen, handlePlayerPointerMove, isEventInsidePlayer]);

  useEffect(() => {
    if (!isTauri) return;
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const currentWindow = getCurrentWindow();
        await currentWindow.setFullscreen(isVideoFullscreen);
      } catch (err) {
        console.error('Failed to set fullscreen:', err);
      }
    })();
  }, [isVideoFullscreen, isTauri]);

  useEffect(() => {
    if (!isVideoFullscreen) {
      void exitDomFullscreen();
    }
  }, [isVideoFullscreen, exitDomFullscreen]);

  useEffect(() => {
    setIsVideoFullscreen(false);
  }, [video.bvid]);

  const loadComments = useCallback(async (aid: number, cursor: number, append: boolean, bvid?: string) => {
    if (!aid && !bvid) {
      setCommentsError('No video ID');
      setLoadingComments(false);
      return;
    }
    if (append) {
      setLoadingMoreComments(true);
    } else {
      setLoadingComments(true);
      setComments([]);
      setCommentsTotal(0);
      setHasMoreComments(true);
      setNextCursor(undefined);
      setCommentsRequireLogin(false);
    }
    setCommentsError(null);

    try {
      console.log('[Comments] Starting load for aid:', aid, 'bvid:', bvid);
      const result = await getVideoComments(aid, cursor, COMMENTS_PAGE_SIZE, bvid);

      // Check if this request is still relevant
      if (latestAidRef.current !== aid && aid !== 0) {
        console.log('[Comments] Stale request, ignoring');
        return;
      }

      // Check for API errors
      if (result.error) {
        console.error('[Comments] API error:', result.error);
        setCommentsError(`Comments unavailable: ${result.error}`);
        setLoadingComments(false);
        setLoadingMoreComments(false);
        return;
      }

      console.log('[Comments] Page', cursor, '- API returned', result.comments.length, 'comments, total:', result.total, 'hasMore:', result.hasMore);

      if (!append) {
        // Initial load - just set the comments
        setComments(result.comments);
        setCommentsTotal(result.total);
        setHasMoreComments(result.hasMore ?? result.comments.length === COMMENTS_PAGE_SIZE);
        setNextCursor(result.nextCursor);
        setCommentsRequireLogin(result.requiresLogin ?? false);
        setLoadingComments(false);
      } else {
        // Append mode - add new comments
        console.log('[Comments] Append mode: got', result.comments.length, 'comments from API');

        if (result.comments.length === 0) {
          console.log('[Comments] No comments returned, stopping pagination');
          setHasMoreComments(false);
          setNextCursor(undefined);
          setCommentsRequireLogin(result.requiresLogin ?? false);
          setLoadingMoreComments(false);
          return;
        }

        // Deduplicate against existing comments
        setComments(prev => {
          const existing = new Set(prev.map(comment => comment.rpid));
          const newComments = result.comments.filter(c => !existing.has(c.rpid));
          console.log('[Comments] Dedup: existing=', prev.length, 'returned=', result.comments.length, 'new=', newComments.length);

          if (newComments.length === 0) {
            console.log('[Comments] All duplicates! IDs returned:', result.comments.map(c => c.rpid).slice(0, 5));
            return prev;
          }
          console.log('[Comments] Adding', newComments.length, 'new comments');
          return [...prev, ...newComments];
        });

        // Update pagination state
        setHasMoreComments(result.hasMore ?? false);
        setNextCursor(result.nextCursor);
        setCommentsRequireLogin(result.requiresLogin ?? false);
        console.log('[Comments] Updated state: hasMore=', result.hasMore, 'nextCursor=', result.nextCursor, 'requiresLogin=', result.requiresLogin);
        setLoadingMoreComments(false);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
      setCommentsError('Failed to load comments. Tap to retry.');
      setLoadingComments(false);
      setLoadingMoreComments(false);
    }
  }, []);

  // Load comments
  useEffect(() => {
    console.log('[Comments Effect] Triggered with aid:', video.aid, 'bvid:', video.bvid);
    if (!video.aid && !video.bvid) {
      setCommentsError('No video ID');
      setLoadingComments(false);
      return;
    }
    setLoadingComments(true);
    setCommentsError(null);
    latestAidRef.current = video.aid;
    loadComments(video.aid, 0, false, video.bvid); // Start with cursor 0, pass bvid as fallback
  }, [video.aid, video.bvid, loadComments]);

  // Translate description
  useEffect(() => {
    setDescEn(null);
    setDescExpanded(false);
    if (video.desc && video.desc.trim()) {
      translateToEnglish(video.desc).then(setDescEn).catch(() => setDescEn(null));
    }
  }, [video.bvid, video.desc]);

  // Load related videos
  useEffect(() => {
    setRelatedVideos([]);
    setLoadingRelated(true);
    getRelatedVideos(video.bvid)
      .then(setRelatedVideos)
      .catch(console.error)
      .finally(() => setLoadingRelated(false));
  }, [video.bvid]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      {!isVideoFullscreen && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}>
          {/* Back button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Keyboard shortcuts button */}
            <button
              onClick={() => setShowShortcuts(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: '#888',
                fontSize: '13px',
              }}
              title="Keyboard shortcuts (?)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M8 16h8" />
              </svg>
            </button>

            {/* Download button */}
            <div style={{ position: 'relative' }}>
            {downloadProgress && downloadProgress.status !== 'error' ? (
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#22c55e',
                  fontSize: '13px',
                  fontWeight: 500,
                  minWidth: '120px',
                }}
                title={downloadProgress.error}
              >
                {downloadProgress.status === 'completed' ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Downloaded
                  </>
                ) : (
                  <>
                    <Spinner size={14} />
                    {Math.round(downloadProgress.progress)}%
                    {downloadProgress.speed && <span style={{ fontSize: '11px', color: '#888' }}>{downloadProgress.speed}</span>}
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setDownloadProgress(null);
                  setShowDownloadMenu(!showDownloadMenu);
                }}
                disabled={qualities.length === 0}
                style={{
                  background: downloadProgress?.status === 'error'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(34, 197, 94, 0.2)',
                  border: downloadProgress?.status === 'error'
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: qualities.length > 0 ? 'pointer' : 'not-allowed',
                  color: downloadProgress?.status === 'error' ? '#ef4444' : '#22c55e',
                  fontSize: '13px',
                  fontWeight: 500,
                  opacity: qualities.length > 0 ? 1 : 0.5,
                }}
                title={downloadProgress?.error || 'Download video (D)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                {downloadProgress?.status === 'error' ? 'Retry' : 'Download'}
              </button>
            )}

            {/* Quality selector dropdown */}
            {showDownloadMenu && qualities.length > 0 && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onClick={() => setShowDownloadMenu(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#1f1f1f',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 20,
                    overflow: 'hidden',
                    minWidth: '180px',
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>Select Quality</p>
                  </div>
                  {qualities.map((q) => (
                    <button
                      key={q.quality}
                      onClick={() => handleDownload(q.quality)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: '#ccc',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{q.description}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>{q.quality}p</span>
                    </button>
                  ))}
                  <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '11px',
                    color: '#666',
                  }}>
                    Some high qualities may be DASH-only. If download fails, try a lower quality.
                  </div>
                </div>
              </>
            )}
          </div>

            <button
              onClick={handleShare}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              title="Copy link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>

          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        gap: isVideoFullscreen ? 0 : '16px',
        padding: isVideoFullscreen ? 0 : '16px',
        justifyContent: isVideoFullscreen ? 'stretch' : 'center',
      }}>
        {/* Video section */}
        <div style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: isVideoFullscreen ? 'none' : '900px',
        }}>
          <div
          ref={playerContainerRef}
          tabIndex={-1}
          style={{
            width: '100%',
            background: '#000',
            overflow: 'hidden',
            position: 'relative',
            borderRadius: isVideoFullscreen ? '0' : '12px',
            ...(isVideoFullscreen
              ? { flex: 1, height: '100%' }
              : { aspectRatio: '16/9' }),
          }}
          onMouseEnter={handlePlayerPointerMove}
          onMouseMove={handlePlayerPointerMove}
          onMouseLeave={handlePlayerPointerLeave}
          >
            {isVideoFullscreen && (
              <>
                <div
                  onMouseMove={handlePlayerPointerMove}
                  onClick={handlePlayerPointerMove}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    pointerEvents: showPlayerControls ? 'none' : 'auto',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  zIndex: 2,
                  opacity: showPlayerControls ? 1 : 0,
                  pointerEvents: showPlayerControls ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease',
                }}>
                  <button
                    onClick={toggleVideoFullscreen}
                    aria-label="Exit fullscreen"
                    style={{
                      background: 'rgba(0, 0, 0, 0.55)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '999px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff',
                      transition: 'opacity 0.2s ease, background 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)';
                    }}
                    title="Exit fullscreen (Esc)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 4H4v5M4 4l6 6M15 20h5v-5M20 20l-6-6M20 9V4h-5M20 4l-6 6M4 15v5h5M4 20l6-6" />
                    </svg>
                  </button>
                </div>
              </>
            )}
            <iframe
              src={embedUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allowFullScreen
              allow="autoplay; fullscreen"
              title={video.title}
            />
            {!isVideoFullscreen && (
              <button
                onClick={toggleVideoFullscreen}
                aria-pressed={isVideoFullscreen}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '999px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'opacity 0.2s ease, background 0.2s ease',
                  opacity: showPlayerControls ? 1 : 0,
                  pointerEvents: showPlayerControls ? 'auto' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)';
                }}
                title="Enter fullscreen (F)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            )}
          </div>

          {/* Up Next Bar - shows when playing from playlist */}
          {!isVideoFullscreen && playlistContext && playlistContext.currentIndex < playlistContext.videos.length - 1 && (
            <div style={{
              marginTop: '12px',
              background: 'rgba(0, 161, 214, 0.1)',
              border: '1px solid rgba(0, 161, 214, 0.2)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '80px',
                height: '45px',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#1a1a1a',
                flexShrink: 0,
              }}>
                <img
                  src={proxyImageUrl(playlistContext.videos[playlistContext.currentIndex + 1].pic)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: '11px',
                  color: '#00a1d6',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Up Next • {playlistContext.playlistName}
                </p>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {translateTitles && playlistContext.videos[playlistContext.currentIndex + 1].titleEn
                    ? playlistContext.videos[playlistContext.currentIndex + 1].titleEn
                    : playlistContext.videos[playlistContext.currentIndex + 1].title}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Play next button */}
                <button
                  onClick={onPlayNext}
                  style={{
                    background: '#00a1d6',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  Play
                </button>
              </div>
            </div>
          )}

          {/* Video Info - YouTube style */}
          {!isVideoFullscreen && (
            <div style={{
              marginTop: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '16px',
            }}>
            {/* Title */}
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.4,
            }}>
              {displayTitle}
            </h2>

            {/* Stats row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '16px',
            }}>
              <StatItem icon="eye" value={formatNumber(video.view)} label="views" />
              <StatItem icon="like" value={formatNumber(video.like)} label="likes" />
              <StatItem icon="coin" value={formatNumber(video.coin)} label="coins" />
              <StatItem icon="star" value={formatNumber(video.favorite)} label="favorites" />
              <StatItem icon="comment" value={formatNumber(video.danmaku)} label="danmaku" />
            </div>

            {/* Channel info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flex: 1,
                minWidth: 0,
              }}>
                {video.owner.face && (
                  <img
                    src={proxyImageUrl(video.owner.face)}
                    alt={video.owner.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#333',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div>
                  <p style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#fff',
                  }}>
                    {displayChannelName}
                  </p>
                  <p style={{
                    margin: '2px 0 0 0',
                    fontSize: '12px',
                    color: '#666',
                  }}>
                    {formatTimeAgo(video.pubdate)}
                  </p>
                </div>
                {onChannelSelect && (
                  <button
                    onClick={() => onChannelSelect(video.owner)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      color: '#ccc',
                      cursor: 'pointer',
                      marginLeft: '4px',
                    }}
                  >
                    View channel
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {onAddToPlaylist && (
                  <button
                    onClick={() => onAddToPlaylist(video)}
                    style={{
                      background: 'rgba(0, 161, 214, 0.15)',
                      border: '1px solid rgba(0, 161, 214, 0.3)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: '#00a1d6',
                      fontSize: '12px',
                    }}
                    title="Add to playlist (P)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Playlist
                  </button>
                )}
                {onFavorite && (
                  <button
                    onClick={() => onFavorite(video)}
                    style={{
                      background: isFavorited ? 'rgba(251, 114, 153, 0.2)' : 'rgba(251, 114, 153, 0.08)',
                      border: `1px solid ${isFavorited ? 'rgba(251, 114, 153, 0.4)' : 'rgba(251, 114, 153, 0.2)'}`,
                      borderRadius: '8px',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: isFavorited ? '#fb7299' : '#e8879f',
                      fontSize: '12px',
                    }}
                    title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={isFavorited ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {isFavorited ? 'Favorited' : 'Favorite'}
                  </button>
                )}
              </div>
            </div>

            {/* Description dropdown */}
            {video.desc && video.desc.trim() && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#888',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: descExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  Description
                </button>
                {descExpanded && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#aaa',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {displayDescription}
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </div>

        {/* Sidebar with tabs (Comments / Related) */}
        {!isVideoFullscreen && (
          <div style={{
            flex: '0 0 400px',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
          {/* Tab header */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <button
              onClick={() => setSidebarTab('comments')}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: sidebarTab === 'comments' ? '2px solid #00a1d6' : '2px solid transparent',
                color: sidebarTab === 'comments' ? '#fff' : '#888',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Comments ({commentsTotal || comments.length})
            </button>
            <button
              onClick={() => setSidebarTab('related')}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: sidebarTab === 'related' ? '2px solid #00a1d6' : '2px solid transparent',
                color: sidebarTab === 'related' ? '#fff' : '#888',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Related ({relatedVideos.length})
            </button>
          </div>

          {/* Tab content */}
          {sidebarTab === 'comments' ? (
            /* Comments content */
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px',
            }}>
              {loadingComments ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '16px',
                }}>
                  <Spinner size={32} />
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Loading comments...
                  </p>
                </div>
              ) : commentsError ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#ef4444',
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '14px' }}>{commentsError}</p>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#888' }}>
                    aid: {video.aid || 'none'} | bvid: {video.bvid}
                  </p>
                  <button
                    onClick={() => {
                      setCommentsError(null);
                      loadComments(video.aid, 0, false, video.bvid);
                    }}
                    style={{
                      marginTop: '12px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: '#333',
                      color: '#888',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : comments.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666',
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '14px' }}>No comments available</p>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#555' }}>
                    aid: {video.aid || 'none'} | bvid: {video.bvid}
                  </p>
                  <button
                    onClick={() => loadComments(video.aid, 0, false, video.bvid)}
                    style={{
                      marginTop: '12px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: '#333',
                      color: '#888',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {comments.map(comment => (
                    <CommentItem
                      key={comment.rpid}
                      comment={comment}
                      showTranslation={translateComments}
                    />
                  ))}

                  {/* Load more comments */}
                  {hasMoreComments && typeof nextCursor === 'number' && (
                    <button
                      onClick={() => {
                        console.log('[Comments] Load more clicked, cursor:', nextCursor);
                        loadComments(video.aid, nextCursor, true, video.bvid);
                      }}
                      disabled={loadingMoreComments}
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#aaa',
                        cursor: loadingMoreComments ? 'default' : 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {loadingMoreComments ? (
                        <>
                          <Spinner size={16} />
                          Loading more...
                        </>
                      ) : (
                        `Load more comments`
                      )}
                    </button>
                  )}

                  {/* Login note */}
                  {!isLoggedIn && (
                    <p style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#666',
                      textAlign: 'center',
                      fontStyle: 'italic',
                    }}>
                      {loginNoteText}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Related Videos content */
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px',
            }}>
              {loadingRelated ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '16px',
                }}>
                  <Spinner size={32} />
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Loading related videos...
                  </p>
                </div>
              ) : relatedVideos.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666',
                }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>No related videos</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {relatedVideos.slice(0, 20).map(relatedVideo => (
                    <RelatedVideoItem
                      key={relatedVideo.bvid}
                      video={relatedVideo}
                      onClick={() => onVideoChange?.(relatedVideo)}
                      translateTitle={translateTitles}
                      translateChannelName={translateChannelNames}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', color: '#fff', fontSize: '18px' }}>
              Keyboard Shortcuts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ShortcutRow keys={['?']} description="Toggle shortcuts" />
              <ShortcutRow keys={['D']} description="Download menu" />
              <ShortcutRow keys={['P']} description="Add to playlist" />
              <ShortcutRow keys={['F']} description="Toggle fullscreen" />
              <ShortcutRow keys={['Esc']} description="Close Player" />
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Share toast */}
      {showShareToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 161, 214, 0.9)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 1100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}>
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#888', fontSize: '14px' }}>{description}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {keys.map((key) => (
          <kbd
            key={key}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#fff',
              fontFamily: 'SF Mono, monospace',
            }}
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, showTranslation }: { comment: BiliComment; showTranslation: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const displayMessage = showTranslation && comment.content.messageEn
    ? comment.content.messageEn
    : comment.content.message;

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '8px',
      transition: 'background 0.2s',
    }}>
      {/* Comment header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <img
          src={proxyImageUrl(comment.member.avatar)}
          alt={comment.member.uname}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#333',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {comment.member.uname}
          </span>
          <span style={{
            fontSize: '11px',
            color: '#555',
          }}>
            {formatTimeAgo(comment.ctime)}
          </span>
        </div>
        <span style={{
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
          {formatNumber(comment.like)}
        </span>
      </div>

      {/* Comment content */}
      <p style={{
        margin: 0,
        fontSize: '13px',
        lineHeight: 1.5,
        color: '#ccc',
        wordBreak: 'break-word',
      }}>
        {displayMessage}
      </p>


      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#00a1d6',
              fontSize: '12px',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {expanded ? 'Hide' : 'Show'} {comment.replies.length} replies
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expanded && (
            <div style={{
              marginTop: '8px',
              paddingLeft: '12px',
              borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {comment.replies.map(reply => (
                <div key={reply.rpid} style={{ fontSize: '12px' }}>
                  <span style={{ color: '#00a1d6' }}>{reply.member.uname}</span>
                  <span style={{ color: '#888' }}>: </span>
                  <span style={{ color: '#aaa' }}>{reply.content.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'W';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function StatItem({ icon, value, label }: { icon: string; value: string; label: string }) {
  const icons: Record<string, ReactNode> = {
    eye: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    like: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    ),
    coin: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M9 9h6M9 15h6" />
      </svg>
    ),
    star: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    comment: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: '#888',
    }}>
      <span style={{ color: '#666' }}>{icons[icon]}</span>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{value}</span>
      <span style={{ fontSize: '12px', color: '#555' }}>{label}</span>
    </div>
  );
}

function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid rgba(255, 255, 255, 0.1)`,
        borderTopColor: '#00a1d6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}

function RelatedVideoItem({ video, onClick, translateTitle = true, translateChannelName = true }: { video: BiliVideo; onClick: () => void; translateTitle?: boolean; translateChannelName?: boolean }) {
  const displayTitle = translateTitle && video.titleEn ? video.titleEn : video.title;
  const displayChannelName = translateChannelName && video.owner.nameEn ? video.owner.nameEn : video.owner.name;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100px',
        height: '56px',
        borderRadius: '6px',
        overflow: 'hidden',
        background: '#1a1a1a',
        flexShrink: 0,
        position: 'relative',
      }}>
        <img
          src={proxyImageUrl(video.pic)}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {/* Duration badge */}
        <span style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          fontSize: '10px',
          padding: '2px 4px',
          borderRadius: '3px',
        }}>
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Info */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <p style={{
          margin: 0,
          fontSize: '12px',
          fontWeight: 500,
          color: '#fff',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {displayTitle}
        </p>
        <p style={{
          margin: 0,
          fontSize: '11px',
          color: '#666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayChannelName}
        </p>
        <p style={{
          margin: 0,
          fontSize: '10px',
          color: '#555',
        }}>
          {formatNumber(video.view)} views
        </p>
      </div>
    </button>
  );
}
