import { useState } from 'react';
import type { Playlist, BiliVideo } from '../types/bilibili';

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) return url.replace(/^http:/, 'https:');
  const httpsUrl = url.replace(/^http:/, 'https:');
  const match = httpsUrl.match(/https?:\/\/[^/]+\.hdslb\.com(\/.*)/);
  return match ? `/img/hdslb${match[1]}` : httpsUrl;
}

interface AddToPlaylistModalProps {
  video: BiliVideo;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, video: BiliVideo) => Promise<boolean>;
  onCreatePlaylist: (name: string) => Promise<Playlist>;
  onClose: () => void;
}

export function AddToPlaylistModal({
  video,
  playlists,
  onAddToPlaylist,
  onCreatePlaylist,
  onClose,
}: AddToPlaylistModalProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());

  const handleAddToPlaylist = async (playlistId: string) => {
    const added = await onAddToPlaylist(playlistId, video);
    if (added) {
      setAddedTo(prev => new Set([...prev, playlistId]));
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    const newPlaylist = await onCreatePlaylist(newPlaylistName.trim());
    await onAddToPlaylist(newPlaylist.id, video);
    setAddedTo(prev => new Set([...prev, newPlaylist.id]));
    setNewPlaylistName('');
    setCreating(false);
  };

  const alreadyInPlaylist = (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return playlist?.videos.some(v => v.bvid === video.bvid) || false;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        background: '#141414',
        borderRadius: '16px',
        width: '380px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#fff',
          }}>
            Add to Playlist
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video preview */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{
            width: '80px',
            height: '45px',
            borderRadius: '6px',
            background: '#1a1a1a',
            overflow: 'hidden',
            flexShrink: 0,
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
              {video.titleEn || video.title}
            </p>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#666',
            }}>
              {video.owner.name}
            </p>
          </div>
        </div>

        {/* Create new playlist */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
          }}>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Create new playlist..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAndAdd();
              }}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreateAndAdd}
              disabled={!newPlaylistName.trim() || creating}
              style={{
                background: newPlaylistName.trim() ? '#00a1d6' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                color: newPlaylistName.trim() ? '#fff' : '#666',
                fontSize: '14px',
                cursor: newPlaylistName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {creating ? '...' : '+'}
            </button>
          </div>
        </div>

        {/* Playlists list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 20px',
        }}>
          {playlists.length === 0 ? (
            <p style={{
              textAlign: 'center',
              color: '#666',
              fontSize: '14px',
              padding: '20px 0',
            }}>
              No playlists yet. Create one above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {playlists.map(playlist => {
                const isInPlaylist = alreadyInPlaylist(playlist.id) || addedTo.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => !isInPlaylist && handleAddToPlaylist(playlist.id)}
                    disabled={isInPlaylist}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: isInPlaylist ? 'rgba(0, 161, 214, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: isInPlaylist ? '1px solid rgba(0, 161, 214, 0.3)' : '1px solid transparent',
                      borderRadius: '10px',
                      cursor: isInPlaylist ? 'default' : 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div>
                      <span style={{
                        fontSize: '14px',
                        color: '#fff',
                        fontWeight: 500,
                      }}>
                        {playlist.name}
                      </span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        color: '#666',
                      }}>
                        {playlist.videos.length} videos
                      </span>
                    </div>
                    {isInPlaylist ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00a1d6" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Done button */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
