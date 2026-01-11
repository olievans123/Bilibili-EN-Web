import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { VideoGrid } from './components/VideoGrid';
import { VideoPlayer } from './components/VideoPlayer';
import { ChannelPanel } from './components/ChannelPanel';
import { PlaylistPanel, type PlaylistContext } from './components/PlaylistPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { FavoritesPanel } from './components/FavoritesPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SubscriptionsPanel } from './components/SubscriptionsPanel';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { useAuth } from './hooks/useAuth';
import { usePlaylist } from './hooks/usePlaylist';
import { useHistory } from './hooks/useHistory';
import { useFavorites } from './hooks/useFavorites';
import { useSettings } from './hooks/useSettings';
import { useSubscriptions } from './hooks/useSubscriptions';
import { getTrending, searchVideos, getVideosByCategory, type SearchFilters } from './services/bilibili';
import { SearchFiltersBar } from './components/SearchFilters';
import type { BiliVideo } from './types/bilibili';
import { CATEGORIES } from './types/bilibili';

type ViewMode = 'home' | 'search' | 'category';
const FEED_PAGE_SIZE = 20;

// Loading skeleton component
function LoadingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '20px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.03)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.05}s`,
          }}
        >
          <div style={{
            aspectRatio: '16/9',
            background: 'rgba(255, 255, 255, 0.05)',
          }} />
          <div style={{ padding: '14px' }}>
            <div style={{
              height: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
              marginBottom: '8px',
            }} />
            <div style={{
              height: '14px',
              width: '60%',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Page header component for consistent styling
function PageHeader({
  title,
  subtitle,
  showBack,
  onBack
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {showBack && onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            cursor: 'pointer',
            color: '#888',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#888';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div>
        <h1 style={{
          margin: 0,
          fontSize: showBack ? '24px' : '28px',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            color: '#666',
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// Quick category pills for home view
function QuickCategories({ selected, onSelect }: { selected: number; onSelect: (tid: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCats = expanded ? CATEGORIES : CATEGORIES.slice(0, 10);
  const hasMore = CATEGORIES.length > 10;

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {visibleCats.map(cat => {
        const isSelected = selected === cat.tid;
        return (
          <button
            key={cat.tid}
            onClick={() => onSelect(cat.tid)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              border: isSelected
                ? '1px solid rgba(0, 161, 214, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              background: isSelected
                ? 'rgba(0, 161, 214, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              color: isSelected ? '#00a1d6' : '#bbb',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'rgba(0, 161, 214, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(0, 161, 214, 0.3)';
                e.currentTarget.style.color = '#00a1d6';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#bbb';
              }
            }}
          >
            {cat.nameEn}
          </button>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'transparent',
            color: '#888',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = '#bbb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#888';
          }}
        >
          {expanded ? 'Show less' : `+${CATEGORIES.length - 10} more`}
        </button>
      )}
    </div>
  );
}

function App() {
  const { user, logout, refreshAuth, isLoggedIn } = useAuth();
  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
  } = usePlaylist();
  const {
    history,
    addToHistory,
    updateProgress,
    removeFromHistory,
    clearHistory,
  } = useHistory();
  const {
    favorites,
    toggleFavorite,
    isFavorited,
    removeFromFavorites,
    clearFavorites,
  } = useFavorites();
  const {
    settings,
    updateSetting,
    resetSettings,
  } = useSettings();
  const {
    subscriptions,
    toggleSubscription,
    isSubscribed,
    unsubscribe,
    clearSubscriptions,
  } = useSubscriptions();
  const [videos, setVideos] = useState<BiliVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ order: 'totalrank', duration: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<BiliVideo | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<BiliVideo['owner'] | null>(null);
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSubscriptionsPanel, setShowSubscriptionsPanel] = useState(false);
  const [videoToAdd, setVideoToAdd] = useState<BiliVideo | null>(null);
  const [playlistContext, setPlaylistContext] = useState<PlaylistContext | null>(null);
  const feedKeyRef = useRef('home');
  const pendingCountRef = useRef(0);
  const [initialLoad, setInitialLoad] = useState(true);
  const isTauri = typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const hasApiProxy = Boolean(import.meta.env.DEV || import.meta.env.VITE_BILI_PROXY_BASE);
  const showProxyNotice = !isTauri && !hasApiProxy;

  const beginLoad = useCallback((feedKey: string, reset: boolean) => {
    if (reset || feedKeyRef.current !== feedKey) {
      feedKeyRef.current = feedKey;
      pendingCountRef.current = 0;
      if (reset) {
        setVideos([]);
      }
      setHasMore(true);
    }
    pendingCountRef.current += 1;
    setLoading(true);
  }, []);

  const endLoad = useCallback((feedKey: string) => {
    if (feedKeyRef.current !== feedKey) {
      return;
    }
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    if (pendingCountRef.current === 0) {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  const resolveHasMore = useCallback((pageNum: number, result: { videos: BiliVideo[]; pageSize?: number; total?: number; hasMore?: boolean }) => {
    if (typeof result.hasMore === 'boolean') {
      return result.hasMore;
    }
    const pageSize = result.pageSize ?? FEED_PAGE_SIZE;
    if (typeof result.total === 'number' && result.total > 0) {
      return pageNum * pageSize < result.total;
    }
    return result.videos.length === pageSize;
  }, []);

  const loadTrending = useCallback(async (pageNum: number = 1) => {
    const feedKey = 'home';
    beginLoad(feedKey, pageNum === 1);
    setError(null);
    try {
      const result = await getTrending(pageNum);
      if (feedKeyRef.current !== feedKey) return;
      if (result.error) {
        setError(result.error);
      }
      if (pageNum === 1) {
        setVideos(result.videos);
      } else {
        setVideos(prev => [...prev, ...result.videos]);
      }
      setHasMore(resolveHasMore(pageNum, result));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to load trending:', errorMsg);
      if (feedKeyRef.current === feedKey) {
        setError(errorMsg);
      }
    } finally {
      endLoad(feedKey);
    }
  }, [beginLoad, endLoad, resolveHasMore]);

  const loadCategory = useCallback(async (tid: number, pageNum: number = 1) => {
    const feedKey = `category:${tid}`;
    beginLoad(feedKey, pageNum === 1);
    setError(null);
    try {
      const result = await getVideosByCategory(tid, pageNum);
      if (feedKeyRef.current !== feedKey) return;
      if (pageNum === 1) {
        setVideos(result.videos);
      } else {
        setVideos(prev => [...prev, ...result.videos]);
      }
      setHasMore(resolveHasMore(pageNum, result));
    } catch (error) {
      console.error('Failed to load category:', error);
      if (feedKeyRef.current === feedKey) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
      }
    } finally {
      endLoad(feedKey);
    }
  }, [beginLoad, endLoad, resolveHasMore]);

  const loadSearch = useCallback(async (query: string, pageNum: number = 1, filters?: SearchFilters) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const filterKey = filters ? `${filters.order || ''}:${filters.duration || 0}` : '';
    const feedKey = `search:${trimmed}:${filterKey}`;
    beginLoad(feedKey, pageNum === 1);
    setError(null);
    try {
      const result = await searchVideos(trimmed, pageNum, true, filters);
      if (feedKeyRef.current !== feedKey) return;
      if (pageNum === 1) {
        setVideos(result.videos);
      } else {
        // Deduplicate by bvid
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.bvid));
          const newVideos = result.videos.filter(v => !existing.has(v.bvid));
          return [...prev, ...newVideos];
        });
      }
      setHasMore(resolveHasMore(pageNum, result));
    } catch (error) {
      console.error('Failed to search:', error);
      if (feedKeyRef.current === feedKey) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
      }
    } finally {
      endLoad(feedKey);
    }
  }, [beginLoad, endLoad, resolveHasMore]);

  const handleSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    setViewMode('search');
    setPage(1);
    setSearchFilters({ order: 'totalrank', duration: 0 }); // Reset filters on new search
    loadSearch(trimmed, 1, { order: 'totalrank', duration: 0 });
  }, [loadSearch]);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setSearchFilters(newFilters);
    setPage(1);
    loadSearch(searchQuery, 1, newFilters);
  }, [loadSearch, searchQuery]);

  const handleCategorySelect = useCallback((tid: number) => {
    setSelectedCategory(tid);
    setPage(1);
    if (tid === 0) {
      setViewMode('home');
      loadTrending(1);
    } else {
      setViewMode('category');
      loadCategory(tid, 1);
    }
  }, [loadTrending, loadCategory]);

  const handleLogoClick = useCallback(() => {
    setViewMode('home');
    setSelectedCategory(0);
    setSearchQuery('');
    setPage(1);
    loadTrending(1);
  }, [loadTrending]);

  // Initial load
  useEffect(() => {
    loadTrending(1);
  }, [loadTrending]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (pendingCountRef.current > 0 || !hasMore) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollTop + clientHeight >= scrollHeight - 500) {
        const nextPage = page + 1;
        setPage(nextPage);

        if (viewMode === 'home') {
          loadTrending(nextPage);
        } else if (viewMode === 'category') {
          loadCategory(selectedCategory, nextPage);
        } else if (viewMode === 'search' && searchQuery) {
          loadSearch(searchQuery, nextPage, searchFilters);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, viewMode, selectedCategory, searchQuery, searchFilters, hasMore, loadTrending, loadCategory, loadSearch]);

  const getCategoryName = () => {
    const cat = CATEGORIES.find(c => c.tid === selectedCategory);
    return cat?.nameEn || 'Videos';
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header
        user={user}
        onSearch={handleSearch}
        onLogout={logout}
        onLoginSuccess={refreshAuth}
        onLogoClick={handleLogoClick}
      />

      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
      }}>
        {/* Page header - consistent across all views */}
        <div style={{ marginBottom: '24px' }} key={viewMode}>
          {viewMode === 'search' ? (
            <>
              <PageHeader
                title={`Results for "${searchQuery}"`}
                showBack
                onBack={handleLogoClick}
              />
              <SearchFiltersBar filters={searchFilters} onChange={handleFiltersChange} />
            </>
          ) : viewMode === 'category' ? (
            <>
              <PageHeader
                title={getCategoryName()}
                showBack
                onBack={handleLogoClick}
              />
              <CategoryNav
                selectedCategory={selectedCategory}
                onSelectCategory={handleCategorySelect}
              />
            </>
          ) : (
            <>
              <PageHeader title="Trending Now" />
              <QuickCategories selected={selectedCategory} onSelect={handleCategorySelect} />
            </>
          )}
        </div>

        {showProxyNotice && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#f59e0b',
            fontSize: '13px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>This web build needs a proxy to reach Bilibili APIs. Run in Tauri or configure a proxy.</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span style={{ color: '#ef4444', fontSize: '14px', flex: 1 }}>{error}</span>
            <button
              onClick={() => {
                if (viewMode === 'home') loadTrending(1);
                else if (viewMode === 'category') loadCategory(selectedCategory, 1);
                else if (viewMode === 'search') loadSearch(searchQuery, 1);
              }}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ animation: 'fadeIn 0.3s ease-out' }} key={`${viewMode}-${selectedCategory}-content`}>
          {initialLoad && loading ? (
            <LoadingSkeleton count={8} />
          ) : videos.length === 0 && loading ? (
            <LoadingSkeleton count={8} />
          ) : (
            <VideoGrid
              videos={videos}
              loading={false}
              onVideoSelect={setSelectedVideo}
              onChannelSelect={setSelectedChannel}
              onFavorite={toggleFavorite}
              isFavorited={isFavorited}
              translateTitles={settings.translateTitles}
              translateChannelNames={settings.translateChannelNames}
            />
          )}
        </div>

        {/* Loading more indicator */}
        {loading && videos.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '40px',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#00a1d6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ color: '#666', fontSize: '14px' }}>Loading more...</span>
          </div>
        )}

        {!loading && videos.length > 0 && !hasMore && (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: '#555',
            fontSize: '13px',
          }}>
            You have reached the end of the results.
          </div>
        )}

        {/* Empty state */}
        {!loading && videos.length === 0 && !error && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: '#666',
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No videos found</p>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>Try a different search or category</p>
            {isTauri && (
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={async () => {
                    setDebugResult('Testing...');
                    try {
                      // Run test fetch and show result
                      const testFn = (window as unknown as Record<string, () => Promise<unknown>>).testFetch;
                      if (testFn) {
                        const result = await testFn();
                        setDebugResult(JSON.stringify(result, null, 2));
                      } else {
                        setDebugResult('Error: testFetch function not found');
                      }
                    } catch (err) {
                      setDebugResult('Error: ' + (err instanceof Error ? err.message : String(err)));
                    }
                  }}
                  style={{
                    background: '#333',
                    color: '#888',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Test API Connection
                </button>
                {debugResult && (
                  <pre style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#0f0',
                    textAlign: 'left',
                    maxWidth: '500px',
                    margin: '16px auto 0',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {debugResult}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '40px 24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: '40px',
      }}>
        <p style={{ fontSize: '14px', color: '#555' }}>
          Bilibili EN - Browse Bilibili in English
        </p>
        <p style={{ fontSize: '12px', color: '#444', marginTop: '8px' }}>
          Not affiliated with Bilibili. For educational purposes only.
        </p>
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => {
            setSelectedVideo(null);
            setPlaylistContext(null);
          }}
          onAddToPlaylist={(video) => {
            setVideoToAdd(video);
          }}
          onChannelSelect={setSelectedChannel}
          onWatched={addToHistory}
          onProgress={(video, progress) => updateProgress(video.bvid, progress)}
          onFavorite={toggleFavorite}
          isFavorited={isFavorited(selectedVideo.bvid)}
          isLoggedIn={isLoggedIn}
          onVideoChange={(video) => {
            setSelectedVideo(video);
            // Clear playlist context when switching via related videos
            if (!playlistContext || !playlistContext.videos.some(v => v.bvid === video.bvid)) {
              setPlaylistContext(null);
            }
          }}
          playlistContext={playlistContext}
          onPlayNext={() => {
            if (playlistContext && playlistContext.currentIndex < playlistContext.videos.length - 1) {
              const nextIndex = playlistContext.currentIndex + 1;
              const nextVideo = playlistContext.videos[nextIndex];
              setSelectedVideo(nextVideo);
              setPlaylistContext({
                ...playlistContext,
                currentIndex: nextIndex,
              });
            }
          }}
          translateTitles={settings.translateTitles}
          translateDescriptions={settings.translateDescriptions}
          translateComments={settings.translateComments}
          translateChannelNames={settings.translateChannelNames}
          translateSubtitles={settings.translateSubtitles}
        />
      )}

      {/* History Panel */}
      {showHistoryPanel && (
        <HistoryPanel
          history={history}
          onVideoSelect={(video) => {
            setSelectedVideo(video);
            setShowHistoryPanel(false);
          }}
          onRemove={removeFromHistory}
          onClear={clearHistory}
          onClose={() => setShowHistoryPanel(false)}
        />
      )}

      {/* Favorites Panel */}
      {showFavoritesPanel && (
        <FavoritesPanel
          favorites={favorites}
          onVideoSelect={(video) => {
            setSelectedVideo(video);
            setShowFavoritesPanel(false);
          }}
          onRemove={removeFromFavorites}
          onClear={clearFavorites}
          onClose={() => setShowFavoritesPanel(false)}
        />
      )}

      {/* Settings Panel */}
      {showSettingsPanel && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSetting}
          onReset={resetSettings}
          onClose={() => setShowSettingsPanel(false)}
        />
      )}

      {/* Subscriptions Panel */}
      {showSubscriptionsPanel && (
        <SubscriptionsPanel
          subscriptions={subscriptions}
          onVideoSelect={(video) => {
            setSelectedVideo(video);
            setShowSubscriptionsPanel(false);
          }}
          onChannelSelect={(channel) => {
            setSelectedChannel(channel);
            setShowSubscriptionsPanel(false);
          }}
          onUnsubscribe={unsubscribe}
          onClear={clearSubscriptions}
          onClose={() => setShowSubscriptionsPanel(false)}
        />
      )}

      {/* Playlist Panel */}
      {showPlaylistPanel && (
        <PlaylistPanel
          playlists={playlists}
          onCreatePlaylist={createPlaylist}
          onDeletePlaylist={deletePlaylist}
          onRenamePlaylist={renamePlaylist}
          onRemoveVideo={removeVideoFromPlaylist}
          onVideoSelect={(video, context) => {
            setSelectedVideo(video);
            setPlaylistContext(context || null);
            setShowPlaylistPanel(false);
          }}
          onClose={() => setShowPlaylistPanel(false)}
        />
      )}

      {/* Channel Panel */}
      {selectedChannel && (
        <ChannelPanel
          owner={selectedChannel}
          onClose={() => setSelectedChannel(null)}
          onVideoSelect={(video) => {
            setSelectedVideo(video);
            setSelectedChannel(null);
          }}
          isSubscribed={isSubscribed(selectedChannel.mid)}
          onToggleSubscription={() => toggleSubscription(selectedChannel)}
          translateTitles={settings.translateTitles}
          translateChannelNames={settings.translateChannelNames}
        />
      )}

      {/* Add to Playlist Modal */}
      {videoToAdd && (
        <AddToPlaylistModal
          video={videoToAdd}
          playlists={playlists}
          onAddToPlaylist={addVideoToPlaylist}
          onCreatePlaylist={createPlaylist}
          onClose={() => setVideoToAdd(null)}
        />
      )}

      {/* FAB Buttons */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 100,
      }}>
        {/* Settings FAB */}
        <button
          onClick={() => setShowSettingsPanel(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#888';
          }}
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* History FAB */}
        <button
          onClick={() => setShowHistoryPanel(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#888';
          }}
          title="Watch History"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        {/* Favorites FAB */}
        <button
          onClick={() => setShowFavoritesPanel(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(251, 114, 153, 0.1)',
            border: '1px solid rgba(251, 114, 153, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fb7299',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(251, 114, 153, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(251, 114, 153, 0.1)';
          }}
          title="Favorites"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {favorites.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#fb7299',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}>
              {favorites.length > 99 ? '99+' : favorites.length}
            </span>
          )}
        </button>

        {/* Subscriptions FAB */}
        <button
          onClick={() => setShowSubscriptionsPanel(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(0, 161, 214, 0.1)',
            border: '1px solid rgba(0, 161, 214, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00a1d6',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 161, 214, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 161, 214, 0.1)';
          }}
          title="Subscriptions"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          {subscriptions.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#00a1d6',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}>
              {subscriptions.length > 99 ? '99+' : subscriptions.length}
            </span>
          )}
        </button>

        {/* Playlist FAB */}
        <button
          onClick={() => setShowPlaylistPanel(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00a1d6 0%, #0088b3 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(0, 161, 214, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 161, 214, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 161, 214, 0.4)';
          }}
          title="Playlists"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          {playlists.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {playlists.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default App;
