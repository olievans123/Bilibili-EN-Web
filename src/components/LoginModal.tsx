import type { CSSProperties } from 'react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  if (!isOpen) return null;

  const modalStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '360px',
    padding: '32px',
    borderRadius: '20px',
    background: 'linear-gradient(145deg, rgba(24, 28, 36, 0.98), rgba(18, 22, 29, 0.98))',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f5f5f5',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={modalStyle}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          margin: '0 auto 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #00a1d6, #fb7299)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '18px', fontWeight: 600, textAlign: 'center', marginBottom: '8px' }}>
          Sign in with Desktop App
        </h2>
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', marginBottom: '24px' }}>
          Browser security prevents web sign-in to Bilibili
        </p>

        {/* Benefits */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>With sign-in you get:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['All comments', 'Higher quality video', 'Member-only content'].map((benefit) => (
              <div key={benefit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00a1d6" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span style={{ fontSize: '13px', color: '#aaa' }}>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Download button */}
        <a
          href="https://github.com/olievans123/Bilibili-EN/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00a1d6, #00b5e2)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download Desktop App
        </a>
      </div>
    </div>
  );
}
