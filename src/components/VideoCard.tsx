import { useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import type { BiliVideo } from '../types/bilibili';
import { formatDuration, formatViewCount, getVideoUrl } from '../services/bilibili';

interface VideoCardProps {
  video: BiliVideo;
  onVideoSelect?: (video: BiliVideo) => void;
  onChannelSelect?: (owner: BiliVideo['owner']) => void;
  onFavorite?: (video: BiliVideo) => void;
  isFavorited?: boolean;
  translateTitle?: boolean;
  translateChannelName?: boolean;
}

// Convert Bilibili image URLs to use local proxy in dev mode
function proxyImageUrl(url: string): string {
  if (!url) return '';

  // In production, just convert http to https
  if (!import.meta.env.DEV) {
    return url.replace(/^http:/, 'https:');
  }

  // In dev mode, proxy through Vite
  const httpsUrl = url.replace(/^http:/, 'https:');

  // Match any hdslb.com subdomain and proxy through our catch-all
  const hdslbMatch = httpsUrl.match(/https?:\/\/([^/]+\.hdslb\.com)(\/.*)/);
  if (hdslbMatch) {
    const path = hdslbMatch[2];
    return `/img/hdslb${path}`;
  }

  // For other URLs, try direct https
  return httpsUrl;
}

export function VideoCard({ video, onVideoSelect, onChannelSelect, onFavorite, isFavorited, translateTitle = true, translateChannelName = true }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleClick = async () => {
    if (onVideoSelect) {
      onVideoSelect(video);
    } else {
      try {
        await open(getVideoUrl(video.bvid));
      } catch {
        // Fallback to window.open if shell fails
        window.open(getVideoUrl(video.bvid), '_blank');
      }
    }
  };

  const timeAgo = getTimeAgo(video.pubdate);

  // Determine displayed title and channel name based on translation settings
  const displayTitle = translateTitle && video.titleEn ? video.titleEn : video.title;
  const displayChannelName = translateChannelName && video.owner.nameEn ? video.owner.nameEn : video.owner.name;

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
          : '0 4px 12px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        aspectRatio: '16/9',
        overflow: 'hidden',
        background: '#1a1a1a',
      }}>
        {!imgError ? (
          <img
            src={proxyImageUrl(video.pic)}
            alt={video.titleEn || video.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease',
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
            }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: '#00a1d6',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
            </svg>
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
        }} />
        {/* Duration badge */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.85)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '6px',
          fontFamily: 'SF Mono, monospace',
        }}>
          {formatDuration(video.duration)}
        </div>
        {/* Favorite button */}
        {onFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(video);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.6)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: isHovered || isFavorited ? 1 : 0,
              transition: 'opacity 0.2s, transform 0.2s',
              transform: isFavorited ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isFavorited ? '#fb7299' : 'none'}
              stroke={isFavorited ? '#fb7299' : '#fff'}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '130px', // Minimum height, allows growth for dual titles
      }}>
        {/* Title */}
        <h3 style={{
          fontWeight: 600,
          color: '#fff',
          fontSize: '14px',
          lineHeight: 1.5,
          marginBottom: '6px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          transition: 'color 0.2s',
          minHeight: '42px', // Min height for 2 lines (14px * 1.5 * 2)
          ...(isHovered ? { color: '#00a1d6' } : {}),
        }}>
          {displayTitle}
        </h3>

        {/* Channel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            cursor: onChannelSelect ? 'pointer' : 'default',
          }}
          onClick={(event) => {
            if (!onChannelSelect) return;
            event.stopPropagation();
            onChannelSelect(video.owner);
          }}
        >
          {video.owner.face && (
            <img
              src={proxyImageUrl(video.owner.face)}
              alt={video.owner.name}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <span style={{
            fontSize: '13px',
            color: '#888',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayChannelName}
          </span>
        </div>

        {/* Stats - pushed to bottom */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: '#666',
          marginTop: 'auto',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {formatViewCount(video.view)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {formatViewCount(video.danmaku)}
          </span>
          <span style={{ color: '#555' }}>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}
