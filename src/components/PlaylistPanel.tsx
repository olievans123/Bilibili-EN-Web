import { useState } from 'react';
import type { Playlist, BiliVideo } from '../types/bilibili';

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (!import.meta.env.DEV) return url.replace(/^http:/, 'https:');
  const httpsUrl = url.replace(/^http:/, 'https:');
  const match = httpsUrl.match(/https?:\/\/[^/]+\.hdslb\.com(\/.*)/);
  return match ? `/img/hdslb${match[1]}` : httpsUrl;
}

export interface PlaylistContext {
  playlistId: string;
  playlistName: string;
  videos: BiliVideo[];
  currentIndex: number;
}

interface PlaylistPanelProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => Promise<Playlist>;
  onDeletePlaylist: (playlistId: string) => Promise<void>;
  onRenamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  onRemoveVideo: (playlistId: string, bvid: string) => Promise<void>;
  onVideoSelect: (video: BiliVideo, context?: PlaylistContext) => void;
  onClose: () => void;
}

export function PlaylistPanel({
  playlists,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onRemoveVideo,
  onVideoSelect,
  onClose,
}: PlaylistPanelProps) {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      await onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
    }
  };

  const handleRename = async (playlistId: string) => {
    if (editName.trim()) {
      await onRenamePlaylist(playlistId, editName.trim());
      setEditingId(null);
      setEditName('');
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
        width: '400px',
        background: '#0d0d0d',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 999,
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedPlaylist && (
            <button
              onClick={() => setSelectedPlaylist(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#fff',
          }}>
            {selectedPlaylist ? selectedPlaylist.name : 'Playlists'}
          </h2>
        </div>
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

      {selectedPlaylist ? (
        // Playlist videos view
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {selectedPlaylist.videos.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m10 9 5 3-5 3V9z" />
              </svg>
              <p style={{ margin: 0, fontSize: '14px' }}>No videos in this playlist</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#555' }}>
                Click "Add to Playlist" when watching a video
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedPlaylist.videos.map((video, index) => (
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
                  onClick={() => onVideoSelect(video, {
                    playlistId: selectedPlaylist.id,
                    playlistName: selectedPlaylist.name,
                    videos: selectedPlaylist.videos,
                    currentIndex: index,
                  })}
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
                    {index + 1}
                  </span>
                  <div style={{
                    width: '85px',
                    height: '48px',
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVideo(selectedPlaylist.id, video.bvid);
                      setSelectedPlaylist({
                        ...selectedPlaylist,
                        videos: selectedPlaylist.videos.filter(v => v.bvid !== video.bvid),
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      padding: '4px',
                      opacity: 0.5,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Playlists list view
        <>
          {/* Create new playlist */}
          <div style={{
            padding: '16px',
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
                placeholder="New playlist name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePlaylist();
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
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                style={{
                  background: newPlaylistName.trim() ? '#00a1d6' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: newPlaylistName.trim() ? '#fff' : '#666',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: newPlaylistName.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                Create
              </button>
            </div>
          </div>

          {/* Playlists */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {playlists.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#666',
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                  <path d="M19 11H5M5 11l7-7m-7 7l7 7" />
                </svg>
                <p style={{ margin: 0, fontSize: '14px' }}>No playlists yet</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#555' }}>
                  Create your first playlist above
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    style={{
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => {
                      if (editingId !== playlist.id) {
                        setSelectedPlaylist(playlist);
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      {editingId === playlist.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(playlist.id);
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditName('');
                            }
                          }}
                          onBlur={() => handleRename(playlist.id)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid #00a1d6',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: 600,
                            outline: 'none',
                            flex: 1,
                          }}
                        />
                      ) : (
                        <h3 style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#fff',
                        }}>
                          {playlist.name}
                        </h3>
                      )}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(playlist.id);
                            setEditName(playlist.name);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${playlist.name}"?`)) {
                              onDeletePlaylist(playlist.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p style={{
                      margin: '6px 0 0 0',
                      fontSize: '13px',
                      color: '#666',
                    }}>
                      {playlist.videos.length} video{playlist.videos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
