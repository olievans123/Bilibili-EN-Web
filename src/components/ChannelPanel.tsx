import { useEffect, useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import type { BiliChannel, BiliVideo } from '../types/bilibili';
import {
  getChannelInfo,
  getChannelVideos,
  getChannelUrl,
  formatDuration,
  formatViewCount,
} from '../services/bilibili';

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) return url.replace(/^http:/, 'https:');
  const httpsUrl = url.replace(/^http:/, 'https:');
  const match = httpsUrl.match(/https?:\/\/[^/]+\.hdslb\.com(\/.*)/);
  return match ? `/img/hdslb${match[1]}` : httpsUrl;
}

interface ChannelPanelProps {
  owner: {
    mid: number;
    name: string;
    nameEn?: string;
    face: string;
  };
  onClose: () => void;
  onVideoSelect: (video: BiliVideo) => void;
  isSubscribed?: boolean;
  onToggleSubscription?: () => void;
  translateTitles?: boolean;
  translateChannelNames?: boolean;
}

export function ChannelPanel({ owner, onClose, onVideoSelect, isSubscribed, onToggleSubscription, translateTitles = true, translateChannelNames = true }: ChannelPanelProps) {
  const [channel, setChannel] = useState<BiliChannel | null>(null);
  const [videos, setVideos] = useState<BiliVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const normalizeVideos = useCallback((incoming: BiliVideo[], channelInfo?: BiliChannel | null) => {
    const name = channelInfo?.name || owner.name;
    const face = channelInfo?.face || owner.face;
    return incoming.map(video => ({
      ...video,
      owner: {
        mid: owner.mid,
        name: video.owner.name || name,
        face: video.owner.face || face,
      },
    }));
  }, [owner.face, owner.mid, owner.name]);

  const loadChannel = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVideos([]);
    setPage(1);
    setTotal(0);
    setHasMore(true);

    try {
      const [info, videoResult] = await Promise.all([
        getChannelInfo(owner.mid),
        getChannelVideos(owner.mid, 1, 20),
      ]);

      const channelInfo: BiliChannel = info || {
        mid: owner.mid,
        name: owner.name,
        face: owner.face,
        sign: '',
        level: 0,
        follower: 0,
        following: 0,
        videoCount: 0,
      };

      setChannel({
        ...channelInfo,
        videoCount: videoResult.total || channelInfo.videoCount,
      });
      setVideos(normalizeVideos(videoResult.videos, channelInfo));
      setTotal(videoResult.total);
    } catch (err) {
      console.error('Failed to load channel:', err);
      setError('Failed to load channel');
    } finally {
      setLoading(false);
    }
  }, [normalizeVideos, owner.face, owner.mid, owner.name]);

  const [hasMore, setHasMore] = useState(true);

  // Determine displayed channel name based on translation settings
  const displayChannelName = translateChannelNames && (channel?.nameEn || owner.nameEn)
    ? (channel?.nameEn || owner.nameEn)
    : (channel?.name || owner.name);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await getChannelVideos(owner.mid, nextPage, 20);
      // Deduplicate by bvid
      const existingBvids = new Set(videos.map(v => v.bvid));
      const newVideos = normalizeVideos(result.videos, channel).filter(v => !existingBvids.has(v.bvid));
      console.log('[ChannelPanel] Page', nextPage, '- got', result.videos.length, 'videos,', newVideos.length, 'new');

      if (newVideos.length === 0) {
        // No new videos, stop pagination
        setHasMore(false);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
        setPage(nextPage);
      }
      setTotal(result.total);
      if (channel) {
        setChannel({ ...channel, videoCount: result.total || channel.videoCount });
      }
    } catch (err) {
      console.error('Failed to load more channel videos:', err);
      setError('Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  }, [channel, hasMore, loadingMore, normalizeVideos, owner.mid, page, videos]);

  useEffect(() => {
    loadChannel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.mid]); // Only reload when channel changes, not when callback reference changes

  const handleOpenChannel = async () => {
    const url = getChannelUrl(owner.mid);
    try {
      await open(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div
      className="panel-sidebar"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        background: '#0d0d0d',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {channel?.face || owner.face ? (
            <img
              src={proxyImageUrl(channel?.face || owner.face)}
              alt={channel?.name || owner.name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid #00a1d6',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {displayChannelName}
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#666',
            }}>
              {channel?.videoCount || 0} videos
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onToggleSubscription && (
            <button
              onClick={onToggleSubscription}
              style={{
                background: isSubscribed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 114, 153, 0.2)',
                border: `1px solid ${isSubscribed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 114, 153, 0.4)'}`,
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                color: isSubscribed ? '#ef4444' : '#fb7299',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isSubscribed ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Subscribed
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Subscribe
                </>
              )}
            </button>
          )}
          <button
            onClick={handleOpenChannel}
            style={{
              background: 'rgba(0, 161, 214, 0.2)',
              border: '1px solid rgba(0, 161, 214, 0.4)',
              borderRadius: '8px',
              padding: '8px 10px',
              cursor: 'pointer',
              color: '#00a1d6',
              fontSize: '12px',
            }}
          >
            Open
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#888',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Channel stats */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Followers</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#fff' }}>
            {formatViewCount(channel?.follower || 0)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Following</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#fff' }}>
            {formatViewCount(channel?.following || 0)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Level</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#fff' }}>
            {channel?.level || 0}
          </p>
        </div>
      </div>

      {/* Bio */}
      {(channel?.sign || '') && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          color: '#888',
          fontSize: '12px',
        }}>
          {channel?.sign}
        </div>
      )}

      {/* Videos list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: '12px',
          }}>
            <Spinner size={28} />
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
              Loading channel videos...
            </p>
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#ef4444',
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
            <button
              onClick={loadChannel}
              style={{
                marginTop: '12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666',
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No videos available</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {videos.map((video, index) => (
              <div
                key={video.bvid}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onVideoSelect(video);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                <span style={{
                  width: '24px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '13px',
                  lineHeight: '48px',
                }}>
                  {index + 1 + (page - 1) * 20}
                </span>
                <div style={{
                  width: '85px',
                  height: '48px',
                  borderRadius: '6px',
                  background: '#1a1a1a',
                  overflow: 'hidden',
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
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontFamily: 'SF Mono, monospace',
                  }}>
                    {formatDuration(video.duration)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {translateTitles && video.titleEn ? video.titleEn : video.title}
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: '#666',
                  }}>
                    {formatViewCount(video.view)} views
                  </p>
                </div>
              </div>
            ))}
            {hasMore && videos.length > 0 && (videos.length < total || total === 0) && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  marginTop: '6px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#bbb',
                  cursor: loadingMore ? 'default' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {loadingMore ? 'Loading more...' : `Load more videos${total > 0 ? ` (${videos.length}/${total})` : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
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
