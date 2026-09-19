import React, { useState, useRef } from 'react';
import { useStore, DISTINCT_COLORS } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';
import { exportStore, importStore } from '../store/db.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const PRESET_COLORS = DISTINCT_COLORS;

export default function Settings() {
  const { state, dispatch, account, register, login, logout } = useStore();
  const subjects = state.subjects || [];
  const timetable = state.timetable || {};
  const fileRef = useRef(null);

  const [activeSection, setActiveSection] = useState('subjects');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // ── Subjects state ─────────────────────────────────────────────────────────
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(PRESET_COLORS[4]);
  const [editingSubject, setEditingSubject] = useState(null); // { id, name, color }

  function addSubject() {
    const name = newSubjectName.trim();
    if (!name) return;
    dispatch({ type: 'ADD_SUBJECT', payload: { name, color: newSubjectColor } });
    setNewSubjectName('');
    setNewSubjectColor(PRESET_COLORS[0]);
  }

  function saveSubjectEdit() {
    if (!editingSubject) return;
    dispatch({ type: 'UPDATE_SUBJECT', id: editingSubject.id, payload: { name: editingSubject.name, color: editingSubject.color } });
    setEditingSubject(null);
  }

  // ── Timetable state ────────────────────────────────────────────────────────
  function toggleTimetableSubject(day, subjectId) {
    const current = timetable[day] || [];
    const next = current.includes(subjectId)
      ? current.filter(id => id !== subjectId)
      : [...current, subjectId];
    dispatch({ type: 'SET_TIMETABLE', payload: { ...timetable, [day]: next } });
  }

  // ── Import/Export ──────────────────────────────────────────────────────────
  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importStore(ev.target.result);
      if (result.ok) {
        setImportSuccess(true);
        setImportError('');
        setTimeout(() => window.location.reload(), 800);
      } else {
        setImportError(result.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const SECTIONS = [
    { id: 'account',   label: '👤 Account' },
    { id: 'subjects',  label: '📚 Subjects' },
    { id: 'timetable', label: '📅 Timetable' },
    { id: 'data',      label: '💾 Data' },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 'var(--space-5)' }}>Settings</h1>

      <div className="tabs mb-4">
        {SECTIONS.map(s => (
          <button key={s.id} className={`tab${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'account' && (
        <AccountPanel account={account} register={register} login={login} logout={logout} />
      )}

      {/* ── Subjects ─────────────────────────────────────────────────── */}
      {activeSection === 'subjects' && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Your Subjects</h3>

            {subjects.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                No subjects yet. Add your first one below.
              </p>
            )}

            <div className="flex flex-col gap-3" style={{ marginBottom: 'var(--space-5)' }}>
              {subjects.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${s.color}33`,
                }}>
                  {editingSubject?.id === s.id ? (
                    <>
                      <input
                        type="text"
                        value={editingSubject.name}
                        onChange={e => setEditingSubject(es => ({ ...es, name: e.target.value }))}
                        style={{ flex: 1 }}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && saveSubjectEdit()}
                      />
                      <ColorPicker
                        value={editingSubject.color}
                        onChange={color => setEditingSubject(es => ({ ...es, color }))}
                      />
                      <button className="btn btn-primary btn-sm" onClick={saveSubjectEdit}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingSubject(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(state.topics || []).filter(t => t.subjectId === s.id).length} topics
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingSubject({ ...s })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        if (confirm(`Delete "${s.name}"? This will also delete all its topics.`)) {
                          dispatch({ type: 'DELETE_SUBJECT', id: s.id });
                        }
                      }}>🗑</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <h4 style={{ marginBottom: 'var(--space-3)' }}>Add Subject</h4>
              <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Subject name…"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubject()}
                  id="new-subject-name"
                  style={{ flex: 1, minWidth: 160 }}
                />
                <ColorPicker value={newSubjectColor} onChange={setNewSubjectColor} />
                <button className="btn btn-primary" onClick={addSubject}>+ Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Timetable ─────────────────────────────────────────────────── */}
      {activeSection === 'timetable' && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Weekly Timetable</h3>
          <p style={{ marginBottom: 'var(--space-5)', fontSize: '0.875rem' }}>
            Toggle which subjects you have on each day. This drives the "Today's Classes" card on the dashboard.
          </p>

          {subjects.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Add subjects first, then configure your timetable.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {DAYS.map(day => (
                <div key={day} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    width: 80, fontSize: '0.8rem', fontWeight: 700,
                    color: ['Sat','Sun'].includes(day) ? 'var(--text-muted)' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    {DAY_LABELS[day]}
                  </span>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {subjects.map(s => {
                      const active = (timetable[day] || []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleTimetableSubject(day, s.id)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 99,
                            border: `1px solid ${active ? s.color : 'var(--border)'}`,
                            background: active ? s.color + '22' : 'transparent',
                            color: active ? s.color : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                  {(timetable[day] || []).length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No classes</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Data / Backup ─────────────────────────────────────────────── */}
      {activeSection === 'data' && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Export Data</h3>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              Download a full JSON backup of all your data. Import it on another device or restore it here.
            </p>
            <button className="btn btn-secondary" onClick={exportStore}>
              ⬇️ Export JSON Backup
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Import Data</h3>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              Restore from a previous JSON backup. <strong style={{ color: 'var(--yellow)' }}>This will overwrite all current data.</strong>
            </p>
            <input
              type="file"
              accept=".json"
              ref={fileRef}
              onChange={handleImport}
              style={{ display: 'none' }}
              id="import-file"
            />
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              ⬆️ Import JSON Backup
            </button>
            {importError && <p style={{ color: 'var(--red)', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>{importError}</p>}
            {importSuccess && <p style={{ color: 'var(--green)', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>✓ Imported! Reloading…</p>}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Data Summary</h3>
            <div className="flex flex-col gap-2" style={{ fontSize: '0.875rem' }}>
              {[
                ['Subjects', (state.subjects || []).length],
                ['Topics logged', (state.topics || []).length],
                ['Contest weeks', (state.contestWeeks || []).length],
                ['Checklist items', (state.weeklyChecklist || []).length],
              ].map(([label, count]) => (
                <div key={label} className="flex justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
            <h3 style={{ marginBottom: 'var(--space-2)', color: 'var(--red)' }}>Danger Zone</h3>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              Permanently delete all data and reset to defaults. Cannot be undone.
            </p>
            <button className="btn btn-danger" onClick={() => {
              if (confirm('Delete ALL data and reset to defaults? This cannot be undone.')) {
                localStorage.removeItem('nst_tracker_v1');
                window.location.reload();
              }
            }}>
              🗑 Reset Everything
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountPanel({ account, register, login, logout }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const result = mode === 'register'
      ? await register(form)
      : await login({ email: form.email, password: form.password });
    setSubmitting(false);
    if (result.ok) setMessage(mode === 'register' ? 'Account created. Your existing tracker data is now backed up online.' : 'Signed in and synced.');
  }

  if (account.user) {
    const statusLabel = {
      syncing: 'Importing your existing data…',
      saving: 'Saving changes…',
      synced: 'All changes saved',
      error: 'Sync needs attention',
    }[account.syncStatus] || 'Connected';
    return (
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="flex justify-between items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3>{account.user.display_name || account.user.email}</h3>
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>{account.user.email}</p>
          </div>
          <span className={`sync-badge ${account.syncStatus}`}>{statusLabel}</span>
        </div>
        <p style={{ margin: 'var(--space-4) 0', fontSize: '0.875rem' }}>
          Your tracker is stored securely for this account. The browser copy remains available as a safety backup.
        </p>
        {account.error && <p className="form-error" style={{ marginBottom: 'var(--space-3)' }}>{account.error}</p>}
        {message && <p style={{ color: 'var(--green)', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>{message}</p>}
        <button className="btn btn-secondary" onClick={logout}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 680 }}>
      <h3 style={{ marginBottom: 'var(--space-2)' }}>{mode === 'register' ? 'Create your tracker account' : 'Sign in to your tracker'}</h3>
      <p style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
        {mode === 'register'
          ? 'Your current browser data will be imported automatically and kept intact.'
          : 'Your saved tracker data will sync to this device.'}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'register' && <div className="form-group"><label className="form-label" htmlFor="account-name">Name</label><input id="account-name" value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} autoComplete="name" /></div>}
        <div className="form-group"><label className="form-label" htmlFor="account-email">Email</label><input id="account-email" type="email" required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} autoComplete="email" /></div>
        <div className="form-group"><label className="form-label" htmlFor="account-password">Password</label><input id="account-password" type="password" required minLength={8} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></div>
        {account.error && <p className="form-error">{account.error}</p>}
        {message && <p style={{ color: 'var(--green)', fontSize: '0.875rem' }}>{message}</p>}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting || account.status === 'checking'}>{submitting ? 'Please wait…' : mode === 'register' ? 'Create account & import data' : 'Sign in'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setMode(current => current === 'register' ? 'login' : 'register'); setMessage(''); }}>
            {mode === 'register' ? 'I already have an account' : 'Create a new account'}
          </button>
        </div>
      </form>
      <p className="text-muted text-sm" style={{ marginTop: 'var(--space-4)' }}>You can continue using the app locally without an account while developing.</p>
    </div>
  );
}

/* ── Colour picker sub-component ──────────────────────────────────────────── */
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22,
            borderRadius: '50%',
            background: c,
            border: value === c ? '2px solid white' : '2px solid transparent',
            boxShadow: value === c ? `0 0 0 2px ${c}` : 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'all 150ms ease',
            flexShrink: 0,
          }}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: '50%', cursor: 'pointer', background: 'none' }}
        title="Custom colour"
      />
    </div>
  );
}
