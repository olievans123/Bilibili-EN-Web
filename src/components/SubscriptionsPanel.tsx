import { useState, useEffect, useCallback } from 'react';
import type { BiliVideo } from '../types/bilibili';
import type { Subscription } from '../services/subscriptions';
import { getChannelVideos, formatDuration, formatViewCount } from '../services/bilibili';

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) return url.replace(/^http:/, 'https:');
  const match = url.match(/https?:\/\/[^/]+\.hdslb\.com(\/.*)/);
  return match ? `/img/hdslb${match[1]}` : url.replace(/^http:/, 'https:');
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

interface SubscriptionsPanelProps {
  subscriptions: Subscription[];
  onVideoSelect: (video: BiliVideo) => void;
  onChannelSelect: (channel: { mid: number; name: string; face: string }) => void;
  onUnsubscribe: (mid: number) => void;
  onClear: () => void;
  onClose: () => void;
}

type ViewMode = 'channels' | 'feed';

export function SubscriptionsPanel({
  subscriptions,
  onVideoSelect,
  onChannelSelect,
  onUnsubscribe,
  onClear,
  onClose,
}: SubscriptionsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [feedVideos, setFeedVideos] = useState<BiliVideo[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Load feed videos from all subscribed channels
  const loadFeed = useCallback(async () => {
    if (subscriptions.length === 0) {
      setFeedVideos([]);
      return;
    }

    setLoadingFeed(true);
    setFeedError(null);

    try {
      // Fetch videos from all subscribed channels in parallel (limit concurrency)
      const results = await Promise.all(
        subscriptions.slice(0, 10).map(sub =>
          getChannelVideos(sub.mid, 1, 5).catch(() => ({ videos: [] }))
        )
      );

      // Merge and sort by pubdate
      const allVideos: BiliVideo[] = results.flatMap(r => r.videos);
      allVideos.sort((a, b) => (b.pubdate || 0) - (a.pubdate || 0));

      // Take top 50
      setFeedVideos(allVideos.slice(0, 50));
    } catch (error) {
      console.error('Failed to load feed:', error);
      setFeedError('Failed to load feed');
    } finally {
      setLoadingFeed(false);
    }
  }, [subscriptions]);

  useEffect(() => {
    if (viewMode === 'feed') {
      loadFeed();
    }
  }, [viewMode, loadFeed]);

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
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00a1d6"
            strokeWidth="2"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
            Subscriptions
          </h2>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {subscriptions.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {subscriptions.length > 0 && (
            <button
              onClick={onClear}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#ef4444',
                cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          )}
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

      {/* View mode tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <button
          onClick={() => setViewMode('feed')}
          style={{
            flex: 1,
            padding: '12px',
            background: viewMode === 'feed' ? 'rgba(0, 161, 214, 0.1)' : 'transparent',
            border: 'none',
            borderBottom: viewMode === 'feed' ? '2px solid #00a1d6' : '2px solid transparent',
            color: viewMode === 'feed' ? '#00a1d6' : '#888',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Feed
        </button>
        <button
          onClick={() => setViewMode('channels')}
          style={{
            flex: 1,
            padding: '12px',
            background: viewMode === 'channels' ? 'rgba(0, 161, 214, 0.1)' : 'transparent',
            border: 'none',
            borderBottom: viewMode === 'channels' ? '2px solid #00a1d6' : '2px solid transparent',
            color: viewMode === 'channels' ? '#00a1d6' : '#888',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Channels
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {subscriptions.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: '#666',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ marginBottom: '16px', opacity: 0.5 }}
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <p style={{ margin: 0, fontSize: '14px' }}>No subscriptions yet</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#555' }}>
              Subscribe to channels to see their latest videos here
            </p>
          </div>
        ) : viewMode === 'channels' ? (
          // Channels list view
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.mid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  position: 'relative',
                }}
                onClick={() => onChannelSelect(sub)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                {/* Avatar */}
                <img
                  src={proxyImageUrl(sub.face)}
                  alt={sub.name}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#1a1a1a',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sub.name}
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: '#666',
                    }}
                  >
                    Subscribed {formatTimeAgo(sub.subscribedAt / 1000)}
                  </p>
                </div>

                {/* Unsubscribe button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnsubscribe(sub.mid);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  className="unsub-btn"
                >
                  Unsubscribe
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Feed view
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingFeed ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(255, 255, 255, 0.1)',
                    borderTopColor: '#00a1d6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                  Loading feed...
                </p>
              </div>
            ) : feedError ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#ef4444',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px' }}>{feedError}</p>
                <button
                  onClick={loadFeed}
                  style={{
                    marginTop: '12px',
                    background: 'rgba(0, 161, 214, 0.2)',
                    border: '1px solid rgba(0, 161, 214, 0.4)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: '#00a1d6',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            ) : feedVideos.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px' }}>No videos in feed</p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#555' }}>
                  Videos from your subscriptions will appear here
                </p>
              </div>
            ) : (
              feedVideos.map((video) => (
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
                  onClick={() => onVideoSelect(video)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: '120px',
                      height: '68px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative',
                      background: '#1a1a1a',
                    }}
                  >
                    <img
                      src={proxyImageUrl(video.pic)}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* Duration badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontFamily: 'SF Mono, monospace',
                      }}
                    >
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3,
                      }}
                    >
                      {video.titleEn || video.title}
                    </p>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '12px',
                        color: '#888',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {video.owner.name}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '4px',
                        fontSize: '11px',
                        color: '#666',
                      }}
                    >
                      <span>{formatViewCount(video.view)} views</span>
                      <span style={{ color: '#444' }}>•</span>
                      <span>{formatTimeAgo(video.pubdate || 0)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .unsub-btn {
          opacity: 0 !important;
        }
        div:hover > .unsub-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
