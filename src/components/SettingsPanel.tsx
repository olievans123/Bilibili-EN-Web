import type { AppSettings } from '../services/settings';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onReset: () => void;
  onClose: () => void;
}

const QUALITY_OPTIONS = [
  { value: 80, label: '1080p' },
  { value: 64, label: '720p' },
  { value: 32, label: '480p' },
  { value: 16, label: '360p' },
];

export function SettingsPanel({
  settings,
  onUpdate,
  onReset,
  onClose,
}: SettingsPanelProps) {
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
            Settings
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

      {/* Settings Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Playback Section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Playback
          </h3>

          {/* Default Quality */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#fff',
            }}>
              Default Quality
            </label>
            <select
              value={settings.defaultQuality}
              onChange={(e) => onUpdate('defaultQuality', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#666' }}>
              Preferred quality when starting playback
            </p>
          </div>

          {/* Autoplay */}
          <ToggleSetting
            label="Autoplay"
            description="Automatically play videos when opened"
            value={settings.autoplay}
            onChange={(v) => onUpdate('autoplay', v)}
          />
        </div>

        {/* Translation Section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Translation
          </h3>

          <ToggleSetting
            label="Video Titles"
            description="Translate video titles to English"
            value={settings.translateTitles}
            onChange={(v) => onUpdate('translateTitles', v)}
          />

          <ToggleSetting
            label="Descriptions"
            description="Translate video descriptions to English"
            value={settings.translateDescriptions}
            onChange={(v) => onUpdate('translateDescriptions', v)}
          />

          <ToggleSetting
            label="Comments"
            description="Translate comments to English"
            value={settings.translateComments}
            onChange={(v) => onUpdate('translateComments', v)}
          />

          <ToggleSetting
            label="Channel Names"
            description="Translate channel/uploader names to English"
            value={settings.translateChannelNames}
            onChange={(v) => onUpdate('translateChannelNames', v)}
          />

          <ToggleSetting
            label="Subtitles"
            description="Translate subtitles to English"
            value={settings.translateSubtitles}
            onChange={(v) => onUpdate('translateSubtitles', v)}
          />
        </div>

        {/* About Section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            About
          </h3>
          <div style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#fff' }}>
              Bilibili EN
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
              Browse Bilibili with English translations
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <button
          onClick={onReset}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, description, value, onChange }: ToggleSettingProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#fff' }}>{label}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: value ? '#00a1d6' : 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
          marginLeft: '12px',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: '2px',
            left: value ? '22px' : '2px',
            transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      </button>
    </div>
  );
}
