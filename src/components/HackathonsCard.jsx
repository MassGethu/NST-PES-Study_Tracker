import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';
import {
  HACKATHON_STATUSES, isHackathonUser, officialUrl, validateHackathon,
  sortedHackathons, localDeadline, formatDeadline,
} from '../store/hackathons.js';

export default function HackathonsCard() {
  const { state, account, dispatch } = useStore();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [archived, setArchived] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!isHackathonUser(account.user)) return null;

  const all = state.hackathons || [];
  const rows = sortedHackathons(all, archived);
  const active = sortedHackathons(all).filter(row => row.status !== 'Submitted');
  const next = active.find(row => Date.parse(row.deadline) >= Date.now());
  const change = (key, value) => setEditing(row => ({ ...row, [key]: value }));
  const save = row => dispatch({ type: 'SAVE_HACKATHON', payload: row });
  const edit = row => { setError(''); setEditing({ ...row, deadline: localDeadline(row.deadline) }); };

  return <section className="card full-width" aria-labelledby="hackathons-title">
    <div className="card-header" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      <h2 className="card-title" id="hackathons-title">🏁 Hackathons Currently Registered</h2>
      <button className="btn btn-primary btn-sm" onClick={() => {
        setError(''); setEditing({ id: uuid(), name: '', url: '', deadline: '', idea: '', status: 'Registered', notes: '', archived: false });
      }}>+ Add Hackathon</button>
    </div>
    <p className="text-muted text-sm mb-3">
      {active.length} active hackathon{active.length !== 1 ? 's' : ''}
      {next && ` · Next deadline: ${formatDeadline(next.deadline)}`}
    </p>

    {editing && <form className="log-section flex flex-col gap-3 mb-4" onSubmit={event => {
      event.preventDefault();
      const message = validateHackathon(editing); setError(message); if (message) return;
      save({ ...editing, name: editing.name.trim(), url: officialUrl(editing.url),
        deadline: new Date(editing.deadline).toISOString(), idea: editing.idea.trim(), notes: editing.notes.trim() });
      setEditing(null);
    }}>
      <h3>{all.some(row => row.id === editing.id) ? 'View / edit hackathon' : 'New hackathon'}</h3>
      <div className="form-row form-row-2">
        <label className="form-group">Hackathon name<input autoFocus required maxLength={200} value={editing.name} onChange={e => change('name', e.target.value)} /></label>
        <label className="form-group">Official / registration URL<input type="url" required maxLength={2000} placeholder="https://…" value={editing.url} onChange={e => change('url', e.target.value)} /></label>
        <label className="form-group">Final submission deadline (your local time)<input type="datetime-local" required value={editing.deadline} onChange={e => change('deadline', e.target.value)} /></label>
        <label className="form-group">Progress<select value={editing.status} onChange={e => change('status', e.target.value)}>{HACKATHON_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
      </div>
      <label className="form-group">My current idea<textarea rows={3} maxLength={10000} placeholder="Add an idea now or as it develops…" value={editing.idea} onChange={e => change('idea', e.target.value)} /></label>
      <label className="form-group">Notes (optional)<textarea rows={2} maxLength={10000} value={editing.notes} onChange={e => change('notes', e.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="flex gap-2"><button className="btn btn-primary btn-sm">Save hackathon</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}

    <div className="tabs" style={{ marginBottom: 'var(--space-3)' }}>
      <button className={`tab${!archived ? ' active' : ''}`} onClick={() => { setArchived(false); setExpanded(false); }}>Current ({all.filter(row => !row.archived).length})</button>
      <button className={`tab${archived ? ' active' : ''}`} onClick={() => { setArchived(true); setExpanded(false); }}>Archived ({all.filter(row => row.archived).length})</button>
    </div>
    <div className="flex flex-col gap-3">
      {(expanded ? rows : rows.slice(0, 3)).map(row => {
        const passed = Date.parse(row.deadline) < Date.now();
        return <article key={row.id} className="hackathon-row">
          <div className="hackathon-info">
            <h3 className="text-sm" style={{ overflowWrap: 'anywhere' }}>{row.name}</h3>
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              <span className="text-muted text-xs">Due {formatDeadline(row.deadline)}</span>
              {passed && <span className={`badge ${row.status === 'Submitted' ? 'badge-muted' : 'badge-red'}`}>Deadline passed</span>}
              {row.status === 'Submitted' && <span className="badge badge-green">Submitted</span>}
            </div>
            <p className="hackathon-idea text-muted text-sm" title={row.idea}>{row.idea || 'No idea added yet.'}</p>
          </div>
          <div className="hackathon-actions">
            <select aria-label={`Progress for ${row.name}`} value={row.status} onChange={e => {
              save({ ...row, status: e.target.value });
              if (editing?.id === row.id) change('status', e.target.value);
            }}>{HACKATHON_STATUSES.map(status => <option key={status}>{status}</option>)}</select>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {officialUrl(row.url) && <a className="btn btn-secondary btn-sm" href={officialUrl(row.url)} target="_blank" rel="noopener noreferrer">Official page ↗</a>}
              <button className="btn btn-secondary btn-sm" onClick={() => edit(row)}>View / Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                save({ ...row, archived: !row.archived });
                if (editing?.id === row.id) change('archived', !row.archived);
              }}>{row.archived ? 'Restore' : 'Archive'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                if (!confirm(`Delete hackathon “${row.name}”?`)) return;
                dispatch({ type: 'DELETE_HACKATHON', id: row.id });
                if (editing?.id === row.id) setEditing(null);
              }}>Delete</button>
            </div>
          </div>
        </article>;
      })}
      {!rows.length && <p className="text-muted text-sm">{archived ? 'No archived hackathons.' : 'No hackathons yet. Add one when you register.'}</p>}
    </div>
    {rows.length > 3 && <button className="btn btn-ghost btn-sm mt-3" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer' : `Show all ${rows.length} hackathons`}</button>}
  </section>;
}
