/**
 * LogLecturePage.jsx
 * Full-page form at /lecture/new for logging a lecture entry.
 * Required: subject, topic name, at least one learning bullet.
 * Optional: date, session type, concepts, difficulty, understood %, 
 *           contest relevance, NotebookLM link, photos, voice recording.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { today } from '../store/utils.js';

// ── Photo helpers (canvas-compress to 800px JPEG 70%) ─────────────────────
function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Format seconds to MM:SS ────────────────────────────────────────────────
function fmtSecs(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Difficulty label ───────────────────────────────────────────────────────
const DIFF_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

export default function LogLecturePage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const subjects = state.subjects || [];
  const defaultSubjectId = searchParams.get('subjectId') || subjects[0]?.id || '';

  // ── Form state ─────────────────────────────────────────────────────────
  const [subjectId, setSubjectId]       = useState(defaultSubjectId);
  const [sessionType, setSessionType]   = useState('lecture');
  const [topicName, setTopicName]       = useState('');
  const [date, setDate]                 = useState(today());
  const [bullets, setBullets]           = useState(['', '', '']);
  const [concepts, setConcepts]         = useState('');
  const [difficulty, setDifficulty]     = useState(3);
  const [understoodPct, setUnderstood]  = useState(70);
  const [contestRel, setContestRel]     = useState('Medium');
  const [needsRevision, setNeedsRevision] = useState(true);
  const [notebookLink, setNotebook]     = useState('');
  const [errors, setErrors]             = useState({});

  // ── Photo state ────────────────────────────────────────────────────────
  const [photos, setPhotos]             = useState([]);
  const [compressing, setCompressing]   = useState(false);
  const [lightboxImg, setLightboxImg]   = useState(null);
  const photoInputRef = useRef(null);

  // ── Audio state ────────────────────────────────────────────────────────
  const [audio, setAudio]               = useState(null);
  const [recording, setRecording]       = useState(false);
  const [recordTime, setRecordTime]     = useState(0);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioUploadRef = useRef(null);

  // ── Submission state ───────────────────────────────────────────────────
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Subject colour for accent
  const subject = subjects.find(s => s.id === subjectId);
  const accentColor = subject?.color || 'var(--accent)';
  const pctColor = understoodPct >= 70 ? 'var(--green)' : understoodPct >= 40 ? 'var(--yellow)' : 'var(--red)';

  // ── Bullet helpers ─────────────────────────────────────────────────────
  function setBullet(idx, val) {
    setBullets(prev => prev.map((b, i) => i === idx ? val : b));
  }
  function addBullet() {
    if (bullets.length < 6) setBullets(prev => [...prev, '']);
  }
  function removeBullet(idx) {
    if (bullets.length <= 1) return;
    setBullets(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Photo upload ───────────────────────────────────────────────────────
  async function handlePhotoFiles(files) {
    if (!files.length) return;
    setCompressing(true);
    const compressed = await Promise.all(Array.from(files).map(compressPhoto));
    setPhotos(prev => [...prev, ...compressed]);
    setCompressing(false);
  }

  function handlePhotoInput(e) { handlePhotoFiles(e.target.files); }

  function handlePhotoDrop(e) {
    e.preventDefault();
    handlePhotoFiles(e.dataTransfer.files);
  }

  // ── Voice recording ────────────────────────────────────────────────────
  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        const chunks = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => setAudio(reader.result);
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        setRecordTime(0);
        timerRef.current = setInterval(() => setRecordTime(p => p + 1), 1000);
        mr.start();
        setRecording(true);
      })
      .catch(() => alert('Microphone access denied. Check browser permissions.'));
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }

  async function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAudio(reader.result);
    reader.readAsDataURL(file);
  }

  // ── Validate + submit ─────────────────────────────────────────────────
  function validate() {
    const errs = {};
    if (!subjectId) errs.subjectId = 'Required';
    if (!topicName.trim()) errs.topicName = 'Required';
    const nonEmpty = bullets.filter(b => b.trim());
    if (nonEmpty.length === 0) errs.bullets = 'At least one learning bullet is required';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);

    const cleanBullets = bullets.map(b => b.trim()).filter(Boolean);
    const cleanConcepts = concepts.split(',').map(c => c.trim()).filter(Boolean);

    dispatch({
      type: 'ADD_TOPIC',
      payload: {
        subjectId,
        sessionType,
        topicName: topicName.trim(),
        date,
        bullets: cleanBullets,
        concepts: cleanConcepts,
        difficulty: Number(difficulty),
        understoodPct: Number(understoodPct),
        confidence: Math.max(1, Math.min(5, Math.round(Number(understoodPct) / 20))),
        contestRelevance: contestRel,
        notebookLink: notebookLink.trim(),
        needsRevision,
        photos,
        audio,
        ai_notes: null,   // generated later via "Generate AI Notes" in detail view
      },
    });

    navigate('/log');
  }

  return (
    <div className="log-lecture-page">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="log-lecture-header">
        <div>
          <Link to="/log" className="log-back-link">← Back to Lecture Log</Link>
          <h1 style={{ marginTop: 'var(--space-2)' }}>Log a Lecture</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Record what you learned today. Required fields are marked with *.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="log-lecture-form">

        {/* ── Section 1: Core info ─────────────────────────────────── */}
        <div className="log-section" style={{ borderColor: accentColor + '44' }}>
          <div className="log-section-title" style={{ color: accentColor }}>
            📚 Lecture Details
          </div>

          <div className="form-row form-row-2">
            {/* Subject */}
            <div className="form-group">
              <label className="form-label">Subject *</label>
              {subjects.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--yellow)', padding: 'var(--space-3)' }}>
                  No subjects yet — <Link to="/settings" style={{ color: 'var(--accent)' }}>add them in Settings</Link>
                </div>
              ) : (
                <select value={subjectId} onChange={e => { setSubjectId(e.target.value); setErrors(x => ({ ...x, subjectId: undefined })); }} id="ll-subject">
                  <option value="">— Select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {errors.subjectId && <span className="field-error">{errors.subjectId}</span>}
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} id="ll-date" />
            </div>
          </div>

          {/* Session type */}
          <div className="form-group">
            <label className="form-label">Session Type</label>
            <div className="session-toggle">
              <button
                type="button"
                className={`session-btn${sessionType === 'lecture' ? ' active' : ''}`}
                onClick={() => setSessionType('lecture')}
                style={{ '--session-color': '#3b82f6' }}
              >
                📚 Lecture
              </button>
              <button
                type="button"
                className={`session-btn${sessionType === 'lab' ? ' active' : ''}`}
                onClick={() => setSessionType('lab')}
                style={{ '--session-color': '#8b5cf6' }}
              >
                🔬 Lab
              </button>
            </div>
          </div>

          {/* Topic name */}
          <div className="form-group">
            <label className="form-label">Topic Name *</label>
            <input
              type="text"
              placeholder="e.g. Binary Search, Integration by Parts, React Hooks…"
              value={topicName}
              onChange={e => { setTopicName(e.target.value); setErrors(x => ({ ...x, topicName: undefined })); }}
              id="ll-topic"
              autoFocus
              style={{ fontSize: '1rem' }}
            />
            {errors.topicName && <span className="field-error">{errors.topicName}</span>}
          </div>
        </div>

        {/* ── Section 2: Learning bullets ──────────────────────────── */}
        <div className="log-section">
          <div className="log-section-title">✍️ What did I actually learn?  *</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', marginTop: -8 }}>
            Write 1–6 key takeaways from this session in your own words.
          </p>
          {errors.bullets && <span className="field-error" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>{errors.bullets}</span>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {bullets.map((b, idx) => (
              <div key={idx} className="bullet-row">
                <span className="bullet-num">{idx + 1}</span>
                <input
                  type="text"
                  placeholder={idx === 0 ? 'Key takeaway #1…' : `Takeaway #${idx + 1}…`}
                  value={b}
                  onChange={e => { setBullet(idx, e.target.value); setErrors(x => ({ ...x, bullets: undefined })); }}
                  id={`ll-bullet-${idx}`}
                />
                {bullets.length > 1 && (
                  <button type="button" className="bullet-remove" onClick={() => removeBullet(idx)} title="Remove">×</button>
                )}
              </div>
            ))}
          </div>

          {bullets.length < 6 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addBullet} style={{ marginTop: 'var(--space-2)', color: 'var(--text-accent)' }}>
              + Add another bullet
            </button>
          )}
        </div>

        {/* ── Section 3: Optional metadata ─────────────────────────── */}
        <div className="log-section">
          <div className="log-section-title">🏷️ Tags &amp; Metadata <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>optional</span></div>

          {/* Understood % */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>How well did I understand?</span>
              <span style={{ color: pctColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{understoodPct}%</span>
            </label>
            <input
              type="range" min="0" max="100" step="5"
              value={understoodPct}
              onChange={e => setUnderstood(Number(e.target.value))}
              id="ll-understood"
              className="understood-slider"
              style={{ accentColor: pctColor }}
            />
            <div className="slider-labels">
              <span>Not at all</span><span>Getting it</span><span>Solid</span>
            </div>
          </div>

          <div className="form-row form-row-3">
            {/* Difficulty */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Difficulty</span><span style={{ color: 'var(--text-accent)' }}>{'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}</span>
              </label>
              <input
                type="range" min="1" max="5" step="1"
                value={difficulty}
                onChange={e => setDifficulty(Number(e.target.value))}
                id="ll-difficulty"
                style={{ padding: 0, border: 'none', background: 'none', accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{DIFF_LABELS[difficulty]}</span>
            </div>

            {/* Contest relevance */}
            <div className="form-group">
              <label className="form-label">Contest Relevance</label>
              <select value={contestRel} onChange={e => setContestRel(e.target.value)} id="ll-relevance">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>

            {/* Needs revision */}
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label className="form-label">Revision</label>
              <label style={{
                padding: 'var(--space-2) var(--space-3)',
                background: needsRevision ? 'var(--green-dim)' : 'var(--bg-elevated)',
                color: needsRevision ? 'var(--green)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              }}>
                <input type="checkbox" checked={needsRevision} onChange={e => setNeedsRevision(e.target.checked)} />
                Schedule revision
              </label>
            </div>
          </div>

          {/* Concepts */}
          <div className="form-group">
            <label className="form-label">Concepts / Tags <span className="tag-hint">(comma-separated)</span></label>
            <input
              type="text"
              placeholder="e.g. recursion, memoization, dynamic programming"
              value={concepts}
              onChange={e => setConcepts(e.target.value)}
              id="ll-concepts"
            />
            {concepts && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                {concepts.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                  <span key={c} className="badge badge-muted">{c}</span>
                ))}
              </div>
            )}
          </div>

          {/* NotebookLM link */}
          <div className="form-group">
            <label className="form-label">
              NotebookLM / Reference Link
              <span className="tag-hint"> — paste any URL or notes reference</span>
            </label>
            <input
              type="url"
              placeholder="https://notebooklm.google.com/…"
              value={notebookLink}
              onChange={e => setNotebook(e.target.value)}
              id="ll-notebook"
            />
          </div>
        </div>

        {/* ── Section 4: Photos ─────────────────────────────────────── */}
        <div className="log-section">
          <div className="log-section-title">
            📸 Handwritten Notes Photos
            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>optional — used for AI summary</span>
          </div>

          {/* Drop zone */}
          <div
            className="photo-drop-zone"
            onDragOver={e => e.preventDefault()}
            onDrop={handlePhotoDrop}
            onClick={() => photoInputRef.current?.click()}
          >
            <span className="photo-drop-icon">📷</span>
            <span className="photo-drop-text">Drop photos here or click to select</span>
            <span className="photo-drop-sub">Multiple files OK • JPG, PNG, HEIC</span>
            <input
              ref={photoInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoInput}
              style={{ display: 'none' }}
            />
          </div>

          {compressing && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-accent)', marginTop: 'var(--space-2)' }}>
              ⏳ Compressing images…
            </p>
          )}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginTop: 'var(--space-3)' }}>
              {photos.map((photo, idx) => (
                <div key={idx} className="photo-thumb" onClick={() => setLightboxImg(photo)}>
                  <img src={photo} alt={`Notes ${idx + 1}`} />
                  <button
                    type="button"
                    className="photo-thumb-del"
                    onClick={e => { e.stopPropagation(); setPhotos(p => p.filter((_, i) => i !== idx)); }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 5: Voice recording ────────────────────────────── */}
        <div className="log-section">
          <div className="log-section-title">
            🎙️ Voice Recap
            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>optional — used for AI summary</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', marginTop: -8 }}>
            Record yourself explaining what you learned — great for AI note generation.
          </p>

          <div className="voice-controls">
            {!audio && !recording && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={startRecording}>
                  🎤 Record Voice Recap
                </button>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                  📁 Upload Audio File
                  <input
                    ref={audioUploadRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}

            {recording && (
              <div className="recording-indicator">
                <span className="rec-dot" />
                <span className="rec-label">Recording: {fmtSecs(recordTime)}</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={stopRecording}>
                  ⏹ Stop
                </button>
              </div>
            )}

            {audio && !recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <audio src={audio} controls style={{ height: 36, flex: 1, minWidth: 220 }} />
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setAudio(null)}>
                  🗑 Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="log-lecture-actions">
          <Link to="/log" className="btn btn-ghost">Cancel</Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !subjectId}
            style={{ minWidth: 160 }}
          >
            {submitting ? 'Saving…' : '💾 Save Lecture Entry'}
          </button>
        </div>

      </form>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightboxImg && (
        <div
          className="modal-backdrop"
          onClick={() => setLightboxImg(null)}
          style={{ zIndex: 200, background: 'rgba(0,0,0,0.95)' }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
            <img src={lightboxImg} alt="Note enlarged" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
            <button
              className="btn btn-ghost"
              onClick={() => setLightboxImg(null)}
              style={{ position: 'absolute', top: -40, right: 0, color: 'white', fontSize: '2rem' }}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}
