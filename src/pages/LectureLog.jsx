import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import SubjectChip from '../components/SubjectChip.jsx';
import LectureDetailModal from '../components/LectureDetailModal.jsx';
import { fmtDate, understoodStatus, today } from '../store/utils.js';

export default function LectureLog() {
  const { state, dispatch, derived } = useStore();
  const { todaySubjects } = derived;
  const [searchParams] = useSearchParams();

  const [showClassesOverlay, setShowClassesOverlay] = useState(searchParams.get('openClasses') === '1');

  const [sessionFilter, setSessionFilter] = useState('all'); // 'all' | 'lecture' | 'lab'
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewDetailId, setViewDetailId] = useState(searchParams.get('topicId'));

  const subjects = state.subjects || [];
  const topics = state.topics || [];

  useEffect(() => {
    if (searchParams.get('topicId')) setViewDetailId(searchParams.get('topicId'));
    if (searchParams.get('openClasses') === '1') {
      setShowClassesOverlay(true);
    }
  }, [searchParams]);

  // Topics for current activeTab (before search & sessionType filter)
  const tabTopics = useMemo(() => {
    return activeTab === 'all' ? topics : topics.filter(t => t.subjectId === activeTab);
  }, [topics, activeTab]);

  // Filter by tab, sessionType, and search
  const filtered = useMemo(() => {
    let list = [...tabTopics];
    if (sessionFilter !== 'all') {
      list = list.filter(t => (t.sessionType || 'lecture') === sessionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.topicName.toLowerCase().includes(q) ||
        (t.concepts || []).some(c => c.toLowerCase().includes(q)) ||
        (t.bullets || []).some(b => b.toLowerCase().includes(q)) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.notebookLink || '').toLowerCase().includes(q) ||
        (t.ai_notes || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [tabTopics, sessionFilter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1>Lecture Log</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Record and review concepts from your lectures
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowClassesOverlay(true)}>
            📅 Today's Classes ({todaySubjects.length})
          </button>
          <Link className="btn btn-primary" to="/lecture/new">+ Log Lecture</Link>
        </div>
      </div>

      {/* Today's Classes Overlay Modal */}
      {showClassesOverlay && (
        <div className="modal-backdrop" onClick={() => setShowClassesOverlay(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div>
                <h2>📅 Today's Classes to Log</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Scheduled classes on timetable for today ({fmtDate(today())}):
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowClassesOverlay(false)}>✕</button>
            </div>

            <div className="flex flex-col gap-3" style={{ margin: 'var(--space-4) 0' }}>
              {todaySubjects.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <span className="es-icon">😴</span>
                  <span className="es-text">No classes scheduled for today in your timetable.</span>
                </div>
              ) : (
                todaySubjects.map(s => {
                  const loggedToday = (state.topics || []).filter(t => t.subjectId === s.id && t.date === today()).length;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius)',
                        background: s.color + '12',
                        border: `1px solid ${s.color}33`,
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: '1.4rem' }}>{subjectIcon(s.name)}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: s.color, fontSize: '0.95rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {loggedToday > 0 ? `✅ ${loggedToday} topic${loggedToday !== 1 ? 's' : ''} logged today` : '⚠️ Not logged yet today'}
                          </div>
                        </div>
                      </div>

                      <Link
                        className="btn btn-primary btn-sm"
                        to={`/lecture/new?subjectId=${encodeURIComponent(s.id)}`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        + Log Lecture
                      </Link>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                💡 Clicking a class opens a new tab to log it so you can return here.
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowClassesOverlay(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        <button
          className={`tab${activeTab === 'all' ? ' active' : ''}`}
          onClick={() => setActiveTab('all')}
        >All ({topics.length})</button>
        {subjects.map(s => (
          <button
            key={s.id}
            className={`tab${activeTab === s.id ? ' active' : ''}`}
            onClick={() => setActiveTab(s.id)}
          >
            {s.name} ({topics.filter(t => t.subjectId === s.id).length})
          </button>
        ))}
      </div>

      {/* Search & Sub-filters */}
      <div className="flex items-center justify-between gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '240px', marginBottom: 0 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search topics, concepts, bullets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="log-search"
          />
        </div>

        {/* Lab vs Lecture Filter Pills */}
        <div className="tab-container" style={{ display: 'flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <button
            className={`tab ${sessionFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSessionFilter('all')}
            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
          >
            All ({tabTopics.length})
          </button>
          <button
            className={`tab ${sessionFilter === 'lecture' ? 'active' : ''}`}
            onClick={() => setSessionFilter('lecture')}
            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
          >
            📚 Lectures ({tabTopics.filter(t => (t.sessionType || 'lecture') === 'lecture').length})
          </button>
          <button
            className={`tab ${sessionFilter === 'lab' ? 'active' : ''}`}
            onClick={() => setSessionFilter('lab')}
            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
          >
            🔬 Labs ({tabTopics.filter(t => t.sessionType === 'lab').length})
          </button>
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="empty-state">
          <span className="es-icon">📭</span>
          <span className="es-text">
            {topics.length === 0
              ? 'No lectures logged yet. Use "+ Log Lecture" to add your first one!'
              : 'No entries match your search.'
            }
          </span>
        </div>
      )}

      {/* Grouped list */}
      <div className="flex flex-col gap-5">
        {grouped.map(([date, dayTopics]) => (
          <div key={date}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 'var(--space-3)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            }}>
              {fmtDate(date)}
              <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <div className="flex flex-col gap-3">
              {dayTopics.map(t => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  expanded={expandedId === t.id}
                  editing={editId === t.id}
                  onToggle={() => setExpandedId(id => id === t.id ? null : t.id)}
                  onEdit={() => { setEditId(t.id); setExpandedId(t.id); }}
                  onCancelEdit={() => setEditId(null)}
                  onViewDetail={() => setViewDetailId(t.id)}
                  dispatch={dispatch}
                  subjects={subjects}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {viewDetailId && (
        <LectureDetailModal
          topicId={viewDetailId}
          onClose={() => setViewDetailId(null)}
        />
      )}
    </div>
  );
}

/* ─── Inline TopicCard ─────────────────────────────────────────────────── */

function TopicCard({ topic, expanded, editing, onToggle, onEdit, onCancelEdit, onViewDetail, dispatch, subjects }) {
  const { isWorksheet } = useStore();
  const st = understoodStatus(topic.understoodPct);
  const [editForm, setEditForm] = useState({ ...topic, conceptsStr: (topic.concepts || []).join(', '), bulletsStr: (topic.bullets || []).join('\n') });

  function saveEdit() {
    const updated = {
      ...editForm,
      concepts: editForm.conceptsStr.split(',').map(c => c.trim()).filter(Boolean),
      bullets: editForm.bulletsStr.split('\n').map(b => b.trim()).filter(Boolean),
      understoodPct: Number(editForm.understoodPct),
      difficulty: Number(editForm.difficulty),
    };
    dispatch({ type: 'UPDATE_TOPIC', id: topic.id, payload: updated });
    onCancelEdit();
  }

  if (editing) {
    return (
      <div className="card slide-up">
        <div className="flex flex-col gap-4">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Subject</label>
              <select value={editForm.subjectId} onChange={e => setEditForm(f => ({ ...f, subjectId: e.target.value }))}>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Topic Name</label>
            <input type="text" value={editForm.topicName} onChange={e => setEditForm(f => ({ ...f, topicName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Understood %</span><span style={{ fontWeight: 700 }}>{editForm.understoodPct}%</span>
            </label>
            <input type="range" min="0" max="100" step="5" value={editForm.understoodPct}
              onChange={e => setEditForm(f => ({ ...f, understoodPct: e.target.value }))}
              style={{ padding: 0, border: 'none', background: 'none', accentColor: 'var(--accent)' }} />
          </div>
          <div className="form-row form-row-2">
            {!isWorksheet && <div className="form-group">
              <label className="form-label">Contest Relevance</label>
              <select value={editForm.contestRelevance} onChange={e => setEditForm(f => ({ ...f, contestRelevance: e.target.value }))}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>}
            <div className="form-group">
              <label className="form-label">Difficulty (1–5)</label>
              <input type="number" min="1" max="5" value={editForm.difficulty}
                onChange={e => setEditForm(f => ({ ...f, difficulty: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Concepts (comma-separated)</label>
            <input type="text" value={editForm.conceptsStr}
              onChange={e => setEditForm(f => ({ ...f, conceptsStr: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Bullets (one per line)</label>
            <textarea rows={4} value={editForm.bulletsStr}
              onChange={e => setEditForm(f => ({ ...f, bulletsStr: e.target.value }))}
              style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes / Link</label>
            <input type="text" value={editForm.notes || ''}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-sm" style={{ cursor: 'pointer' }} onClick={onToggle}>
      {/* Summary row */}
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '1.2rem' }}>{st.label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topic.topicName}
          </div>
          <div className="flex gap-2 items-center" style={{ marginTop: 3, flexWrap: 'wrap' }}>
            <SubjectChip subjectId={topic.subjectId} size="sm" />
            <span
              className="badge"
              style={{
                fontSize: '0.65rem',
                background: topic.sessionType === 'lab' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: topic.sessionType === 'lab' ? '#a78bfa' : '#60a5fa',
                fontWeight: 600,
              }}
            >
              {topic.sessionType === 'lab' ? '🔬 Lab' : '📚 Lecture'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{topic.understoodPct}% understood</span>
            {!isWorksheet && topic.contestRelevance === 'High' && <span className="badge badge-accent" style={{ fontSize: '0.6rem' }}>Contest High</span>}
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? '▲' : '▾'}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>

          {/* Progress bar */}
          <div className="progress-bar" style={{ marginBottom: 'var(--space-4)' }}>
            <div
              className={`progress-fill ${topic.understoodPct >= 70 ? 'green' : topic.understoodPct >= 40 ? 'yellow' : 'red'}`}
              style={{ width: `${topic.understoodPct}%` }}
            />
          </div>

          {/* Tags */}
          {topic.concepts?.length > 0 && (
            <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              {topic.concepts.map(c => (
                <span key={c} className="badge badge-muted">{c}</span>
              ))}
            </div>
          )}

          {/* Bullets */}
          {topic.bullets?.filter(Boolean).length > 0 && (
            <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--space-3)' }}>
              {topic.bullets.filter(Boolean).map((b, i) => (
                <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{b}</li>
              ))}
            </ul>
          )}

          {/* Meta */}
          <div className="flex gap-4" style={{ flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            <span>Difficulty: {'★'.repeat(topic.difficulty || 1)}{'☆'.repeat(5 - (topic.difficulty || 1))}</span>
            {!isWorksheet && <span>Relevance: {topic.contestRelevance}</span>}
            <span>Revision round: {topic.revisionCompleted ? 'Completed' : `${(topic.revisionCount ?? topic.revisionStage ?? 0) + 1}/2`}</span>
            {topic.notes && <a href={topic.notes} target="_blank" rel="noreferrer" style={{ color: 'var(--text-accent)' }}>Notes ↗</a>}
          </div>

          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={onViewDetail}>🔍 View Details</button>
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>✏️ Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => {
              if (confirm(`Delete "${topic.topicName}"?`)) dispatch({ type: 'DELETE_TOPIC', id: topic.id });
            }}>🗑 Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function subjectIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('dsa') || n.includes('algo')) return '🌲';
  if (n.includes('math')) return '📐';
  if (n.includes('web')) return '🌐';
  if (n.includes('comm')) return '💬';
  return '📚';
}
