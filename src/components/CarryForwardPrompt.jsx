import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { addDays, fmtDate, today } from '../store/utils.js';

export default function CarryForwardPrompt() {
  const { state, dispatch } = useStore();
  const todayDate = today();
  const yesterday = addDays(todayDate, -1);
  const pending = useMemo(() => (
    (state.weeklyChecklist || []).filter(item =>
      item.date === yesterday &&
      !item.done &&
      ['must', 'optional'].includes(item.type)
    )
  ), [state.weeklyChecklist, yesterday]);
  const promptHandled = (state.carryForwardPromptedDates || []).includes(todayDate);
  const pendingKey = pending.map(item => item.id).sort().join('|');
  const [selectedIds, setSelectedIds] = useState(() => new Set(pending.map(item => item.id)));

  useEffect(() => {
    if (!promptHandled && pending.length > 0) {
      setSelectedIds(new Set(pending.map(item => item.id)));
    }
  }, [pendingKey, promptHandled]);

  if (promptHandled || pending.length === 0) return null;

  function toggle(id) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function carryForward() {
    dispatch({
      type: 'CARRY_FORWARD_CHECKLIST_ITEMS',
      itemIds: [...selectedIds],
      fromDate: yesterday,
      toDate: todayDate,
    });
  }

  return (
    <div className="modal-backdrop carry-forward-backdrop">
      <div className="modal slide-up carry-forward-modal" role="dialog" aria-modal="true" aria-labelledby="carry-forward-title">
        <div className="carry-forward-icon" aria-hidden="true">↪</div>
        <div>
          <h2 id="carry-forward-title">Carry unfinished tasks forward?</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            You left {pending.length} {pending.length === 1 ? 'task' : 'tasks'} unchecked on {fmtDate(yesterday)}. Choose what should move to today.
          </p>
        </div>

        <div className="carry-forward-list">
          {pending.map(item => {
            const selected = selectedIds.has(item.id);
            return (
              <button
                type="button"
                key={item.id}
                className={`carry-forward-item${selected ? ' selected' : ''}`}
                onClick={() => toggle(item.id)}
                aria-pressed={selected}
              >
                <span className={`check-box${selected ? ' checked' : ''}`}>{selected ? '✓' : ''}</span>
                <span className="carry-forward-copy">
                  <span>{item.text}</span>
                  <span className={`badge ${item.type === 'must' ? 'badge-red' : 'badge-muted'}`}>
                    {item.type === 'must' ? 'Must Do' : 'Optional'}
                  </span>
                </span>
                {item.time && <span className="text-muted text-sm">{item.time}</span>}
              </button>
            );
          })}
        </div>

        <div className="carry-forward-actions">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'DISMISS_CARRY_FORWARD', date: todayDate })}>
            Not today
          </button>
          <button className="btn btn-primary" onClick={carryForward} disabled={selectedIds.size === 0}>
            Carry forward {selectedIds.size || ''} {selectedIds.size === 1 ? 'task' : 'tasks'}
          </button>
        </div>
      </div>
    </div>
  );
}
