import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { getLoginQRCode, checkQRCodeStatus, type QRCodeData } from '../services/auth';
import { qrcodegen } from '../utils/qrcodegen';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [qrCode, setQRCode] = useState<QRCodeData | null>(null);
  const [status, setStatus] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [qrModules, setQrModules] = useState<boolean[][] | null>(null);
  const [qrRenderError, setQrRenderError] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);
  const isTauri = typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  const fetchQRCode = useCallback(async () => {
    if (!isTauri) return;
    setError(null);
    setQrModules(null);
    setQrRenderError(null);
    setStatus('Generating QR code...');

    try {
      const data = await getLoginQRCode();
      setQRCode(data);
      setStatus('Scan with Bilibili app');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    }
  }, [isTauri]);

  const pollStatus = useCallback(async () => {
    if (!qrCode) return;

    const result = await checkQRCodeStatus(qrCode.qrcode_key);

    if (result.code === 0) {
      // Login successful
      setStatus('Login successful!');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 1000);
    } else if (result.code === 86038) {
      // QR code expired
      setError('QR code expired');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } else if (result.code === 86090) {
      setStatus('Scanned - confirm on your phone');
    } else if (result.code === 86101) {
      setStatus('Scan with Bilibili app');
    } else if (result.code === -1) {
      setStatus(result.message);
    }
  }, [qrCode, onLoginSuccess, onClose]);

  useEffect(() => {
    if (!qrCode) {
      setQrModules(null);
      setQrRenderError(null);
      return;
    }
    try {
      const qr = qrcodegen.QrCode.encodeText(qrCode.url, qrcodegen.QrCode.Ecc.LOW);
      const modules = Array.from({ length: qr.size }, (_, y) =>
        Array.from({ length: qr.size }, (_, x) => qr.getModule(x, y))
      );
      setQrModules(modules);
      setQrRenderError(null);
    } catch (err) {
      console.error('Failed to generate QR modules:', err);
      setQrModules(null);
      setQrRenderError('Failed to render QR code');
    }
  }, [qrCode]);

  useEffect(() => {
    if (isOpen) {
      if (!isTauri) {
        setQRCode(null);
        setError(null);
        setQrModules(null);
        setQrRenderError(null);
        setStatus('Sign in is available in the desktop app only.');
        setCopySuccess(false);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch data on mount
        fetchQRCode();
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [isOpen, fetchQRCode, isTauri]);

  useEffect(() => {
    if (qrCode && isTauri && !pollIntervalRef.current) {
      pollIntervalRef.current = window.setInterval(pollStatus, 2000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [qrCode, pollStatus, isTauri]);

  useEffect(() => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    if (copySuccess) {
      statusTimeoutRef.current = window.setTimeout(() => {
        setCopySuccess(false);
        statusTimeoutRef.current = null;
      }, 2000);
    }
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [copySuccess]);

  if (!isOpen) return null;

  const quietZone = 4;
  const qrSize = qrModules ? qrModules.length + quietZone * 2 : 0;
  const qrDisplayUrl = qrCode?.url || '';

  const modalStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '420px',
    padding: '28px',
    borderRadius: '20px',
    background: 'linear-gradient(145deg, rgba(24, 28, 36, 0.98), rgba(18, 22, 29, 0.98))',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f5f5f5',
  };

  const primaryButtonStyle: CSSProperties = {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(0, 161, 214, 0.4)',
    background: 'rgba(0, 161, 214, 0.15)',
    color: '#9adffd',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const secondaryButtonStyle: CSSProperties = {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#d5d8dc',
    fontSize: '12px',
    cursor: 'pointer',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at top, rgba(0, 161, 214, 0.2), rgba(0, 0, 0, 0.7))',
          backdropFilter: 'blur(12px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={modalStyle}>
        <div style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: '22px',
          border: '1px solid rgba(0, 161, 214, 0.15)',
          pointerEvents: 'none',
        }} />
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#aab1bc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 16px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #00a1d6 0%, #32d2ff 60%, #fb7299 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(0, 161, 214, 0.35)',
          }}>
            <svg style={{ width: '28px', height: '28px', color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f5f5f5', marginBottom: '6px' }}>Sign in to Bilibili</h2>
          <p style={{ fontSize: '13px', color: '#9aa4b2' }}>
            {isTauri ? 'Scan with the Bilibili mobile app' : 'Access your account'}
          </p>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!isTauri ? (
            <div style={{ width: '100%' }}>
              {/* Browser limitation message */}
              <div style={{
                borderRadius: '16px',
                padding: '18px',
                textAlign: 'center',
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  margin: '0 auto 12px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d0d6df',
                }}>
                  <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#f5f5f5', marginBottom: '6px' }}>
                  Desktop App Required
                </h3>
                <p style={{ fontSize: '12px', color: '#b2bac6', lineHeight: 1.5 }}>
                  Browser security prevents sending login cookies to Bilibili.
                  Download the desktop app for full sign-in support.
                </p>
              </div>

              {/* Benefits of signing in */}
              <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#c1c7d2', textAlign: 'center' }}>With sign-in you can:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#aab1bc' }}>
                  <svg style={{ width: '14px', height: '14px', color: '#00a1d6', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Load all comments</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#aab1bc' }}>
                  <svg style={{ width: '14px', height: '14px', color: '#00a1d6', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Access higher video quality</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#aab1bc' }}>
                  <svg style={{ width: '14px', height: '14px', color: '#00a1d6', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>View member-only content</span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div style={{
              width: '220px',
              minHeight: '220px',
              padding: '20px',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              textAlign: 'center',
            }}>
              <svg style={{ width: '44px', height: '44px', color: '#ef4444', marginBottom: '10px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: '13px', color: '#fecaca', marginBottom: '10px' }}>{error}</p>
              {qrDisplayUrl && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(qrDisplayUrl);
                      setCopySuccess(true);
                    } catch {
                      setCopySuccess(false);
                    }
                  }}
                  style={secondaryButtonStyle}
                >
                  {copySuccess ? 'Link copied' : 'Copy QR link'}
                </button>
              )}
              <button
                onClick={fetchQRCode}
                style={{ ...primaryButtonStyle, marginTop: '12px' }}
              >
                Retry QR
              </button>
            </div>
          ) : qrRenderError ? (
            <div style={{
              width: '220px',
              minHeight: '220px',
              padding: '18px',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '12px', color: '#c1c7d2', marginBottom: '8px' }}>
                {qrRenderError}
              </p>
              <button
                onClick={fetchQRCode}
                style={primaryButtonStyle}
              >
                Retry
              </button>
            </div>
          ) : qrModules ? (
            <div style={{ position: 'relative' }}>
              <svg
                role="img"
                aria-label="Login QR Code"
                viewBox={`0 0 ${qrSize} ${qrSize}`}
                style={{
                  width: '220px',
                  height: '220px',
                  borderRadius: '18px',
                  background: '#fff',
                  padding: '12px',
                }}
                shapeRendering="crispEdges"
              >
                <rect width={qrSize} height={qrSize} fill="#fff" />
                {qrModules.map((row, y) =>
                  row.map((cell, x) =>
                    cell ? (
                      <rect
                        key={`${x}-${y}`}
                        x={x + quietZone}
                        y={y + quietZone}
                        width="1"
                        height="1"
                        fill="#000"
                      />
                    ) : null
                  )
                )}
              </svg>
              {status.includes('confirm') && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '18px',
                  background: 'rgba(16, 185, 129, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    <svg style={{ width: '46px', height: '46px', margin: '0 auto 8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>Scanned!</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              width: '220px',
              height: '220px',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{
                width: '34px',
                height: '34px',
                border: '3px solid rgba(0, 161, 214, 0.35)',
                borderTopColor: '#00a1d6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            </div>
          )}

          {/* Status */}
          <div style={{
            marginTop: '16px',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '12px',
            color: error ? '#fca5a5' : '#b8c0cc',
            textAlign: 'center',
            minWidth: '220px',
          }}>
            {error ? 'Unable to generate QR code. Check your network and retry.' : status}
          </div>
        </div>

        {/* Instructions - only show for desktop app */}
        {isTauri && (
          <div style={{
            marginTop: '18px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gap: '10px',
          }}>
            <p style={{ fontSize: '12px', color: '#9aa4b2', textAlign: 'center' }}>
              Open Bilibili app → Tap profile → Scan icon (top right)
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {qrDisplayUrl && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(qrDisplayUrl);
                      setCopySuccess(true);
                    } catch {
                      setCopySuccess(false);
                    }
                  }}
                  style={secondaryButtonStyle}
                >
                  {copySuccess ? 'Link copied' : 'Copy QR link'}
                </button>
              )}
              <button onClick={fetchQRCode} style={primaryButtonStyle}>
                Refresh QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
