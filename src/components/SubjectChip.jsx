import React from 'react';
import { useStore } from '../store/StoreContext.jsx';

/** Coloured subject chip with dot indicator */
export default function SubjectChip({ subjectId, size = 'normal' }) {
  const { derived } = useStore();
  const subject = derived.getSubject(subjectId);
  if (!subject) return null;

  const color = subject.color || 'var(--accent)';
  return (
    <span
      className="subject-chip"
      style={{
        background: color + '22',
        color,
        border: `1px solid ${color}44`,
        fontSize: size === 'sm' ? '0.65rem' : undefined,
        padding: size === 'sm' ? '2px 7px' : undefined,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {subject.name}
    </span>
  );
}
