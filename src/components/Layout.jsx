import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { today, fmtDate } from '../store/utils.js';
import CarryForwardPrompt from './CarryForwardPrompt.jsx';

const NAV_ITEMS = [
  { to: '/',         icon: '🏠', label: 'Dashboard' },
  { to: '/calendar', icon: '📅', label: 'Calendar' },
  { to: '/log',      icon: '📝', label: 'Lecture Log' },
  { to: '/contest',  icon: '🏆', label: 'Contest' },
  { to: '/revision', icon: '🔄', label: 'Revision' },
  { to: '/recall', icon: '🧠', label: 'Active Recall' },
  { to: '/settings', icon: '⚙️',  label: 'Settings' },
];

export default function Layout({ children }) {
  const todayStr = fmtDate(today());

  return (
    <div className="app-shell">
      {/* Sidebar (desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">N</div>
          <div>
            <div className="logo-text">NST Tracker</div>
            <div className="logo-sub">Newton School of Technology</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: 'var(--space-5)', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>Today</div>
            {todayStr}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="top-bar">
          <PageTitle />
          <span className="today-badge">{todayStr}</span>
        </header>
        <main className="page-body fade-in">
          {children}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="bn-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <CarryForwardPrompt />
    </div>
  );
}

function PageTitle() {
  const location = useLocation();
  const map = {
    '/':         '🏠 Dashboard',
    '/calendar': '📅 Calendar',
    '/log':      '📝 Lecture Log',
    '/contest':  '🏆 Contest Tracker',
    '/revision': '🔄 Revision Queue',
    '/recall': '🧠 Active Recall',
    '/settings': '⚙️ Settings',
  };
  return <span className="page-title">{map[location.pathname] || 'NST Tracker'}</span>;
}
