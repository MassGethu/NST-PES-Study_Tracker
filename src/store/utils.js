/** Shared utility helpers */

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Format year, month (1-indexed), day to YYYY-MM-DD */
export function toYMD(year, month, day) {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convert Date object or current time to IST YYYY-MM-DD string */
export function toISTDateStr(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/** ISO date string for today in IST */
export function today() {
  return toISTDateStr(new Date());
}

/** Parse YYYY-MM-DD string into [year, month (1-indexed), day] */
export function parseYMD(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
}

/** Monday of a given date's week (YYYY-MM-DD in IST) */
export function getMondayOf(dateStr) {
  const parsed = parseYMD(dateStr);
  if (!parsed) return dateStr;
  const [y, m, d] = parsed;
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toYMD(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Day-of-week key for a date (Mon/Tue/...) */
export function getDayKey(dateStr) {
  const parsed = parseYMD(dateStr);
  if (!parsed) return 'Sun';
  const [y, m, d] = parsed;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(y, m - 1, d).getDay()];
}

/** Format date for display: "Mon, 25 Aug" in IST */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const parsed = parseYMD(dateStr);
  if (!parsed) return dateStr;
  const [y, m, d] = parsed;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** Days until a date (negative = overdue) */
export function daysUntil(dateStr) {
  const parsedToday = parseYMD(today());
  const parsedTarget = parseYMD(dateStr);
  if (!parsedToday || !parsedTarget) return 0;
  const now = new Date(parsedToday[0], parsedToday[1] - 1, parsedToday[2]);
  const target = new Date(parsedTarget[0], parsedTarget[1] - 1, parsedTarget[2]);
  return Math.round((target - now) / 86400000);
}

/** Add N days to a YYYY-MM-DD date string */
export function addDays(dateStr, n) {
  const parsed = parseYMD(dateStr);
  if (!parsed) return dateStr;
  const [y, m, d] = parsed;
  const date = new Date(y, m - 1, d + n);
  return toYMD(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Clamp a number between min and max */
export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/** Contest relevance weight */
export const RELEVANCE_WEIGHT = { High: 3, Medium: 2, Low: 1 };

/** Understood % → status label + badge class */
export function understoodStatus(pct) {
  if (pct >= 80) return { label: '✅', cls: 'badge-green' };
  if (pct >= 50) return { label: '⚠️', cls: 'badge-yellow' };
  return { label: '❌', cls: 'badge-red' };
}

/** Confidence level (1-5) → label */
export function confidenceLabel(c) {
  return ['', 'Very Low', 'Low', 'Medium', 'High', 'Expert'][c] || '—';
}
