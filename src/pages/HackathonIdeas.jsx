import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';

export default function HackathonIdeas() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const ideas = state.hackathonIdeas || [];
  const change = (key, value) => setEditing(current => ({ ...current, [key]: value }));
  return <div>
    <Link to="/hackathons" className="text-muted text-sm">← Hackathon Manager</Link>
    <div className="section-header hackathon-heading mt-3"><div><h1>Idea bank</h1><p className="text-muted">Keep the original idea here. Adapt it separately for each hackathon.</p></div><button className="btn btn-primary" onClick={() => setEditing({ id: uuid(), title: '', description: '', domains: '' })}>+ Add idea</button></div>
    {editing && <form className="card flex flex-col gap-3 mb-4" onSubmit={e => {
      e.preventDefault(); if (!editing.title.trim()) return;
      dispatch({ type: 'SAVE_HACKATHON_IDEA', payload: { ...editing, title: editing.title.trim(), description: editing.description.trim(), domains: editing.domains.trim() } }); setEditing(null);
    }}>
      <label className="form-group">Idea title<input autoFocus required maxLength={200} value={editing.title} onChange={e => change('title', e.target.value)} /></label>
      <label className="form-group">Original idea<textarea rows={5} maxLength={10000} value={editing.description} onChange={e => change('description', e.target.value)} /></label>
      <label className="form-group">Domains / tags<input maxLength={2000} placeholder="e.g. Health, education, AI" value={editing.domains} onChange={e => change('domains', e.target.value)} /></label>
      <div className="flex gap-2"><button className="btn btn-primary">Save idea</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}
    <input className="mb-4" aria-label="Search ideas" placeholder="Search your ideas…" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="hackathon-grid">{ideas.filter(idea => `${idea.title} ${idea.description} ${idea.domains}`.toLowerCase().includes(search.toLowerCase())).map(idea => <article className="card hackathon-tile" key={idea.id}>
      <h3>{idea.title}</h3><span className="text-xs text-muted">{idea.domains || 'No domains added'}</span><p className="text-sm hackathon-preview">{idea.description || 'No description yet.'}</p>
      <div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...idea })}>View / Edit</button><button className="btn btn-ghost btn-sm" onClick={() => {
        if (confirm(`Delete idea “${idea.title}”? Hackathon adaptations will be kept.`)) dispatch({ type: 'DELETE_HACKATHON_IDEA', id: idea.id });
      }}>Delete</button></div>
    </article>)}</div>
    {!ideas.length && <div className="card empty-state"><p>Add an idea once and reuse it across hackathons.</p></div>}
  </div>;
}
