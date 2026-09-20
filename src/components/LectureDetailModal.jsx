import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { confidenceLabel, fmtDate, understoodStatus } from '../store/utils.js';

export default function LectureDetailModal({ topicId, onClose }) {
  const { state, dispatch, isWorksheet } = useStore();
  const topic = (state.topics || []).find(t => t.id === topicId);
  const subject = (state.subjects || []).find(s => s.id === topic?.subjectId);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lightboxImg, setLightboxImg] = useState(null);

  if (!topic) return null;
  const status = understoodStatus(topic.understoodPct);
  const notebookLink = topic.notebookLink || (topic.notes?.startsWith('http') ? topic.notes : '');

  async function generateAiNotes() {
    setAiLoading(true);
    setAiError('');
    try {
      const response = await fetch('/api/ai-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: topic.topicName,
          subject: subject?.name || '',
          bullets: topic.bullets || [],
          concepts: topic.concepts || [],
          notes: topic.notes || '',
          photos: topic.photos || [],
          audio: topic.audio || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate AI notes.');
      dispatch({ type: 'UPDATE_TOPIC', id: topic.id, payload: { ai_notes: data.summary } });
    } catch (error) {
      setAiError(error.message || 'Could not generate AI notes.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal slide-up" onClick={event => event.stopPropagation()} style={{ maxWidth: 860, width: '95%' }}>
        <div className="modal-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.4rem' }}>{topic.topicName}</h2>
              {subject && <span className="badge" style={{ background: `${subject.color}22`, color: subject.color }}>{subject.name}</span>}
            </div>
            <p className="text-secondary text-sm">Logged on {fmtDate(topic.date)}</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ fontSize: '1.5rem' }}>×</button>
        </div>

        <div className="flex flex-col gap-5" style={{ paddingBottom: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius)' }}>
            <Stat label="Understanding" value={`${status.label} ${topic.understoodPct}%`} />
            <Stat label="Difficulty" value={`${'★'.repeat(topic.difficulty || 1)}${'☆'.repeat(5 - (topic.difficulty || 1))}`} />
            {!isWorksheet && <Stat label="Contest relevance" value={topic.contestRelevance || 'Medium'} />}
            <Stat label="Confidence" value={`${topic.confidence || 3}/5 · ${confidenceLabel(topic.confidence || 3)}`} />
          </div>

          <section className="detail-section">
            <h3>📝 Your notes</h3>
            {(topic.concepts || []).length > 0 && <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>{topic.concepts.map(concept => <span key={concept} className="badge badge-muted">{concept}</span>)}</div>}
            {(topic.bullets || []).length > 0 ? <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{topic.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul> : <p className="text-muted text-sm">No learning bullets saved.</p>}
            {topic.notes && !topic.notes.startsWith('http') && <p style={{ marginTop: 'var(--space-3)', whiteSpace: 'pre-wrap' }}>{topic.notes}</p>}
            {notebookLink && <p style={{ marginTop: 'var(--space-3)' }}><a href={notebookLink} target="_blank" rel="noreferrer" style={{ color: 'var(--text-accent)' }}>Open NotebookLM / reference link ↗</a></p>}
          </section>

          {(topic.photos?.length > 0 || topic.audio) && <section className="detail-section">
            <h3>📎 Attached source material</h3>
            {topic.photos?.length > 0 && <div className="photo-grid" style={{ marginBottom: topic.audio ? 'var(--space-3)' : 0 }}>{topic.photos.map((photo, index) => <button key={index} className="photo-thumb" onClick={() => setLightboxImg(photo)} aria-label={`Open note photo ${index + 1}`}><img src={photo} alt={`Lecture note ${index + 1}`} /></button>)}</div>}
            {topic.audio && <audio src={topic.audio} controls style={{ width: '100%', height: 38 }} />}
          </section>}

          <section className="detail-section">
            <div className="flex justify-between items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div><h3>✨ AI notes</h3><p className="text-muted text-sm">Generated from your bullets, photos, and voice recap in one multimodal request.</p></div>
              <button className="btn btn-primary btn-sm" onClick={generateAiNotes} disabled={aiLoading}>{aiLoading ? 'Generating…' : topic.ai_notes ? 'Regenerate AI Notes' : 'Generate AI Notes'}</button>
            </div>
            {aiError && <div className="form-error" style={{ marginTop: 'var(--space-3)' }}>{aiError}</div>}
            {topic.ai_notes ? <div className="ai-notes-output" style={{ marginTop: 'var(--space-3)', whiteSpace: 'pre-wrap' }}>{topic.ai_notes}</div> : <p className="text-muted text-sm" style={{ marginTop: 'var(--space-3)' }}>No AI notes generated yet. Your original notes will never be overwritten.</p>}
          </section>

          <section className="detail-section">
            <h3>Recall history</h3>
            {(state.recallSessions || []).filter(session => session.lectures.some(lecture => lecture.id === topic.id)).map(session =>
              <Link key={session.id} className="recall-history-link" to={'/recall?session=' + session.id} onClick={onClose}>
                {new Date(session.submittedAt).toLocaleString()} · {session.lectures.length} entries
                <small>View saved response, feedback and improvement points</small>
              </Link>
            )}
            <Link className="btn btn-secondary" to="/recall" onClick={onClose}>Open Active Recall</Link>
          </section>


        </div>
      </div>

      {lightboxImg && <div className="modal-backdrop" onClick={event => { event.stopPropagation(); setLightboxImg(null); }} style={{ zIndex: 200, background: 'rgba(0,0,0,.95)' }}><img src={lightboxImg} alt="Lecture note enlarged" onClick={event => event.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain' }} /></div>}
    </div>
  );
}

function Stat({ label, value }) {
  return <div><div className="text-muted text-sm">{label}</div><div style={{ fontWeight: 700, marginTop: 2 }}>{value}</div></div>;
}
