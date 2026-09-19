import React from 'react';
import { useStore } from '../store/StoreContext.jsx';

/**
 * Reusable checklist block.
 * type: 'must' | 'optional'
 * items: pre-filtered checklist items for today
 */
export default function ChecklistBlock({ type, items, title, emptyText }) {
  const { dispatch } = useStore();

  return (
    <div>
      {title && (
        <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
          <span className="card-title">{title}</span>
          <span className="badge badge-muted">{items.filter(i => i.done).length}/{items.length}</span>
        </div>
      )}

      <div className="checklist">
        {items.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: 'var(--space-2) 0' }}>
            {emptyText || 'Nothing here — add items from the Calendar page'}
          </p>
        )}
        {items.map(item => (
          <div key={item.id} className={`check-item${item.done ? ' done' : ''}`}>
            <button
              className={`check-box${item.done ? ' checked' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', id: item.id })}
              aria-label={item.done ? 'Uncheck' : 'Check'}
            >
              {item.done ? '✓' : ''}
            </button>
            <span className="check-label" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <span>{item.text}</span>
              {item.time && (
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                  ⏰ {item.time}
                </span>
              )}
            </span>
            <button
              className="check-delete"
              onClick={() => dispatch({ type: 'DELETE_CHECKLIST_ITEM', id: item.id })}
              aria-label="Delete item"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
