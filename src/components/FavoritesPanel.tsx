import type { BiliVideo } from '../types/bilibili';
import type { FavoriteItem } from '../services/favorites';
import { formatDuration, formatViewCount } from '../services/bilibili';

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) return url.replace(/^http:/, 'https:');
  const match = url.match(/https?:\/\/[^/]+\.hdslb\.com(\/.*)/);
  return match ? `/img/hdslb${match[1]}` : url.replace(/^http:/, 'https:');
}

function formatFavoritedTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  onVideoSelect: (video: BiliVideo) => void;
  onRemove: (bvid: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function FavoritesPanel({
  favorites,
  onVideoSelect,
  onRemove,
  onClear,
  onClose,
}: FavoritesPanelProps) {
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
            fill="#fb7299"
            stroke="#fb7299"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
            Favorites
          </h2>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {favorites.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {favorites.length > 0 && (
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

      {/* Favorites List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {favorites.length === 0 ? (
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
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p style={{ margin: 0, fontSize: '14px' }}>No favorites yet</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#555' }}>
              Click the heart icon on videos to save them here
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {favorites.map((item) => (
              <div
                key={item.video.bvid}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  position: 'relative',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onVideoSelect(item.video);
                }}
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
                    src={proxyImageUrl(item.video.pic)}
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
                    {formatDuration(item.video.duration)}
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
                    {item.video.titleEn || item.video.title}
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
                    {item.video.owner.name}
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
                    <span>{formatViewCount(item.video.view)} views</span>
                    <span style={{ color: '#444' }}>•</span>
                    <span>{formatFavoritedTime(item.favoritedAt)}</span>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.video.bvid);
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#888',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                  className="remove-btn"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .remove-btn {
          opacity: 0 !important;
        }
        div:hover > .remove-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
