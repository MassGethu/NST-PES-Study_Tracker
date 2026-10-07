import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { isHackathonUser, hackathonReminders } from '../store/hackathons.js';

export default function HackathonDeadlineSummary() {
  const { state, account } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (!isHackathonUser(account.user)) return null;
  const reminders = hackathonReminders(state.hackathons, now);
  return <Link className="hackathon-reminder-summary" to="/hackathons" aria-label={`${reminders.length} hackathons needing attention. Open hackathon manager`}>
    <span className="hackathon-reminder-copy"><strong>🏁 Hackathons needing attention</strong><span>{reminders.length ? 'Open manager to review deadlines' : 'All clear'}</span></span>
    <span className="badge badge-muted">{reminders.length}</span>
  </Link>;
}
