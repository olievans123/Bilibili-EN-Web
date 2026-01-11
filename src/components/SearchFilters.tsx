import type { SearchFilters } from '../services/bilibili';

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

const ORDER_OPTIONS = [
  { value: 'totalrank', label: 'Relevance' },
  { value: 'click', label: 'Most Views' },
  { value: 'pubdate', label: 'Latest' },
  { value: 'dm', label: 'Most Danmaku' },
  { value: 'stow', label: 'Most Favorites' },
];

const DURATION_OPTIONS = [
  { value: 0, label: 'Any Duration' },
  { value: 1, label: 'Under 10 min' },
  { value: 2, label: '10-30 min' },
  { value: 3, label: '30-60 min' },
  { value: 4, label: 'Over 60 min' },
];

export function SearchFiltersBar({ filters, onChange }: SearchFiltersProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 0',
        flexWrap: 'wrap',
      }}
    >
      {/* Sort Order */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: '#888' }}>Sort:</span>
        <select
          value={filters.order || 'totalrank'}
          onChange={(e) => onChange({ ...filters, order: e.target.value as SearchFilters['order'] })}
          style={{
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {ORDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: '#888' }}>Duration:</span>
        <select
          value={filters.duration || 0}
          onChange={(e) => onChange({ ...filters, duration: Number(e.target.value) as SearchFilters['duration'] })}
          style={{
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(filters.order !== 'totalrank' || (filters.duration !== undefined && filters.duration !== 0)) && (
        <button
          onClick={() => onChange({ order: 'totalrank', duration: 0 })}
          style={{
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#888',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
