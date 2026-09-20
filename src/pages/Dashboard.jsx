import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { worksheetsDueThisWeek } from '../store/worksheets.js';
import ChecklistBlock from '../components/ChecklistBlock.jsx';
import RevisionRow from '../components/RevisionRow.jsx';
import ConfidenceGauge from '../components/ConfidenceGauge.jsx';
import { fmtDate, daysUntil, getMondayOf, today, addDays, understoodStatus } from '../store/utils.js';

// ── Helper: Days until Friday from a given date ────────────────────────────
function daysUntilFridayFrom(dateStr) {
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDay(); // 0=Sun,1=Mon,...5=Fri
  const diff = day <= 5 ? 5 - day : 7 - (day - 5);
  return diff;
}

// ── Activity helpers ───────────────────────────────────────────────────────
function getActivityColor(type) {
  switch (type) {
    case 'event':    return '#8b5cf6';
    case 'fitness':  return '#f43f5e';
    case 'outing':   return '#f59e0b';
    case 'reminder': return '#06b6d4';
    default:         return 'var(--text-secondary)';
  }
}

function getActivityLabel(type) {
  switch (type) {
    case 'event':    return 'Event';
    case 'fitness':  return 'Fitness';
    case 'outing':   return 'Outing';
    case 'reminder': return 'Reminder';
    default:         return type;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ── Weekly Tasks sub-component ─────────────────────────────────────────────
function WeeklyTasksCard({ tasks, weekStart, dispatch }) {
  const [newText, setNewText] = useState('');
  const inputRef = useRef(null);

  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  function addTask() {
    const text = newText.trim();
    if (!text) return;
    dispatch({ type: 'ADD_WEEKLY_TASK', payload: { text, weekStart } });
    setNewText('');
    inputRef.current?.focus();
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 0 }}>
        <span className="card-title">📋 Weekly To-Do</span>
        <span className="badge badge-muted">{done}/{total}</span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{
          height: 4, borderRadius: 99,
          background: 'var(--bg-elevated)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100
              ? 'var(--green)'
              : 'linear-gradient(90deg, var(--accent), var(--accent-light))',
            borderRadius: 99,
            transition: 'width 400ms ease',
          }} />
        </div>
      )}

      {/* Task list */}
      <div className="checklist" style={{ gap: 'var(--space-2)', display: 'flex', flexDirection: 'column' }}>
        {tasks.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: 'var(--space-1) 0' }}>
            No tasks yet for this week — add one below!
          </p>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            className={`check-item${task.done ? ' done' : ''}`}
            style={{ gap: 'var(--space-2)' }}
          >
            <button
              className={`check-box${task.done ? ' checked' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_WEEKLY_TASK', id: task.id })}
              aria-label={task.done ? 'Uncheck' : 'Check'}
            >
              {task.done ? '✓' : ''}
            </button>
            <span className="check-label" style={{ flex: 1 }}>{task.text}</span>
            <button
              className="check-delete"
              onClick={() => dispatch({ type: 'DELETE_WEEKLY_TASK', id: task.id })}
              aria-label="Delete task"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add new task */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a weekly task…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          style={{ flex: 1, fontSize: '0.85rem', padding: 'var(--space-2) var(--space-3)' }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={addTask}
          disabled={!newText.trim()}
          style={{ flexShrink: 0, minWidth: 36, padding: '0 var(--space-3)' }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Compact Contest Widget ─────────────────────────────────────────────────
function CompactContestCard({ activeContest, contestSubject, contestConf, contestTopics, duf }) {
  return (
    <div
      className="card"
      style={{
        borderColor: contestSubject ? contestSubject.color + '44' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div className="card-header" style={{ marginBottom: 0 }}>
        <span className="card-title">🏆 Contest Prep</span>
        {contestSubject && (
          <span className="badge" style={{ background: contestSubject.color + '22', color: contestSubject.color, fontSize: '0.7rem' }}>
            {contestSubject.name}
          </span>
        )}
      </div>

      {!activeContest ? (
        <Link to="/contest" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', fontSize: '0.78rem' }}>
          Set this week's subject →
        </Link>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ConfidenceGauge pct={contestConf} size={54} label="" />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: contestConf >= 70 ? 'var(--green)' : contestConf >= 40 ? 'var(--yellow)' : 'var(--red)',
              lineHeight: 1.1,
            }}>
              {contestConf}%
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {contestTopics.length} topic{contestTopics.length !== 1 ? 's' : ''} · {activeContest.problemsSolved} solved
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {duf === 0 ? '🏆 TODAY!' : `${duf}d to Friday`}
            </div>
            <Link to="/contest" style={{ fontSize: '0.72rem', color: 'var(--text-accent)', marginTop: 2, display: 'inline-block' }}>
              Full view →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activities list (date-aware) ──────────────────────────────────────────
function ActivitiesList({ activities, dispatch }) {
  return (
    <div className="checklist" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {activities.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: 'var(--space-2) 0' }}>
          No events or activities scheduled — add them from the Calendar
        </p>
      ) : (
        activities.map(item => (
          <div
            key={item.id}
            className={`check-item${item.done ? ' done' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              borderLeft: `4px solid ${getActivityColor(item.type)}`,
            }}
          >
            <button
              className={`check-box${item.done ? ' checked' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', id: item.id })}
              aria-label={item.done ? 'Uncheck' : 'Check'}
            >
              {item.done ? '✓' : ''}
            </button>
            <span className="check-label" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', flex: 1 }}>
              <span style={{ fontWeight: 500 }}>{item.text}</span>
              <span className="badge" style={{
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background: `${getActivityColor(item.type)}15`,
                color: getActivityColor(item.type),
                fontWeight: 600,
              }}>
                {getActivityLabel(item.type)}
              </span>
              {item.time && (
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                  ⏰ {item.time}
                </span>
              )}
              {item.link && (
                <a
                  href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge"
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  🔗 Link
                </a>
              )}
            </span>
            <button
              className="check-delete"
              onClick={() => dispatch({ type: 'DELETE_CHECKLIST_ITEM', id: item.id })}
              aria-label="Delete item"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function WorksheetDueCard({ state, date }) {
  const worksheets = worksheetsDueThisWeek(state, date);
  return <div className="card">
    <div className="card-header"><span className="card-title">🌷 Worksheets due this week</span></div>
    <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Outstanding worksheets, including overdue work. Soonest first.</p>
    {worksheets.length ? <div className="flex flex-col gap-3">{worksheets.map(w => <Link to="/worksheets" key={w.id}>
      <strong>{w.name}</strong><div className="text-sm text-muted">{state.subjects.find(s => s.id === w.subjectId)?.name || 'Archived subject'} · {w.dueDate < date ? 'Overdue · ' : ''}{fmtDate(w.dueDate)} · {w.status}</div>
    </Link>)}</div> : <p>No outstanding worksheets due this week.</p>}
    <Link className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} to="/worksheets">Open Worksheet Tracker →</Link>
  </div>;
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state, derived, dispatch, isWorksheet } = useStore();

  const {
    activeContest,
    daysUntilFriday: duf,
    getContestTopics,
    getContestConfidence,
    getSubject,
    getChecklistForDate,
    getActivitiesForDate,
    getRevisionDueForDate,
    getWeeklyTasks: getWeeklyTasksByWeek,
  } = derived;

  // ── Day Switcher state ────────────────────────────────────────────────────
  const todayStr = today();
  const [viewDate, setViewDate] = useState(todayStr);

  const isToday     = viewDate === todayStr;
  const isTomorrow  = viewDate === addDays(todayStr, 1);

  function stepDate(n) {
    setViewDate(prev => addDays(prev, n));
  }

  // ── Derived data for viewDate ─────────────────────────────────────────────
  const mustItems        = getChecklistForDate(viewDate, 'must');
  const optionalItems    = getChecklistForDate(viewDate, 'optional');
  const activityItems    = getActivitiesForDate(viewDate);
  const revisionDue      = getRevisionDueForDate(viewDate).slice(0, 6);
  const fullRevisionDue  = getRevisionDueForDate(viewDate);

  // Contest
  const contestTopics  = activeContest ? getContestTopics(activeContest) : [];
  const contestConf    = activeContest?.manualConfidenceOverride ?? getContestConfidence(contestTopics);
  const contestSubject = activeContest ? getSubject(activeContest.subjectId) : null;
  const contestDuf     = daysUntilFridayFrom(viewDate);

  // Weekly tasks for current week
  const weekStart  = getMondayOf(viewDate);
  const weeklyTasks = getWeeklyTasksByWeek(weekStart);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>Good {greeting()} 👋</h1>
            <p style={{ fontSize: '0.875rem' }}>
              {isWorksheet ? 'Your classes, priorities and worksheets, together.' : contestDuf === 0 ? '🏆 Contest is TODAY' : `Contest in ${contestDuf} day${contestDuf !== 1 ? 's' : ''}`}
              {contestSubject && <> — <span style={{ color: contestSubject.color, fontWeight: 600 }}>{contestSubject.name}</span></>}
            </p>
          </div>
          <Link to="/lecture/new" className="btn btn-primary">
            + Log Lecture
          </Link>
        </div>

        {/* ── Day Switcher ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-2) var(--space-3)',
          width: 'fit-content',
        }}>
          <button
            className="btn-icon btn-ghost"
            onClick={() => stepDate(-1)}
            style={{ fontSize: '0.9rem', width: 28, height: 28, borderRadius: 6 }}
            title="Previous day"
          >
            ◀
          </button>

          <button
            onClick={() => setViewDate(todayStr)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: isToday ? 'var(--accent)' : 'var(--bg-elevated)',
              color: isToday ? 'white' : 'var(--text-secondary)',
              transition: 'all var(--transition)',
              boxShadow: isToday ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            📅 Today
          </button>

          <button
            onClick={() => setViewDate(addDays(todayStr, 1))}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: isTomorrow ? 'var(--accent)' : 'var(--bg-elevated)',
              color: isTomorrow ? 'white' : 'var(--text-secondary)',
              transition: 'all var(--transition)',
              boxShadow: isTomorrow ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            🌅 Tomorrow
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 var(--space-1)' }} />

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmtDate(viewDate)}
          </span>

          <button
            className="btn-icon btn-ghost"
            onClick={() => stepDate(1)}
            style={{ fontSize: '0.9rem', width: 28, height: 28, borderRadius: 6 }}
            title="Next day"
          >
            ▶
          </button>
        </div>
      </div>

      {/* ── Dashboard Grid ───────────────────────────────────────────────── */}
      <div className="dashboard-grid">

        {/* Must-Do */}
        <div className="card">
          <ChecklistBlock
            type="must"
            items={mustItems}
            title="✅ Must Do"
            emptyText="All clear — add your priorities from the Calendar"
          />
        </div>

        {/* Right column: Compact Contest + Weekly Tasks stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {isWorksheet ? <WorksheetDueCard state={state} date={viewDate} /> : <CompactContestCard
            activeContest={activeContest}
            contestSubject={contestSubject}
            contestConf={contestConf}
            contestTopics={contestTopics}
            duf={contestDuf}
          />}
          <WeeklyTasksCard
            tasks={weeklyTasks}
            weekStart={weekStart}
            dispatch={dispatch}
          />
        </div>

        {/* Revision Due */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔄 Revision Due</span>
            {fullRevisionDue.length > 6 && (
              <Link to="/revision" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                +{fullRevisionDue.length - 6} more
              </Link>
            )}
          </div>
          {revisionDue.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <span className="es-icon">🎉</span>
              <span className="es-text">
                {isToday ? "You're all caught up!" : 'Nothing due on this day.'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {revisionDue.map(t => <RevisionRow key={t.id} topic={t} compact />)}
            </div>
          )}
        </div>

        {/* Optional / Practice */}
        <div className="card">
          <ChecklistBlock
            type="optional"
            items={optionalItems}
            title="⭐ Optional / Practice"
            emptyText="e.g. Codeforces problem, extra reading…"
          />
        </div>

        {/* Activities & Reminders — full width */}
        <div className="card full-width">
          <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
            <span className="card-title">🏃 Activities &amp; Reminders</span>
            <span className="badge badge-muted">
              {activityItems.filter(a => a.done).length}/{activityItems.length}
            </span>
          </div>
          <ActivitiesList activities={activityItems} dispatch={dispatch} />
        </div>

      </div>
    </div>
  );
}
