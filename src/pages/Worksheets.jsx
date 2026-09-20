import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { today, uuid, fmtDate } from '../store/utils.js';
import { WORKSHEET_STATUSES, validateWorksheet } from '../store/worksheets.js';

export default function Worksheets() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const rows = [...(state.worksheets || [])].filter(w => filter === 'all' || w.status === filter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const change = (key, value) => setEditing(w => ({ ...w, [key]: value }));
  return <div>
    <div className="flex justify-between items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
      <div><h1>Worksheet Tracker</h1><p>One place for assignments, grades and what to practise next.</p></div>
      <button className="btn btn-primary" onClick={() => { setError(''); setEditing({ id: uuid(), subjectId: state.subjects[0]?.id || '', name: '', assignedDate: today(), dueDate: today(), status: 'not started', grade: '', wrongNote: '' }); }}>+ Add Worksheet</button>
    </div>
    {editing && <form className="card flex flex-col gap-4 mb-4" onSubmit={e => {
      e.preventDefault(); const message = validateWorksheet(editing); setError(message); if (message) return;
      dispatch({ type: 'SAVE_WORKSHEET', payload: { ...editing, name: editing.name.trim() } }); setEditing(null);
    }}>
      <h2>{(state.worksheets || []).some(w => w.id === editing.id) ? 'Edit worksheet' : 'New worksheet'}</h2>
      {!state.subjects.length && <p>Add a course in <Link to="/settings">Settings → Subjects</Link> first.</p>}
      <div className="form-row form-row-2">
        <label className="form-group">Subject / course<select required value={editing.subjectId} onChange={e => change('subjectId', e.target.value)}><option value="">Choose subject</option>{state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="form-group">Worksheet name<input required maxLength={200} value={editing.name} onChange={e => change('name', e.target.value)} /></label>
        <label className="form-group">Assigned date<input type="date" required value={editing.assignedDate} onChange={e => change('assignedDate', e.target.value)} /></label>
        <label className="form-group">Due date<input type="date" required min={editing.assignedDate} value={editing.dueDate} onChange={e => change('dueDate', e.target.value)} /></label>
        <label className="form-group">Status<select value={editing.status} onChange={e => change('status', e.target.value)}>{WORKSHEET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        {editing.status === 'graded' && <label className="form-group">Grade<input required placeholder="e.g. 18/20 or A" maxLength={80} value={editing.grade} onChange={e => change('grade', e.target.value)} /></label>}
      </div>
      {editing.status === 'graded' && <label className="form-group">What I got wrong (optional)<textarea maxLength={2000} rows={3} value={editing.wrongNote} onChange={e => change('wrongNote', e.target.value)} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="flex gap-3"><button className="btn btn-primary">Save worksheet</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}
    <label className="form-group" style={{ maxWidth: 250, marginBottom: 20 }}>Filter by status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All worksheets</option>{WORKSHEET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
    <div className="flex flex-col gap-3">{rows.map(w => <article className="card" key={w.id}>
      <div className="flex justify-between gap-3"><div><span className="text-muted text-sm">{state.subjects.find(s => s.id === w.subjectId)?.name || 'Archived subject'}</span><h3>{w.name}</h3></div><span className="badge badge-accent">{w.status}</span></div>
      <p className="text-sm" style={{ marginTop: 12 }}>Assigned {fmtDate(w.assignedDate)} · Due {fmtDate(w.dueDate)}{w.dueDate < today() && ['not started', 'in progress'].includes(w.status) ? ' · Overdue' : ''}</p>
      {w.status === 'graded' && <div style={{ marginTop: 12 }}><strong>Grade: {w.grade}</strong>{w.wrongNote && <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>What I got wrong: {w.wrongNote}</p>}</div>}
      <div className="flex gap-2" style={{ marginTop: 16 }}><button className="btn btn-secondary btn-sm" onClick={() => { setEditing({ ...w }); setError(''); }}>Edit</button><button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Delete worksheet “${w.name}”?`)) dispatch({ type: 'DELETE_WORKSHEET', id: w.id }); }}>Delete</button></div>
    </article>)}{!rows.length && <div className="card"><p>No worksheets here yet. Add one when it’s assigned.</p></div>}</div>
  </div>;
}
