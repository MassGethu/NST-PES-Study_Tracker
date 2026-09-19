import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import RevisionRow from '../components/RevisionRow.jsx';

export default function RevisionQueue() {
  const { derived } = useStore();
  const { revisionQueue } = derived;
  const { overdue, dueToday, thisWeek } = revisionQueue;

  const totalDue = overdue.length + dueToday.length;

  return (
    <div>
      <div className="section-header mb-4" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1>Revision Queue</h1>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
            {totalDue === 0
              ? '🎉 Nothing overdue or due today'
              : `${totalDue} topic${totalDue !== 1 ? 's' : ''} need attention`}
          </p>
        </div>
        <div className="flex gap-3">
          <StatPill label="Overdue" count={overdue.length} color="var(--red)" />
          <StatPill label="Today" count={dueToday.length} color="var(--yellow)" />
          <StatPill label="This week" count={thisWeek.length} color="var(--green)" />
        </div>
      </div>

      {overdue.length === 0 && dueToday.length === 0 && thisWeek.length === 0 && (
        <div className="empty-state card" style={{ padding: 'var(--space-12)' }}>
          <span className="es-icon">🏖️</span>
          <span className="es-text">All caught up! No revisions due in the next 7 days. Keep logging lectures to build your queue.</span>
        </div>
      )}

      {overdue.length > 0 && (
        <Section title="🔴 Overdue" count={overdue.length} color="var(--red)">
          {overdue.map(t => <RevisionRow key={t.id} topic={t} />)}
        </Section>
      )}

      {dueToday.length > 0 && (
        <Section title="🟡 Due Today" count={dueToday.length} color="var(--yellow)">
          {dueToday.map(t => <RevisionRow key={t.id} topic={t} />)}
        </Section>
      )}

      {thisWeek.length > 0 && (
        <Section title="🟢 Due This Week" count={thisWeek.length} color="var(--green)">
          {thisWeek.map(t => <RevisionRow key={t.id} topic={t} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, color, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="card mb-4">
      <div
        className="card-header"
        style={{ cursor: 'pointer', marginBottom: collapsed ? 0 : 'var(--space-4)' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="section-title">
          {title}
          <span className="badge" style={{ background: color + '22', color }}>{count}</span>
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{collapsed ? '▾' : '▲'}</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2 fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, count, color }) {
  return (
    <div style={{
      padding: '6px 16px',
      borderRadius: 99,
      background: color + '18',
      border: `1px solid ${color}33`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, color, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}
