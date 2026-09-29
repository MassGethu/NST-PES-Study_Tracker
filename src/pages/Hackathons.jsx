import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';
import { newHackathon, validateHackathon, sortedHackathons, formatDeadline, hackathonDeadline, officialUrl } from '../store/hackathons.js';

export default function Hackathons() {
  const { state, dispatch, researchHackathon, researchingHackathons, account } = useStore();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('current');
  const [search, setSearch] = useState('');
  const all = state.hackathons || [];
  const rows = sortedHackathons(all, filter === 'archived').filter(row =>
    (filter !== 'submitted' || row.status === 'Submitted') &&
    (filter !== 'current' || row.status !== 'Submitted') &&
    `${row.name} ${row.domains || ''}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="hackathon-manager">
    <div className="section-header hackathon-heading">
      <div><h1>Hackathon Manager</h1><p className="text-muted">Capture an opportunity now. Decide what to build when you have time.</p></div>
      <div className="flex gap-2"><Link className="btn btn-secondary" to="/hackathons/ideas">💡 Idea bank</Link><button className="btn btn-primary" onClick={() => { setAdding(true); setError(''); }}>+ Add Hackathon</button></div>
    </div>
    {adding && <form className="card mb-4" onSubmit={event => {
      event.preventDefault();
      const row = newHackathon(uuid(), name, url);
      const message = validateHackathon(row); setError(message); if (message) return;
      dispatch({ type: 'SAVE_HACKATHON', payload: row });
      researchHackathon(row.id);
      navigate(`/hackathons/${row.id}`);
    }}>
      <h2 className="mb-3">Save an opportunity</h2>
      <div className="form-row form-row-2">
        <label className="form-group">Hackathon name<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="form-group">Official URL<input type="url" required maxLength={2000} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></label>
      </div>
      <p className="text-muted text-sm mb-3">Saved immediately. AI will fill the event facts; you can review or change them later.</p>
      {error && <p className="form-error mb-3" role="alert">{error}</p>}
      <div className="flex gap-2"><button className="btn btn-primary">Save & autofill</button><button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button></div>
    </form>}
    <div className="hackathon-toolbar">
      <div className="tabs" style={{ marginBottom: 0 }}>{[['current', 'Opportunities'], ['submitted', 'Submitted'], ['archived', 'Archived']].map(([value, label]) => <button key={value} className={`tab${filter === value ? ' active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <input aria-label="Search hackathons" placeholder="Search name or domain…" value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    <div className="hackathon-grid">
      {rows.map(row => {
        const deadline = hackathonDeadline(row);
        const pending = researchingHackathons.includes(`${account.user.id}:${row.id}`);
        return <article className="card hackathon-tile" key={row.id}>
          <div className="flex items-center justify-between gap-2"><span className={`badge ${row.status === 'Submitted' ? 'badge-green' : 'badge-accent'}`}>{row.status}</span><span className="text-xs text-muted">{row.difficulty ? `${'★'.repeat(row.difficulty)}${'☆'.repeat(5 - row.difficulty)}` : 'Unrated'}</span></div>
          <Link className="hackathon-name" to={`/hackathons/${row.id}`}>{row.name}</Link>
          <div className="text-sm"><span className="text-muted">{deadline.label} deadline</span><div className={deadline.value && Date.parse(deadline.value) < Date.now() ? 'field-error' : ''}>{formatDeadline(deadline.value)}</div></div>
          {row.status === 'Registration Pending' && row.deadline && <span className="text-xs text-muted">Submission · {formatDeadline(row.deadline)}</span>}
          {row.idea && <p className="text-sm hackathon-preview">{row.idea}</p>}
          <p className="text-sm text-muted hackathon-preview">{row.domains || 'Domains not reviewed yet'}</p>
          {pending && <span className="text-xs text-muted" role="status">Reading event information…</span>}
          {!pending && row.researchStatus === 'error' && <span className="text-xs field-error">Autofill needs attention</span>}
          <div className="hackathon-tile-footer"><Link to={`/hackathons/${row.id}`} className="btn btn-secondary btn-sm">Detailed view →</Link><a href={officialUrl(row.url) || undefined} target="_blank" rel="noopener noreferrer" className="text-sm">Official ↗</a></div>
        </article>;
      })}
    </div>
    {!rows.length && <div className="card empty-state"><span className="es-icon">🏁</span><p>{search ? 'No matching hackathons.' : 'No hackathons here yet.'}</p>{filter === 'current' && !search && <button className="btn btn-secondary" onClick={() => setAdding(true)}>Save your first opportunity</button>}</div>}
  </div>;
}
