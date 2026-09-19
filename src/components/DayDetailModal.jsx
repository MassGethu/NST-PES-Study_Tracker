import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { fmtDate } from '../store/utils.js';

export default function DayDetailModal({ date, onClose }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [type, setType] = useState('must');
  const [time, setTime] = useState('');
  const [link, setLink] = useState('');

  if (!date) return null;

  // Filter tasks for this selected date
  const items = (state.weeklyChecklist || []).filter(item => item.date === date);

  function handleAdd(e) {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;

    dispatch({
      type: 'ADD_CHECKLIST_ITEM',
      payload: {
        text: trimmedText,
        type,
        date,
        time: time || undefined, // undefined if empty
        link: link.trim() || undefined,
      },
    });

    setText('');
    setTime('');
    setLink('');
  }

  function getTypeLabel(t) {
    switch (t) {
      case 'must': return '📌 Must Do';
      case 'optional': return '⭐ Optional';
      case 'event': return '📅 Event';
      case 'fitness': return '🏃 Fitness';
      case 'outing': return '🚗 Outing';
      case 'reminder': return '🔔 Reminder';
      default: return t;
    }
  }

  function getTypeColor(t) {
    switch (t) {
      case 'must': return '#ef4444'; // Red
      case 'optional': return '#10b981'; // Green
      case 'event': return '#8b5cf6'; // Purple
      case 'fitness': return '#f43f5e'; // Pink
      case 'outing': return '#f59e0b'; // Amber
      case 'reminder': return '#06b6d4'; // Cyan
      default: return 'var(--text-secondary)';
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>📅 Schedule for {fmtDate(date)}</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '1.5rem', padding: '0 var(--space-2)' }}>×</button>
        </div>

        {/* Existing Items List */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Scheduled Tasks & Activities</h3>
          {items.length === 0 ? (
            <p className="text-secondary text-sm">No items scheduled for this day.</p>
          ) : (
            <div className="flex flex-col gap-2" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  className={`check-item ${item.done ? 'done' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderLeft: `4px solid ${getTypeColor(item.type)}`
                  }}
                >
                  <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
                    <button
                      className={`check-box ${item.done ? 'checked' : ''}`}
                      onClick={() => dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', id: item.id })}
                      aria-label={item.done ? 'Uncheck' : 'Check'}
                    >
                      {item.done ? '✓' : ''}
                    </button>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="check-label" style={{ display: 'block', fontWeight: 500 }}>{item.text}</span>
                      <div className="flex items-center flex-wrap gap-2" style={{ marginTop: '2px', fontSize: '0.75rem' }}>
                        <span style={{ color: getTypeColor(item.type), fontWeight: 600 }}>
                          {getTypeLabel(item.type)}
                        </span>
                        {item.time && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            ⏰ {item.time}
                          </span>
                        )}
                        {item.link && (
                          <a
                            href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--accent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              textDecoration: 'underline',
                              fontWeight: 500,
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            🔗 Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
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
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', marginBottom: 'var(--space-6)' }} />

        {/* Add Item Form */}
        <div>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>➕ Add Task, Reminder or Activity</h3>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="modal-text">Description</label>
              <input
                id="modal-text"
                type="text"
                placeholder="e.g. Register for LeetCode contest, Trip booking, Gym session..."
                value={text}
                onChange={e => setText(e.target.value)}
                required
              />
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="modal-type">Type</label>
                <select
                  id="modal-type"
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ textTransform: 'capitalize' }}
                >
                  <option value="must">📌 Must Do</option>
                  <option value="optional">⭐ Optional / Practice</option>
                  <option value="reminder">🔔 Reminder / Event Registration / Trips</option>
                  <option value="event">📅 Event</option>
                  <option value="fitness">🏃 Fitness Activity</option>
                  <option value="outing">🚗 Outing Activity</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-time">Time (Optional)</label>
                <input
                  id="modal-time"
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-link">Link / URL (Optional - registration, tickets, maps, etc.)</label>
              <input
                id="modal-link"
                type="url"
                placeholder="e.g. https://codeforces.com/contest/123 or booking link"
                value={link}
                onChange={e => setLink(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
              Add to Schedule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
