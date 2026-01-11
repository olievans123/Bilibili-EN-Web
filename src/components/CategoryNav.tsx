import { useState } from 'react';
import { CATEGORIES } from '../types/bilibili';

interface CategoryNavProps {
  selectedCategory: number;
  onSelectCategory: (tid: number) => void;
}

export function CategoryNav({ selectedCategory, onSelectCategory }: CategoryNavProps) {
  const [expanded, setExpanded] = useState(false);

  // Always show selected category, plus first 10 (or all if expanded)
  const selectedIndex = CATEGORIES.findIndex(c => c.tid === selectedCategory);
  const visibleCats = expanded ? CATEGORIES : CATEGORIES.slice(0, 10);
  const hasMore = CATEGORIES.length > 10;

  // If selected category is beyond visible, include it
  const showSelected = !expanded && selectedIndex >= 10;

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {visibleCats.map((category) => {
        const isSelected = selectedCategory === category.tid;
        return (
          <button
            key={category.tid}
            onClick={() => onSelectCategory(category.tid)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: isSelected
                ? '1px solid rgba(0, 161, 214, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isSelected
                ? 'rgba(0, 161, 214, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              color: isSelected ? '#00a1d6' : '#bbb',
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
            {category.nameEn}
          </button>
        );
      })}
      {showSelected && (
        <button
          key={CATEGORIES[selectedIndex].tid}
          onClick={() => onSelectCategory(CATEGORIES[selectedIndex].tid)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(0, 161, 214, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'rgba(0, 161, 214, 0.15)',
            color: '#00a1d6',
          }}
        >
          {CATEGORIES[selectedIndex].nameEn}
        </button>
      )}
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
