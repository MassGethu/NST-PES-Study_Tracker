import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { isHackathonUser, sortedHackathons, hackathonDeadline, formatDeadline } from '../store/hackathons.js';

export default function HackathonDeadlineSummary() {
  const { state, account } = useStore();
  if (!isHackathonUser(account.user)) return null;
  const rows = sortedHackathons(state.hackathons).filter(row => row.status !== 'Submitted');
  if (!rows.length) return null;
  return <div className="text-sm mb-4 flex flex-col gap-2">
    {rows.slice(0, 3).map(row => {
      const deadline = hackathonDeadline(row);
      return <Link key={row.id} to="/hackathons" style={{ overflowWrap: 'anywhere' }}>
        🏁 {row.name} · {deadline.label} due {formatDeadline(deadline.value)}
        {Date.parse(deadline.value) < Date.now() && <span className="badge badge-red" style={{ marginLeft: 8 }}>Deadline passed</span>}
      </Link>;
    })}
    <Link to="/hackathons" className="text-muted">Open Hackathon Manager{rows.length > 3 ? ` · ${rows.length} active` : ''} →</Link>
  </div>;
}
