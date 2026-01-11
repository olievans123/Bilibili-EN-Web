import type { BiliVideo } from '../types/bilibili';
import { VideoCard } from './VideoCard';

interface VideoGridProps {
  videos: BiliVideo[];
  loading?: boolean;
  onVideoSelect?: (video: BiliVideo) => void;
  onChannelSelect?: (owner: BiliVideo['owner']) => void;
  onFavorite?: (video: BiliVideo) => void;
  isFavorited?: (bvid: string) => boolean;
  translateTitles?: boolean;
  translateChannelNames?: boolean;
}

export function VideoGrid({ videos, loading, onVideoSelect, onChannelSelect, onFavorite, isFavorited, translateTitles = true, translateChannelNames = true }: VideoGridProps) {
  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <VideoCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  // Let parent component handle empty state
  if (videos.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '20px',
    }}>
      {videos.map((video, index) => (
        <div
          key={video.bvid}
          style={{
            animation: `fadeIn 0.4s ease-out ${index * 0.05}s both`,
          }}
        >
          <VideoCard
            video={video}
            onVideoSelect={onVideoSelect}
            onChannelSelect={onChannelSelect}
            onFavorite={onFavorite}
            isFavorited={isFavorited?.(video.bvid)}
            translateTitle={translateTitles}
            translateChannelName={translateChannelNames}
          />
        </div>
      ))}
    </div>
  );
}

function VideoCardSkeleton({ index }: { index: number }) {
  return (
    <div style={{
      borderRadius: '16px',
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`,
    }}>
      <div style={{
        aspectRatio: '16/9',
        background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
      <div style={{ padding: '14px' }}>
        <div style={{
          height: '14px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          marginBottom: '10px',
        }} />
        <div style={{
          height: '14px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          width: '70%',
          marginBottom: '12px',
        }} />
        <div style={{
          height: '12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '4px',
          width: '50%',
        }} />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
