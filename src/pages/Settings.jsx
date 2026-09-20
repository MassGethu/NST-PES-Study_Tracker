import React, { useState, useRef } from 'react';
import { useStore, DISTINCT_COLORS } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';
import { downloadBackup, parseBackup, mergeImport, readLegacy, emptyState } from '../store/accountStorage.js';
import { remoteApi } from '../store/remoteApi.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const PRESET_COLORS = DISTINCT_COLORS;

export default function Settings() {
  const { state, dispatch, account, logout, isWorksheet, flush, reloadServer } = useStore();
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
    reader.onload = async (ev) => {
      try {
        const incoming = parseBackup(ev.target.result);
        const next = mergeImport(state, incoming);
        if (!confirm('Add this backup to the signed-in account? Existing conflicting records will never be overwritten.')) return;
        downloadBackup(state, `${account.user.username}-before-import`);
        dispatch({ type: 'REPLACE_STORE', payload: next });
        await flush();
        setImportSuccess(true);
        setImportError('');
      } catch (error) { setImportError(error.message); }
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
        <AccountPanel account={account} logout={logout} flush={flush} reloadServer={reloadServer} />
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
            <button className="btn btn-secondary" onClick={() => downloadBackup(state, account.user.username)}>
              ⬇️ Export JSON Backup
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Import Data</h3>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              Add a previous JSON backup to this account. Conflicting records stop the import; nothing is silently overwritten. A safety copy downloads first.
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
            {importSuccess && <p role="status" style={{ color: 'var(--green)', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>✓ Imported and saved online.</p>}
            {account.user.username === 'aadarsh' && <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={async () => {
              try {
                const legacy = readLegacy();
                if (!legacy) throw new Error('No legacy data at this website address. Export it at localhost:5173 first, then import the downloaded backup here.');
                const next = mergeImport(state, legacy);
                if (!confirm('Import your old data from this browser into Aadarsh’s account? The original remains untouched.')) return;
                downloadBackup(legacy, 'local-original');
                dispatch({ type: 'REPLACE_STORE', payload: next }); await flush(); setImportSuccess(true); setImportError('');
              } catch (error) { setImportError(error.message); }
            }}>Import old data from this browser</button>}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Data Summary</h3>
            <div className="flex flex-col gap-2" style={{ fontSize: '0.875rem' }}>
              {[
                ['Subjects', (state.subjects || []).length],
                ['Topics logged', (state.topics || []).length],
                isWorksheet ? ['Worksheets', (state.worksheets || []).length] : ['Contest weeks', (state.contestWeeks || []).length],
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
                downloadBackup(state, 'before-reset');
                dispatch({ type: 'REPLACE_STORE', payload: emptyState() });
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

function AccountPanel({ account, logout, flush, reloadServer }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="card" style={{ maxWidth: 680 }}>
    <h3>{account.user.display_name}</h3>
    <p className="text-muted text-sm">@{account.user.username || account.user.email}</p>
    <p style={{ margin: '16px 0' }} role="status">{account.syncStatus === 'synced' ? 'All changes saved online' : account.syncStatus === 'error' ? 'Sync needs attention' : 'Saving changes…'}</p>
    {account.error && <p className="form-error" role="alert">{account.error}</p>}
    <div className="flex gap-3" style={{ flexWrap: 'wrap', marginBottom: 24 }}>
      <button className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); await logout(); setBusy(false); }}>Sign out</button>
      {account.syncStatus === 'error' && <>
        <button className="btn btn-secondary" onClick={() => flush().catch(e => setMessage(e.message))}>Retry save</button>
        <button className="btn btn-secondary" onClick={async () => {
          if (!confirm('Download your unsaved safety copy and load the latest server copy?')) return;
          try { await reloadServer(); } catch (e) { setMessage(e.message); }
        }}>Reload server copy</button>
      </>}
    </div>
    <h3 style={{ marginBottom: 12 }}>Change password</h3>
    <form className="flex flex-col gap-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage('');
      try { await remoteApi.changePassword({ currentPassword, password }); setCurrentPassword(''); setPassword(''); setMessage('Password updated. Other sessions have been signed out.'); }
      catch (error) { setMessage(error.message); }
      finally { setBusy(false); }
    }}>
      <label className="form-group">Current password<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
      <label className="form-group">New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy}>Update password</button>
      {message && <p role="status">{message}</p>}
    </form>
  </div>;
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
