import { useState } from 'react';
import { SearchBar } from './SearchBar';
import type { BiliUser } from '../types/bilibili';

interface HeaderProps {
  user: BiliUser | null;
  onSearch: (query: string) => void;
  onLogout: () => void;
  onLoginSuccess: () => void;
  onLogoClick?: () => void;
}

export function Header({ user, onSearch, onLogout, onLogoClick }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 15, 15, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          gap: '24px',
        }}>
          {/* Logo */}
          <button
            onClick={onLogoClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0',
              flexShrink: 0,
              background: 'none',
              border: 'none',
              cursor: onLogoClick ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00a1d6 0%, #fb7299 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}>
              Bilibili EN
            </span>
          </button>

          {/* Search */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: '600px' }}>
            <SearchBar onSearch={onSearch} />
          </div>

          {/* User section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={user.face}
                    alt={user.name}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: '2px solid #00a1d6',
                    }}
                  />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      marginTop: '8px',
                      width: '200px',
                      background: '#1f1f1f',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      }}>
                        <p style={{ fontWeight: 600, color: '#fff' }}>{user.name}</p>
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                          Level {user.level}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: '#ef4444',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href="https://github.com/olievans123/Bilibili-EN/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#22c55e',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
                title="Download desktop app for more features"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Get Desktop App
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
