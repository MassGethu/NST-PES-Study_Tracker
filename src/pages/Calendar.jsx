import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { today, fmtDate, toYMD, addDays } from '../store/utils.js';
import DayDetailModal from '../components/DayDetailModal.jsx';

export default function Calendar() {
  const { state } = useStore();
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const todayStr = today();

  // Navigation handlers
  function handlePrev() {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const newD = new Date(currentDate);
      newD.setDate(currentDate.getDate() - 7);
      setCurrentDate(newD);
    }
  }

  function handleNext() {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const newD = new Date(currentDate);
      newD.setDate(currentDate.getDate() + 7);
      setCurrentDate(newD);
    }
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  // Get items for a date
  function getItemsForDate(dateStr) {
    return (state.weeklyChecklist || []).filter(item => item.date === dateStr);
  }

  // Type labels and colors
  function getTypeColor(t) {
    switch (t) {
      case 'must': return '#ef4444';
      case 'optional': return '#10b981';
      case 'event': return '#8b5cf6';
      case 'fitness': return '#f43f5e';
      case 'outing': return '#f59e0b';
      case 'reminder': return '#06b6d4';
      default: return 'var(--text-secondary)';
    }
  }

  function getShortTypeLabel(t) {
    switch (t) {
      case 'must': return '📌';
      case 'optional': return '⭐';
      case 'event': return '📅';
      case 'fitness': return '🏃';
      case 'outing': return '🚗';
      case 'reminder': return '🔔';
      default: return '';
    }
  }

  // Month View calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week (0=Sun, 1=Mon, ..., 6=Sat). Align Mon=0, Tue=1, ..., Sun=6
  let startDayIndex = firstDayOfMonth.getDay();
  startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;

  const monthCells = [];

  // Padding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthNum = prevMonthDate.getMonth() + 1; // 1-indexed

  for (let i = startDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    monthCells.push({
      dateStr: toYMD(prevMonthYear, prevMonthNum, dayNum),
      dayNum,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    monthCells.push({
      dateStr: toYMD(year, month + 1, i),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  // Padding days for next month to complete the grid (usually 35 or 42 cells)
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthNum = nextMonthDate.getMonth() + 1; // 1-indexed

  const totalCellsNeeded = monthCells.length > 35 ? 42 : 35;
  const nextMonthDaysNeeded = totalCellsNeeded - monthCells.length;
  for (let i = 1; i <= nextMonthDaysNeeded; i++) {
    monthCells.push({
      dateStr: toYMD(nextMonthYear, nextMonthNum, i),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  // Week View calculations
  const getMondayDateObj = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  const mondayObj = getMondayDateObj(currentDate);
  const mondayStr = toYMD(mondayObj.getFullYear(), mondayObj.getMonth() + 1, mondayObj.getDate());
  const weekCells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayObj);
    d.setDate(mondayObj.getDate() + i);
    const cellDateStr = toYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
    weekCells.push({
      dateStr: cellDateStr,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isCurrentMonth: d.getMonth() === currentDate.getMonth(),
    });
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="fade-in" style={{ padding: 'var(--space-2) 0' }}>
      {/* Calendar Header / Toolbar */}
      <div className="flex items-center justify-between mb-5" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="flex items-center gap-3">
          <h2>{viewMode === 'month' ? monthName : `Week of ${fmtDate(mondayStr)}`}</h2>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={handlePrev}>←</button>
            <button className="btn btn-secondary btn-sm" onClick={handleToday}>Today</button>
            <button className="btn btn-secondary btn-sm" onClick={handleNext}>→</button>
          </div>
        </div>

        <div className="tab-container" style={{ display: 'flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`tab ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
            style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
          >
            Month
          </button>
          <button
            className={`tab ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
            style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
          >
            Week
          </button>
        </div>
      </div>

      {/* Month View Grid */}
      {viewMode === 'month' && (
        <div className="calendar-card card">
          <div className="calendar-grid-header">
            {weekdays.map(day => (
              <div key={day} className="calendar-header-cell">{day}</div>
            ))}
          </div>
          <div className="calendar-grid-body">
            {monthCells.map((cell, idx) => {
              const cellItems = getItemsForDate(cell.dateStr);
              const isToday = cell.dateStr === todayStr;
              
              // Sort items chronologically by time
              const sortedItems = [...cellItems].sort((a, b) => {
                if (!a.time) return 1;
                if (!b.time) return -1;
                return a.time.localeCompare(b.time);
              });

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`calendar-cell ${cell.isCurrentMonth ? '' : 'outside'} ${isToday ? 'today' : ''}`}
                >
                  <div className="flex items-center justify-between" style={{ width: '100%', marginBottom: '4px' }}>
                    <span className="cell-day-num">{cell.dayNum}</span>
                    {sortedItems.length > 0 && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {sortedItems.length}
                      </span>
                    )}
                  </div>

                  {/* Task text previews */}
                  <div className="cell-tasks-list">
                    {sortedItems.slice(0, 3).map(item => (
                      <div
                        key={item.id}
                        className={`cell-task-pill ${item.done ? 'done' : ''}`}
                        style={{
                          borderLeft: `2px solid ${getTypeColor(item.type)}`,
                          backgroundColor: `${getTypeColor(item.type)}18`,
                        }}
                        title={`${item.time ? '[' + item.time + '] ' : ''}${item.text}${item.link ? ' (Link: ' + item.link + ')' : ''}`}
                      >
                        <span className="cell-task-icon">{getShortTypeLabel(item.type)}</span>
                        {item.time && <span className="cell-task-time">{item.time}</span>}
                        <span className="cell-task-text">{item.text}</span>
                        {item.link && <span style={{ fontSize: '0.6rem', opacity: 0.8, marginLeft: '2px' }}>🔗</span>}
                      </div>
                    ))}
                    {sortedItems.length > 3 && (
                      <div className="cell-task-more">+{sortedItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View Grid */}
      {viewMode === 'week' && (
        <div className="calendar-week-container">
          {weekCells.map((cell, idx) => {
            const cellItems = getItemsForDate(cell.dateStr);
            const isToday = cell.dateStr === todayStr;

            // Sort items chronologically by time
            const sortedItems = [...cellItems].sort((a, b) => {
              if (!a.time) return 1;
              if (!b.time) return -1;
              return a.time.localeCompare(b.time);
            });

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`calendar-week-card card ${isToday ? 'today' : ''}`}
                style={{ cursor: 'pointer', transition: 'border-color var(--transition)' }}
              >
                <div className="week-card-header flex justify-between items-center">
                  <span className="week-day-name">{cell.dayName}</span>
                  <span className="week-day-num">{cell.dayNum}</span>
                </div>
                <div className="week-card-body flex flex-col gap-2">
                  {sortedItems.length === 0 ? (
                    <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>Empty</span>
                  ) : (
                    sortedItems.map(item => (
                      <div
                        key={item.id}
                        className="week-item-pill"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: `${getTypeColor(item.type)}18`,
                          borderLeft: `3px solid ${getTypeColor(item.type)}`,
                          fontSize: '0.75rem',
                          textDecoration: item.done ? 'line-through' : 'none',
                          opacity: item.done ? 0.6 : 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{getShortTypeLabel(item.type)}</span>
                        {item.time && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.time}</span>}
                        <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.text}</span>
                        {item.link && (
                          <a
                            href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--accent)', fontSize: '0.75rem', textDecoration: 'none' }}
                            title="Open Link"
                          >
                            🔗
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Popup Modal */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
