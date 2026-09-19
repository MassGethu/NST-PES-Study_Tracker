import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import ConfidenceGauge from '../components/ConfidenceGauge.jsx';
import SubjectChip from '../components/SubjectChip.jsx';
import { getMondayOf, today, fmtDate, understoodStatus, addDays } from '../store/utils.js';

export default function ContestTracker() {
  const { state, dispatch, derived } = useStore();
  const { activeContest, getContestTopics, getContestConfidence } = derived;

  const subjects = state.subjects || [];
  const [mistakeText, setMistakeText] = useState('');
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideVal, setOverrideVal] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionForm, setCompletionForm] = useState({ score: '', notes: '', learnings: '' });
  const [weekStart, setWeekStart] = useState(
    activeContest?.weekStart || getMondayOf(today())
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeContest?.subjectId || '');

  const currentWeek = state.contestWeeks?.find(w =>
    w.weekStart === weekStart && w.subjectId === selectedSubjectId
  ) || null;
  const currentSubject = subjects.find(s => s.id === currentWeek?.subjectId);
  const contestTopics = getContestTopics(currentWeek);
  const computedConf = getContestConfidence(contestTopics);
  const displayConf = currentWeek?.manualConfidenceOverride ?? computedConf;

  const sortedTopics = [...contestTopics].sort((a, b) => (a.understoodPct || 0) - (b.understoodPct || 0));

  // Past completed contests
  const pastContests = (state.contestWeeks || [])
    .filter(w => w.completed)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const displayedPastContests = pastContests.filter(p => p.id !== currentWeek?.id);

  function setSubject(subjectId) {
    setSelectedSubjectId(subjectId);
    dispatch({ type: 'SET_CONTEST_WEEK', payload: { weekStart, subjectId } });
  }

  function addMistake() {
    const t = mistakeText.trim();
    if (!t || !currentWeek) return;
    dispatch({ type: 'ADD_MISTAKE', id: currentWeek.id, weekStart: currentWeek.weekStart, subjectId: currentWeek.subjectId, text: t });
    setMistakeText('');
  }

  function adjustProblems(delta) {
    if (!currentWeek) return;
    dispatch({
      type: 'UPDATE_CONTEST_WEEK',
      id: currentWeek.id,
      weekStart: currentWeek.weekStart,
      subjectId: currentWeek.subjectId,
      payload: { problemsSolved: Math.max(0, (currentWeek.problemsSolved || 0) + delta) },
    });
  }

  function applyOverride() {
    const n = parseInt(overrideVal, 10);
    if (isNaN(n) || n < 0 || n > 100) return;
    dispatch({
      type: 'UPDATE_CONTEST_WEEK',
      id: currentWeek.id,
      weekStart: currentWeek.weekStart,
      subjectId: currentWeek.subjectId,
      payload: { manualConfidenceOverride: n },
    });
    setOverrideMode(false);
  }

  function clearOverride() {
    dispatch({
      type: 'UPDATE_CONTEST_WEEK',
      id: currentWeek.id,
      weekStart: currentWeek.weekStart,
      subjectId: currentWeek.subjectId,
      payload: { manualConfidenceOverride: null },
    });
    setOverrideMode(false);
  }

  function handleCompleteContest(e) {
    e.preventDefault();
    if (!currentWeek) return;
    dispatch({
      type: 'COMPLETE_CONTEST',
      payload: {
        weekStart: currentWeek.weekStart,
        id: currentWeek.id,
        subjectId: currentWeek.subjectId,
        score: completionForm.score.trim(),
        contestNotes: completionForm.notes.trim(),
        keyLearnings: completionForm.learnings.trim(),
        topicsCovered: contestTopics.map(t => t.id),
      },
    });
    setShowCompleteModal(false);
  }

  function handleReopenContest() {
    if (!currentWeek) return;
    dispatch({ type: 'REOPEN_CONTEST', id: currentWeek.id, weekStart: currentWeek.weekStart, subjectId: currentWeek.subjectId });
  }

  // Week navigation
  function shiftWeek(delta) {
    const nextWeek = addDays(weekStart, delta * 7);
    const nextContest = (state.contestWeeks || [])
      .filter(contest => contest.weekStart === nextWeek)
      .sort((a, b) => (b.selectedAt || '').localeCompare(a.selectedAt || ''))[0];
    setWeekStart(nextWeek);
    setSelectedSubjectId(nextContest?.subjectId || '');
  }

  const thisFriday = addDays(weekStart, 4);

  return (
    <div>
      <div className="section-header mb-4" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1>Contest Tracker</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Prepare for recurring subject contests, track problems & review past performance
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn btn-ghost btn-sm" onClick={() => shiftWeek(-1)}>← Prev Week</button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Week of {fmtDate(weekStart)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftWeek(1)}>Next Week →</button>
        </div>
      </div>

      {/* Subject picker */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">📅 This Friday's Subject</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtDate(thisFriday)}</span>
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          {subjects.map(s => (
            <button
              key={s.id}
              className={`btn ${selectedSubjectId === s.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSubject(s.id)}
              style={selectedSubjectId === s.id ? { background: s.color, boxShadow: `0 0 16px ${s.color}44` } : {}}
            >
              {s.name}
            </button>
          ))}
          {subjects.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add subjects in Settings first.</p>
          )}
        </div>
      </div>

      {!currentWeek ? (
        <div className="empty-state card mb-6">
          <span className="es-icon">🎯</span>
          <span className="es-text">Select a subject above to start tracking this week's contest.</span>
        </div>
      ) : currentWeek.completed ? (
        /* Completed Contest State Banner & Details */
        <div className="card mb-6" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="flex items-center justify-between mb-3" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '1.5rem' }}>🏆</span>
              <div>
                <h3 style={{ margin: 0 }}>
                  Contest Completed — {currentSubject?.name || 'Contest'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Completed on {fmtDate(currentWeek.completedAt || today())} · Week of {fmtDate(weekStart)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={handleReopenContest}>
                ↺ Edit / Reopen
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => shiftWeek(4)}>
                + Plan Next Contest Cycle →
              </button>
            </div>
          </div>

          <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
            {currentWeek.score && (
              <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Score / Rank</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>{currentWeek.score}</span>
              </div>
            )}
            <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Problems Solved</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--green)' }}>{currentWeek.problemsSolved || 0}</span>
            </div>
            <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Topics Tested</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{contestTopics.length}</span>
            </div>
          </div>

          {currentWeek.contestNotes && (
            <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>📝 Reflection & Notes:</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{currentWeek.contestNotes}</div>
            </div>
          )}

          {currentWeek.keyLearnings && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>💡 Key Learnings for Next Contest:</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{currentWeek.keyLearnings}</div>
            </div>
          )}
        </div>
      ) : (
        /* Active Contest Tracking Dashboard */
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 p-3" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Active Contest Prep: {currentSubject?.name}</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {contestTopics.length} new topics in syllabus for this contest cycle
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setCompletionForm({
                  score: currentWeek.score || '',
                  notes: currentWeek.contestNotes || '',
                  learnings: currentWeek.keyLearnings || '',
                });
                setShowCompleteModal(true);
              }}
            >
              🏁 Complete Contest for this Week
            </button>
          </div>

          <div className="dashboard-grid">

            {/* Confidence block */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📊 Contest Confidence</span>
                {currentWeek.manualConfidenceOverride !== null && (
                  <span className="badge badge-yellow">Manual override</span>
                )}
              </div>
              <div className="flex items-center gap-5" style={{ marginBottom: 'var(--space-4)' }}>
                <ConfidenceGauge pct={displayConf} size={90} label="Confidence" />
                <div style={{ flex: 1 }}>
                  {currentWeek.manualConfidenceOverride !== null && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      Computed: {computedConf}% → overridden to {currentWeek.manualConfidenceOverride}%
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {contestTopics.length} topics in cycle · weighted avg
                    <br />(High=3×, Med=2×, Low=1×)
                  </div>
                </div>
              </div>

              {overrideMode ? (
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" max="100" placeholder="0–100"
                    value={overrideVal} onChange={e => setOverrideVal(e.target.value)}
                    style={{ width: 80 }} />
                  <button className="btn btn-primary btn-sm" onClick={applyOverride}>Set</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setOverrideMode(false)}>Cancel</button>
                  {currentWeek.manualConfidenceOverride !== null && (
                    <button className="btn btn-danger btn-sm" onClick={clearOverride}>Clear override</button>
                  )}
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => { setOverrideMode(true); setOverrideVal(displayConf); }}>
                  ✏️ Override
                </button>
              )}
            </div>

            {/* Problems solved */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">💻 Problems Solved</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="btn btn-secondary"
                  style={{ width: 40, height: 40, padding: 0, fontSize: '1.4rem', justifyContent: 'center' }}
                  onClick={() => adjustProblems(-1)}
                >−</button>
                <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--accent-light)', lineHeight: 1 }}>
                  {currentWeek.problemsSolved || 0}
                </span>
                <button
                  className="btn btn-primary"
                  style={{ width: 40, height: 40, padding: 0, fontSize: '1.4rem', justifyContent: 'center' }}
                  onClick={() => adjustProblems(1)}
                >+</button>
              </div>
            </div>

            {/* Syllabus checklist */}
            <div className="card full-width">
              <div className="card-header">
                <span className="card-title">📋 Current Cycle Syllabus Checklist</span>
                <span className="badge badge-muted">{sortedTopics.length} topics</span>
              </div>
              {sortedTopics.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <span className="es-icon">📭</span>
                  <span className="es-text">No new topics logged for this contest cycle yet. Log lectures to build the syllabus.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedTopics.map(t => {
                    const st = understoodStatus(t.understoodPct);
                    return (
                      <div key={t.id} className="syllabus-item">
                        <span className="syllabus-status">{st.label}</span>
                        <div style={{ flex: 1 }}>
                          <div className="syllabus-name">{t.topicName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {t.contestRelevance} relevance · {t.sessionType === 'lab' ? '🔬 Lab' : '📚 Lecture'}
                            {t.concepts?.length > 0 && ` · ${t.concepts.slice(0, 3).join(', ')}`}
                          </div>
                        </div>
                        <span className="syllabus-pct" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {t.understoodPct}%
                        </span>
                        <div className="progress-bar" style={{ width: 60, marginLeft: 8 }}>
                          <div
                            className={`progress-fill ${t.understoodPct >= 70 ? 'green' : t.understoodPct >= 40 ? 'yellow' : 'red'}`}
                            style={{ width: `${t.understoodPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mistakes log */}
            <div className="card full-width">
              <div className="card-header">
                <span className="card-title">⚠️ Mistakes Log</span>
                <span className="badge badge-muted">{currentWeek.mistakesLog?.length || 0} entries</span>
              </div>

              {/* Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="What did I get wrong / need to remember?…"
                  value={mistakeText}
                  onChange={e => setMistakeText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMistake()}
                  id="mistake-input"
                />
                <button className="btn btn-secondary" onClick={addMistake} style={{ flexShrink: 0 }}>Add</button>
              </div>

              {(currentWeek.mistakesLog || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No mistakes logged yet — great job, or start tracking!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...(currentWeek.mistakesLog || [])].reverse().map(m => (
                    <div key={m.id} style={{
                      padding: 'var(--space-3)',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--yellow)',
                      fontSize: '0.875rem',
                    }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 4 }}>
                        {new Date(m.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {m.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Past Contests & History */}
      {displayedPastContests.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📜 Past Contests & History</span>
            <span className="badge badge-muted">{displayedPastContests.length} completed</span>
          </div>
          <div className="flex flex-col gap-3">
            {displayedPastContests.map(p => {
              const sub = subjects.find(s => s.id === p.subjectId);
              return (
                <div
                  key={p.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: `4px solid ${sub?.color || 'var(--accent)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 700, color: sub?.color }}>{sub?.name || 'Subject'}</span>
                      <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>Week of {fmtDate(p.weekStart)}</span>
                      {p.completedAt && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Finished {fmtDate(p.completedAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.score && (
                        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>
                          Score: {p.score}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        💻 {p.problemsSolved || 0} solved · ⚠️ {p.mistakesLog?.length || 0} mistakes
                      </span>
                    </div>
                  </div>

                  {p.contestNotes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong>Notes:</strong> {p.contestNotes}
                    </div>
                  )}

                  {p.keyLearnings && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <strong>Learnings:</strong> {p.keyLearnings}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Complete Contest Modal */}
      {showCompleteModal && (
        <div className="modal-backdrop" onClick={() => setShowCompleteModal(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h2>🏁 Complete Contest for {currentSubject?.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCompleteModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCompleteContest} className="flex flex-col gap-4">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Record your contest outcome and key learnings. Saving will archive this contest and reset the {currentSubject?.name} syllabus ready for your next contest cycle.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="contest-score">Score / Rank / Result (Optional)</label>
                <input
                  id="contest-score"
                  type="text"
                  placeholder="e.g. 85/100, Rank 12, Solved 3/4"
                  value={completionForm.score}
                  onChange={e => setCompletionForm(f => ({ ...f, score: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contest-notes">Contest Reflection & Notes</label>
                <textarea
                  id="contest-notes"
                  rows="3"
                  placeholder="How did the contest go? What types of questions came up?"
                  value={completionForm.notes}
                  onChange={e => setCompletionForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contest-learnings">Key Learnings & Focus for Next Time</label>
                <textarea
                  id="contest-learnings"
                  rows="2"
                  placeholder="e.g. Need to revise graph problems faster, practice edge cases..."
                  value={completionForm.learnings}
                  onChange={e => setCompletionForm(f => ({ ...f, learnings: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2" style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Complete Contest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
