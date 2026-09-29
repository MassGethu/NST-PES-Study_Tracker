import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { isHackathonUser, hackathonReminders, formatDeadline } from '../store/hackathons.js';

export default function HackathonDeadlineSummary() {
  const { state, account } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (!isHackathonUser(account.user)) return null;
  const reminders = hackathonReminders(state.hackathons, now);
  if (!reminders.length) return null;
  return <aside className="hackathon-reminder mb-4" aria-label="Hackathon reminders">
    <div className="flex items-center justify-between gap-2"><strong className="text-sm">🏁 Hackathons needing attention</strong><Link className="text-xs" to="/hackathons">{reminders.length > 2 ? `View all ${reminders.length}` : 'Open manager'} →</Link></div>
    {reminders.slice(0, 2).map(reminder => <Link className="hackathon-reminder-line" key={reminder.row.id} to={`/hackathons/${reminder.row.id}`}><strong>{reminder.row.name}</strong><span>{reminder.label} · {formatDeadline(reminder.value)}{reminder.overdue ? ' · Deadline passed' : ''}</span></Link>)}
  </aside>;
}
