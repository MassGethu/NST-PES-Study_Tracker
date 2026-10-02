import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { uuid } from '../store/utils.js';
import { newHackathon, validateHackathon, sortedHackathons, formatDeadline, hackathonDeadline, officialUrl } from '../store/hackathons.js';
import { previewHackathonImport } from '../store/hackathonImport.js';

export default function Hackathons() {
  const { state, dispatch, researchHackathon, researchingHackathons, account } = useStore();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('current');
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importReport, setImportReport] = useState(null);
  const all = state.hackathons || [];
  async function selectWorkbook(file) {
    setImportError(''); setImportReport(null);
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return setImportError('Choose an .xlsx Excel workbook.');
    if (file.size > 5_000_000) return setImportError('Choose an Excel workbook smaller than 5 MB.');
    setImporting(true);
    try {
      const { default: readExcelFile } = await import('read-excel-file/browser');
      const sheets = await readExcelFile(file);
      let selected;
      for (const sheet of sheets) {
        try {
          const preview = previewHackathonImport(sheet.data, all);
          selected = { name: sheet.sheet, matrix: sheet.data, preview };
          break;
        } catch (error) {
          if (!/Could not find Name and Official URL/.test(error.message)) throw error;
        }
      }
      if (!selected) throw new Error('No sheet has Name and Official URL columns.');
      if (selected.matrix.length > 1001) throw new Error('Import at most 1,000 spreadsheet rows at a time.');
      if (selected.preview.added.length) dispatch({ type: 'IMPORT_HACKATHONS', payload: selected.preview.added });
      setImportReport({ name: selected.name, ...selected.preview });
    } catch (error) { setImportError(error.message || 'Could not read this Excel workbook.'); }
    finally { setImporting(false); }
  }
  const rows = sortedHackathons(all, filter === 'archived').filter(row =>
    (filter !== 'submitted' || row.status === 'Submitted') &&
    (filter !== 'current' || row.status !== 'Submitted') &&
    `${row.name} ${row.domains || ''}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="hackathon-manager">
    <div className="section-header hackathon-heading">
      <div><h1>Hackathon Manager</h1><p className="text-muted">Capture an opportunity now. Decide what to build when you have time.</p></div>
      <div className="flex gap-2"><Link className="btn btn-secondary" to="/hackathons/ideas">💡 Idea bank</Link><button className="btn btn-secondary" onClick={() => setImportOpen(open => !open)}>Import Excel</button><button className="btn btn-primary" onClick={() => { setAdding(true); setError(''); }}>+ Add Hackathon</button></div>
    </div>
    {importOpen && <section className="card mb-4" aria-label="Import hackathons from Excel">
      <h2 className="mb-3">Import discovered hackathons</h2>
      <p className="text-muted text-sm mb-3">Upload your scheduled .xlsx sheet to save new hackathons automatically. Existing hackathons and repeated rows are skipped; imported details can be edited afterward. Gemini is not needed for fields already in the sheet.</p>
      <label className="form-group">Excel workbook<input type="file" disabled={importing} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { selectWorkbook(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {importing && <p role="status">Reading workbook…</p>}
      {importError && <p className="form-error" role="alert">{importError}</p>}
      {importReport && <div className="mt-3">
        <p role="status"><strong>{importReport.added.length} imported</strong> · {importReport.skipped.length} skipped · Sheet: {importReport.name}</p>
        {importReport.added.length > 0 && <ul className="text-sm mt-3">{importReport.added.slice(0, 12).map(row => <li key={row.id}>{row.name} · registration {formatDeadline(row.registrationDeadline)} · submission {formatDeadline(row.deadline)}</li>)}{importReport.added.length > 12 && <li>…and {importReport.added.length - 12} more</li>}</ul>}
        {importReport.skipped.length > 0 && <details className="mt-3"><summary>Review skipped rows</summary><ul className="text-sm mt-3">{importReport.skipped.map(item => <li key={item.line}>Row {item.line}: {item.name} — {item.reason}</li>)}</ul></details>}
      </div>}
    </section>}
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
      <div className="flex gap-2"><button className="btn btn-primary">Save & AI autofill</button><button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button></div>
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
