import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { fmtDate, uuid } from '../store/utils.js';

function referencesFor(topics) {
  return topics.map(topic => ({
    id: topic.id, topicName: topic.topicName, date: topic.date,
    sessionType: topic.sessionType || 'lecture', subjectId: topic.subjectId,
    concepts: topic.concepts || [],
    reference: topic.ai_notes?.trim() || [...(topic.bullets || []), topic.notes || ''].filter(Boolean).join('\n'),
  }));
}

export default function ActiveRecall() {
  const { state, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognition = useRef(null);
  const inFlight = useRef(false);
  const sessions = state.recallSessions || [];
  const result = sessions.find(session => session.id === params.get('session'));
  const topics = state.topics || [];
  const chosen = topics.filter(topic => selected.includes(topic.id));
  const visible = topics.filter(topic => (!subject || topic.subjectId === subject) &&
    topic.topicName.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
  }, []);

  function speak() {
    if (listening) { recognition.current?.stop(); return; }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { setError('Speech input is unavailable in this browser. You can type your response.'); return; }
    const engine = new Speech();
    engine.continuous = true;
    engine.interimResults = false;
    engine.lang = 'en-IN';
    engine.onresult = event => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript + ' ';
      }
      setAnswer(previous => previous + ' ' + text);
    };
    engine.onend = () => setListening(false);
    engine.onerror = event => { setError('Speech input: ' + event.error); setListening(false); };
    recognition.current = engine;
    try { engine.start(); setListening(true); setError(''); }
    catch { setError('Could not start speech input. Please try again.'); }
  }

  async function grade(session) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const save = value => dispatch({ type: 'SAVE_RECALL_SESSION', payload: value });
    save(session);
    setDraft(null);
    setParams({ session: session.id });
    const available = session.lectures.filter(lecture => lecture.reference.trim());
    const missing = session.lectures.filter(lecture => !lecture.reference.trim()).map(lecture => lecture.topicName);
    const tags = [...new Set(session.lectures.flatMap(lecture => lecture.concepts))];
    const normalized = text => ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const tagMatch = tags.map(tag => ({ tag, covered: normalized(session.response).includes(normalized(tag)) }));
    const base = { ...session, tagMatch, missingReferences: missing };
    try {
      if (!available.length) throw new Error('No saved notes are available for these lectures. Your response is saved; AI assessment requires reference notes.');
      const response = await fetch('/api/active-recall', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: session.lectures.map(lecture => lecture.topicName).join('; '),
          recallText: session.response,
          aiNotes: available.map(lecture => lecture.topicName + ' (' + lecture.date + ', ' + lecture.sessionType + ')\n' + lecture.reference).join('\n\n'),
          concepts: tags,
        }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.feedback !== 'string' || !data.feedback.trim()) {
        throw new Error(data.error || 'Could not assess this session. Your response is saved; retry below.');
      }
      save({ ...base, status: 'complete', feedback: data.feedback, error: '', assessedAt: new Date().toISOString() });
    } catch (failure) {
      save({ ...base, status: 'failed', error: failure.message, feedback: '' });
    } finally { setBusy(false); inFlight.current = false; }
  }

  function submit() {
    if (!answer.trim() || !draft || listening) return;
    grade({ ...draft, response: answer.trim(), submittedAt: new Date().toISOString(), status: 'pending' });
  }

  return <div className="recall-page">
    <h1>Active Recall</h1>
    <p style={{ margin: '12px 0 24px' }}>Bring related lectures and labs together, then explain the topic from memory.</p>
    {draft ? <section className="card">
      <h2>Your recall session</h2>
      <p style={{ margin: '12px 0' }}>{draft.lectures.length} entries selected · Notes and feedback stay hidden until you submit.</p>
      <ul>{draft.lectures.map(lecture => <li key={lecture.id}>{lecture.topicName} · {fmtDate(lecture.date)} · {lecture.sessionType}</li>)}</ul>
      <label htmlFor="recall-answer" className="form-label" style={{ marginTop: 24 }}>What do you remember?</label>
      <textarea id="recall-answer" rows={12} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Explain the whole topic in your own words…" />
      {error && <p role="alert">{error}</p>}
      <div className="recall-controls">
        <button className="btn btn-secondary" onClick={speak}>{listening ? 'Stop speaking' : 'Speak your response'}</button>
        <button className="btn btn-primary" disabled={!answer.trim() || busy || listening} onClick={submit}>Finish & assess recall</button>
        <button className="btn btn-ghost" onClick={() => {
          if (answer.trim() && !window.confirm('Discard this unfinished response?')) return;
          recognition.current?.abort(); setDraft(null);
        }}>Cancel session</button>
      </div>
      {listening && <p role="status">Listening… Stop speaking before submitting.</p>}
    </section> : <>
      {result ? <section className="card">
        <h2>Session review</h2>
        <p>{new Date(result.submittedAt).toLocaleString()} · {result.status === 'complete' ? 'Assessed' : 'Assessment pending'}</p>
        <h3 style={{ marginTop: 24 }}>Lectures & labs</h3>
        <ul>{result.lectures.map(lecture => <li key={lecture.id}>
          {topics.some(topic => topic.id === lecture.id)
            ? <Link to={'/log?topicId=' + encodeURIComponent(lecture.id)}>{lecture.topicName}</Link>
            : <span>{lecture.topicName} (entry removed)</span>}
          {' · '}{fmtDate(lecture.date)} · {lecture.sessionType}
        </li>)}</ul>
        <h3 style={{ marginTop: 24 }}>Your response</h3>
        <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{result.response}</p>
        <h3 style={{ marginTop: 24 }}>Concept mentions</h3>
        <p className="text-muted">Keyword matches indicate mentions, not correctness.</p>
        <ul>{(result.tagMatch || []).map(item => <li key={item.tag}>{item.covered ? '✓ Mentioned' : '○ Not mentioned'}: {item.tag}</li>)}</ul>
        {!result.tagMatch?.length && <p>No concept tags were saved for these entries.</p>}
        <h3 style={{ marginTop: 24 }}>Feedback & points to improve</h3>
        {result.missingReferences?.length > 0 && <p role="status">Assessment excludes entries without notes: {result.missingReferences.join(', ')}.</p>}
        {busy ? <p role="status">Assessing your combined response…</p> : <>
          {result.feedback && <div style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{result.feedback}</div>}
          {result.error && <p role="alert">{result.error}</p>}
          {result.status !== 'complete' && <button className="btn btn-secondary" onClick={() => grade({
            ...result, lectures: result.lectures.map(lecture => {
              const latest = topics.find(topic => topic.id === lecture.id);
              return latest ? referencesFor([latest])[0] : lecture;
            }),
          })}>Retry assessment</button>}
        </>}
        <div className="recall-controls"><button className="btn btn-primary" disabled={busy} onClick={() => setParams({})}>New session</button></div>
      </section> : <section className="card">
        <h2>Select lectures & labs</h2>
        <div className="recall-controls">
          <input aria-label="Search lectures" placeholder="Search topic titles…" value={search} onChange={event => setSearch(event.target.value)} />
          <select aria-label="Filter by subject" value={subject} onChange={event => setSubject(event.target.value)}>
            <option value="">All subjects</option>
            {state.subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="recall-picker">
          {visible.map(topic => <label key={topic.id} className="recall-choice">
            <input type="checkbox" checked={selected.includes(topic.id)} onChange={event => setSelected(current => event.target.checked ? [...current, topic.id] : current.filter(id => id !== topic.id))} />
            <span>{topic.topicName}<small>{state.subjects.find(item => item.id === topic.subjectId)?.name} · {fmtDate(topic.date)} · {topic.sessionType || 'lecture'}</small></span>
          </label>)}
          {!visible.length && <p>No lectures match. Log a lecture first or change the filters.</p>}
        </div>
        <div className="recall-controls">
          <button className="btn btn-primary" disabled={!chosen.length} onClick={() => {
            setDraft({ id: uuid(), startedAt: new Date().toISOString(), lectures: referencesFor(chosen) });
            setAnswer(''); setError('');
          }}>Start session ({chosen.length} selected)</button>
        </div>
      </section>}
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Session history</h2>
        {!sessions.length && <p>Your submitted sessions and improvement points will appear here.</p>}
        {[...sessions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(session => <Link
          className="recall-history-link" key={session.id} to={'/recall?session=' + session.id}
          onClick={event => { if (busy) event.preventDefault(); }}
        >{session.lectures.map(lecture => lecture.topicName).join(' + ')}
          <small>{new Date(session.submittedAt).toLocaleString()} · {session.status === 'complete' ? 'View feedback & improvements' : 'Response saved · assessment pending'}</small>
        </Link>)}
      </section>
    </>}
  </div>;
}
