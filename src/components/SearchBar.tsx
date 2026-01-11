import { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search in English or Chinese...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  }, [query, onSearch]);

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', position: 'relative' }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={focused ? '#00a1d6' : '#666'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'stroke 0.2s' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '12px 100px 12px 48px',
            background: focused ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: focused ? '1px solid #00a1d6' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            color: '#fff',
            fontSize: '15px',
            outline: 'none',
            transition: 'all 0.2s',
          }}
        />
        <button
          type="submit"
          style={{
            position: 'absolute',
            right: '6px',
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #00a1d6 0%, #00b5e5 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '18px',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Search
        </button>
      </div>
    </form>
  );
}
