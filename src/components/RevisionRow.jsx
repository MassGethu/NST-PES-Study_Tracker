import React, { useState } from 'react';
import SubjectChip from './SubjectChip.jsx';
import { fmtDate, daysUntil } from '../store/utils.js';
import { useStore } from '../store/StoreContext.jsx';

/**
 * A single row in the revision queue / due list.
 * Shows topic info + one-click "Mark Revised" with confidence selector.
 */
export default function RevisionRow({ topic, compact = false }) {
  const { dispatch } = useStore();
  const [marking, setMarking] = useState(false);

  const days = daysUntil(topic.nextRevision);
  const urgencyColor =
    days < 0 ? 'var(--red)' :
    days === 0 ? 'var(--yellow)' :
    'var(--text-muted)';

  const urgencyLabel =
    days < 0 ? `${Math.abs(days)}d overdue` :
    days === 0 ? 'Due today' :
    `Due in ${days}d`;

  function doMark(conf) {
    dispatch({ type: 'MARK_REVISED', id: topic.id, confidence: conf });
    setMarking(false);
  }

  return (
    <div className="revision-row fade-in">
      <div className="rr-info">
        <div className="rr-topic">{topic.topicName}</div>
        <div className="rr-meta">
          <SubjectChip subjectId={topic.subjectId} size="sm" />
          <span style={{ color: urgencyColor, fontWeight: 600, fontSize: '0.72rem' }}>
            {urgencyLabel}
          </span>
          {!compact && (
            <>
              <span>Understood: {topic.understoodPct}%</span>
              <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                Revision {(topic.revisionCount ?? topic.revisionStage ?? 0) + 1}/2
              </span>
            </>
          )}
        </div>
      </div>

      <div className="rr-actions">
        {marking ? (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-danger" onClick={() => doMark('low')} style={{ padding: '4px 10px' }}>Low</button>
            <button className="btn btn-sm btn-secondary" onClick={() => doMark('medium')} style={{ padding: '4px 10px', color: 'var(--yellow)' }}>Med</button>
            <button className="btn btn-sm btn-secondary" onClick={() => doMark('high')} style={{ padding: '4px 10px', color: 'var(--green)' }}>High</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setMarking(false)}>×</button>
          </div>
        ) : (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setMarking(true)}
            style={{ whiteSpace: 'nowrap' }}
          >
            ✓ Revised
          </button>
        )}
      </div>
    </div>
  );
}
