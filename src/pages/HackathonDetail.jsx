import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { remoteApi } from '../store/remoteApi.js';
import { HACKATHON_STATUSES, EVENT_FIELDS, EVENT_LABELS, validateHackathon, formatDeadline, localDeadline, officialUrl } from '../store/hackathons.js';

function Fact({ row, field, heading }) {
  return <div className="hackathon-fact">
    <h3>{heading || EVENT_LABELS[field]}</h3>
    <p className={`hackathon-fact-text${!row[field] ? ' text-muted' : ''}`}>{row[field] || (field === 'notes' ? 'No notes yet.' : 'Unknown — add this when you review the event.')}</p>
    {row.sources?.[field]?.length > 0 && <div className="hackathon-sources">{row.sources[field].map((source, i) => <a key={`${source.url}:${i}`} href={officialUrl(source.url) || undefined} target="_blank" rel="noopener noreferrer">{source.title || 'Source'} ↗</a>)}</div>}
    {row.sources?.[field]?.some(source => source.excerpt) && <details className="text-xs mt-3"><summary>Supporting text</summary>{row.sources[field].filter(source => source.excerpt).map((source, i) => <blockquote key={i}>{source.pasted ? 'Pasted text: ' : ''}{source.excerpt}</blockquote>)}</details>}
  </div>;
}
function Stars({ value, onChange }) {
  return <div className="hackathon-stars"><div role="group" aria-label="Hackathon difficulty">{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} className={value >= star ? 'selected' : ''} aria-label={`${star} star${star === 1 ? '' : 's'}`} aria-pressed={value === star} onClick={() => onChange(star)}>★</button>)}</div><span className="text-xs text-muted">{value ? `${value}/5 · ${value < 3 ? '3' : '7'}-day submission reminder` : 'Unrated · 7-day submission reminder'}</span></div>;
}

export default function HackathonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch, account, researchHackathon, researchingHackathons } = useStore();
  const row = state.hackathons.find(h => h.id === id);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState([]);
  const [error, setError] = useState('');
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState(null);
  const matchRef = useRef(0);
  useEffect(() => { setEditing(null); setMatches(null); setError(''); setMatching(false); return () => { matchRef.current += 1; }; }, [id]);
  if (!row) return <div className="card"><h1>Hackathon not found</h1><Link to="/hackathons">← Back to manager</Link></div>;
  const pending = researchingHackathons.includes(`${account.user.id}:${id}`);
  const ideas = state.hackathonIdeas || [];
  const selectedIdea = ideas.find(idea => idea.id === row.ideaId);
  const update = payload => dispatch({ type: 'UPDATE_HACKATHON', id, payload });
  const change = (key, value) => { setEditing(current => ({ ...current, [key]: value })); setDirty(current => [...new Set([...current, key])]); };
  const startEditing = () => {
    setEditing({ ...row, deadline: localDeadline(row.deadline), registrationDeadline: localDeadline(row.registrationDeadline) });
    setDirty([]); setError('');
  };
  const useIdea = (idea, adaptation = idea.description) => {
    if (row.idea && !confirm('Replace this hackathon’s current idea with the selected adaptation? The original idea bank entry will stay unchanged.')) return;
    update({ ideaId: idea.id, idea: adaptation });
  };
  const runMatching = async () => {
    const request = ++matchRef.current; setMatching(true); setError(''); setMatches(null);
    try {
      const result = await remoteApi.matchHackathonIdeas({ hackathon: row, ideas });
      if (request === matchRef.current) setMatches(result.matches);
    } catch (e) { if (request === matchRef.current) setError(e.message); }
    finally { if (request === matchRef.current) setMatching(false); }
  };
  return <div className="hackathon-detail">
    <Link to="/hackathons" className="text-muted text-sm">← Hackathon Manager</Link>
    <div className="section-header hackathon-heading mt-3">
      <div><span className="badge badge-accent">{row.archived ? 'Archived' : row.status}</span><h1 className="mt-3">{row.name}</h1><a href={officialUrl(row.url) || undefined} target="_blank" rel="noopener noreferrer">Open official page ↗</a></div>
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={startEditing}>Edit details</button><button className="btn btn-secondary" disabled={pending} onClick={() => researchHackathon(id)}>{pending ? 'Autofilling…' : 'AI autofill missing facts'}</button></div>
    </div>
    <div className="hackathon-deadlines mb-4">
      {[['registrationDeadline', 'Registration'], ['deadline', 'Submission']].map(([key, label]) => <div className="card" key={key}><span className="text-sm text-muted">{label} deadline</span><strong>{formatDeadline(row[key])}</strong>{row[key] && Date.parse(row[key]) < Date.now() && <span className="badge badge-muted">Deadline passed</span>}</div>)}
    </div>
    <details className="card mb-4">
      <summary>AI source options · paste event text or refresh</summary>
      <p className="text-muted mt-3">Autofill reads the official page, then Gemini extracts facts. If the page needs login or JavaScript, copy its rules and schedule here. Pasted text is labelled separately from fetched sources. Saved results are reused for 24 hours.</p>
      <label className="form-group" htmlFor="event-source-text">Event text (optional, maximum 40,000 characters)</label>
      <textarea id="event-source-text"  rows={6} maxLength={40000} value={row.sourceText || ''} onChange={e => { update({ sourceText: e.target.value }); }} />
      <div className="flex gap-2 mt-3">
        <button className="btn btn-secondary" disabled={pending} onClick={() => researchHackathon(id)}>Extract missing facts</button>
        <button className="btn btn-secondary" disabled={pending} onClick={() => researchHackathon(id, { refresh: true })}>Refresh with AI</button>
        {row.sourceText && <button className="btn btn-secondary" disabled={pending} onClick={() => { update({ sourceText: '' }); }}>Use official page instead</button>}
      </div>
    </details>
    <div className="hackathon-research-note mb-4" role="status">
      {pending ? 'Saved. Autofill is queued or reading the event facts; you can continue working here.' : row.researchStatus === 'running' ? 'Autofill was interrupted. Use “Autofill missing facts” to retry.' : row.researchStatus === 'error' ? row.researchError : row.researchAt ? `Facts filled ${formatDeadline(row.researchAt)}. Check the linked sources before acting on deadlines or rules.` : 'Event facts have not been filled yet. You can autofill or enter them yourself.'}
      {!pending && row.researchWarnings?.length > 0 && <ul>{row.researchWarnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
      {row.researchStatus === 'error' && row.researchDiagnostics?.model && <div className="text-xs mt-3">Model: {row.researchDiagnostics.model}{row.researchDiagnostics.quotas?.length ? ` · Quota: ${row.researchDiagnostics.quotas.join(', ')}` : ''}</div>}
    </div>
    {error && <p className="form-error mb-4" role="alert">{error}</p>}
    {editing && <form className="card flex flex-col gap-4 mb-4" onSubmit={e => {
      e.preventDefault(); const message = validateHackathon(editing); setError(message); if (message) return;
      const payload = Object.fromEntries(dirty.map(key => [key, editing[key]]));
      for (const key of ['deadline', 'registrationDeadline']) if (dirty.includes(key)) payload[key] = editing[key] ? new Date(editing[key]).toISOString() : '';
      const sources = { ...(row.sources || {}) };
      dirty.filter(key => EVENT_FIELDS.includes(key)).forEach(key => { delete sources[key]; });
      if (dirty.some(key => EVENT_FIELDS.includes(key))) payload.sources = sources;
      if (dirty.includes('name') || dirty.includes('url')) {
        payload.sources = {}; payload.researchAt = ''; payload.researchWarnings = []; payload.searchSuggestions = ''; payload.researchStatus = '';
      }
      update(payload); setEditing(null);
    }}>
      <h2>Edit hackathon</h2>
      <div className="form-row form-row-2">
        <label className="form-group">Name<input required maxLength={200} value={editing.name} onChange={e => change('name', e.target.value)} /></label>
        <label className="form-group">Official URL<input required type="url" maxLength={2000} value={editing.url} onChange={e => change('url', e.target.value)} /></label>
        <label className="form-group">Registration deadline (local time)<input type="datetime-local" value={editing.registrationDeadline} onChange={e => change('registrationDeadline', e.target.value)} /></label>
        <label className="form-group">Submission deadline (local time)<input type="datetime-local" value={editing.deadline} onChange={e => change('deadline', e.target.value)} /></label>
        <label className="form-group">Progress<select value={editing.status} onChange={e => change('status', e.target.value)}>{HACKATHON_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="form-group">Next action date<input type="date" value={editing.nextActionDate || ''} onChange={e => change('nextActionDate', e.target.value)} /></label>
      </div>
      {['purpose', 'teamLimit', 'eligibility', 'domains', 'rules', 'prize', 'idea', 'nextAction', 'notes'].map(key => <label className="form-group" key={key}>{EVENT_LABELS[key] || { idea: 'Current idea / adaptation', nextAction: 'Next action', notes: 'Additional notes' }[key]}<textarea rows={['rules', 'idea', 'notes'].includes(key) ? 4 : 2} maxLength={10000} value={editing[key] || ''} onChange={e => change(key, e.target.value)} /></label>)}
      <div className="flex gap-2"><button className="btn btn-primary">Save changes</button><button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setError(''); }}>Cancel</button></div>
    </form>}
    {!editing && <>
    <div className="hackathon-detail-grid">
      <div className="card flex flex-col gap-4">
        <label className="form-group">Progress<select value={row.status} onChange={e => update({ status: e.target.value })}>{HACKATHON_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        <div><h3 className="mb-3">Current idea</h3><p className="hackathon-fact-text">{row.idea || 'No idea selected yet. Review the domains, then choose an idea or develop a new one.'}</p>{selectedIdea && <Link to="/hackathons/ideas" className="text-xs">Original: {selectedIdea.title} ↗</Link>}</div>
        <div><h3 className="mb-3">Next action</h3><p className="hackathon-fact-text">{row.nextAction || 'Choose your next step when you review this opportunity.'}</p>{row.nextActionDate && <span className="text-xs text-muted">Target: {row.nextActionDate}</span>}</div>
        <button className="btn btn-secondary btn-sm" onClick={startEditing}>Update idea / next action</button>
      </div>
      <div className="card flex flex-col gap-4"><Fact row={row} field="rules" /><Fact row={row} field="eligibility" /><Fact row={row} field="teamLimit" /></div>
      <div className="card flex flex-col gap-4"><Fact row={row} field="domains" /><Fact row={row} field="purpose" /></div>
      <div className="card"><Fact row={row} field="notes" heading="Additional notes" /></div>
      <div className="card"><h3 className="mb-3">Difficulty</h3><Stars value={row.difficulty} onChange={difficulty => update({ difficulty })} /><p className="text-xs text-muted mt-3">Separate registration deadlines remind you 2 days before. If registration and submission coincide, the submission window applies.</p></div>
      <div className="card"><Fact row={row} field="prize" /></div>
    </div>
    <section className="card mt-4">
      <div className="section-header hackathon-heading"><div><h2>Find a starting idea</h2><p className="text-muted text-sm">Choose from your idea bank, or ask AI to suggest fits and adaptations when you’re ready.</p></div><Link className="btn btn-secondary btn-sm" to="/hackathons/ideas">Open idea bank ↗</Link></div>
      {ideas.length ? <><label className="form-group" style={{ maxWidth: 440 }}>Use an existing idea<select value="" onChange={e => { const idea = ideas.find(i => i.id === e.target.value); if (idea) useIdea(idea); }}><option value="">Choose an original idea…</option>{ideas.map(idea => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label><button className="btn btn-secondary btn-sm" disabled={matching} onClick={runMatching}>{matching ? 'Comparing ideas…' : 'Suggest matches with AI'}</button></> : <p className="text-muted text-sm">Add ideas to the bank to compare them with this event.</p>}
      {matches?.length === 0 && <p className="text-muted text-sm mt-3">No suitable matches found. You can still choose an idea manually or develop a new one.</p>}
      {matches && matches.length > 0 && <div className="hackathon-grid mt-4">{matches.map(match => {
        const idea = ideas.find(i => i.id === match.ideaId); if (!idea) return null;
        return <article key={match.ideaId} className="detail-section"><h3>{idea.title}</h3><p className="text-sm hackathon-fact-text">{match.reason}</p><p className="text-sm hackathon-fact-text mt-3">{match.adaptation}</p><button className="btn btn-secondary btn-sm mt-3" onClick={() => useIdea(idea, match.adaptation)}>Use this adaptation</button></article>;
      })}</div>}
    </section>
    {(row.sources?.registrationDeadline?.length || row.sources?.deadline?.length) > 0 && <section className="card mt-4"><h3>Deadline sources</h3>{['registrationDeadline', 'deadline'].map(key => <div className="hackathon-sources" key={key}>{row.sources?.[key]?.map((s, i) => <a key={i} href={officialUrl(s.url) || undefined} target="_blank" rel="noopener noreferrer">{EVENT_LABELS[key]} · {s.title} ↗</a>)}</div>)}</section>}
    {row.searchSuggestions && <iframe className="hackathon-search-suggestions mt-3" title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={row.searchSuggestions} />}
    </>}
    <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost btn-sm" onClick={() => update({ archived: !row.archived })}>{row.archived ? 'Restore hackathon' : 'Archive hackathon'}</button><button className="btn btn-ghost btn-sm" onClick={() => {
      if (!confirm(`Delete hackathon “${row.name}”?`)) return;
      dispatch({ type: 'DELETE_HACKATHON', id }); navigate('/hackathons');
    }}>Delete hackathon</button></div>
  </div>;
}
