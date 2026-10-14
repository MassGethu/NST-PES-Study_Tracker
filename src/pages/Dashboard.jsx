import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { worksheetsDueThisWeek } from '../store/worksheets.js';
import HackathonDeadlineSummary from '../components/HackathonDeadlineSummary.jsx';
import { isHackathonUser } from '../store/hackathons.js';
import ChecklistBlock from '../components/ChecklistBlock.jsx';
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
    <div className="card weekly-tasks-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
      <div className="checklist dashboard-scroll-list" tabIndex={0} role="region" aria-label="Weekly tasks" style={{ gap: 'var(--space-2)', display: 'flex', flexDirection: 'column' }}>
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

// A compact link keeps the Friday countdown visible without a surrounding card.
function ContestCountdown({ days }) {
  return <Link to="/contest" className="contest-countdown"
    aria-label={`${days === 0 ? 'Contest today' : `${days} days until Friday`}. Open contest tracker`}>
    <strong>{days}</strong><span>{days === 0 ? 'Today' : days === 1 ? 'day to Friday' : 'days to Friday'}</span>
  </Link>;
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
  const { state, derived, dispatch, isWorksheet, account } = useStore();

  const {
    activeContest,
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
  const fullRevisionDue  = getRevisionDueForDate(viewDate);
  const revisionBySubject = fullRevisionDue.reduce((counts, topic) => {
    counts.set(topic.subjectId, (counts.get(topic.subjectId) || 0) + 1);
    return counts;
  }, new Map());

  // Contest
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
          <div className="dashboard-header-widgets">
            {!isWorksheet && <ContestCountdown days={contestDuf} />}
            {isHackathonUser(account.user) ? <HackathonDeadlineSummary /> : (
              <Link to="/lecture/new" className="btn btn-primary">+ Log Lecture</Link>
            )}
          </div>
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

        {/* Right column: Activities + Weekly Tasks stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {isWorksheet && <WorksheetDueCard state={state} date={viewDate} />}
          {/* Activities & Reminders */}
          <div className="card dashboard-activities-card">
            <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
              <span className="card-title">🏃 Activities &amp; Reminders</span>
              <span className="badge badge-muted">
                {activityItems.filter(a => a.done).length}/{activityItems.length}
              </span>
            </div>
            <ActivitiesList activities={activityItems} dispatch={dispatch} />
          </div>
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
            <span className="badge badge-muted">{fullRevisionDue.length}</span>
          </div>
          {fullRevisionDue.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <span className="es-icon">🎉</span>
              <span className="es-text">
                {isToday ? "You're all caught up!" : 'Nothing due on this day.'}
              </span>
            </div>
          ) : (
            <div className="revision-subject-list">
              {[...revisionBySubject].map(([subjectId, count]) => (
                <Link className="revision-subject-link" to="/revision" key={subjectId ?? 'unknown'}>
                  <span>{getSubject(subjectId)?.name || 'Archived subject'}</span>
                  <strong>{count} lecture{count === 1 ? '' : 's'}</strong>
                </Link>
              ))}
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

      </div>
    </div>
  );
}
