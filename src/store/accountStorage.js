// The legacy key is read-only. New data is cached under its authenticated owner.
export function emptyState() {
  return { subjects: [], topics: [], recallSessions: [], worksheets: [],
    timetable: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
    weeklyChecklist: [], weeklyTasks: [], contestWeeks: [], carryForwardPromptedDates: [], _seeded: true };
}

export function normalizeState(state) { return { ...emptyState(), ...state }; }

export function readCache(id) {
  try { return JSON.parse(localStorage.getItem(`nst_account_${id}`) || 'null'); }
  catch { return null; }
}

export function writeCache(id, state, version, pending) {
  localStorage.setItem(`nst_account_${id}`, JSON.stringify({ state, version, pending }));
}

export function readLegacy() {
  const raw = localStorage.getItem('nst_tracker_v1');
  return raw ? parseBackup(raw) : null;
}

export function parseBackup(raw) {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.subjects) || !Array.isArray(value.topics)) throw new Error('This is not a tracker backup.');
  for (const key of ['subjects', 'topics', 'recallSessions', 'worksheets', 'contestWeeks', 'weeklyChecklist', 'weeklyTasks']) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some(row => !row || typeof row.id !== 'string'))) {
      throw new Error(`Invalid ${key} in backup.`);
    }
  }
  return normalizeState(value);
}

export function downloadBackup(state, label = 'backup') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `nst-${label}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Import is explicit, never part of login. Refuse conflicting records rather
// than silently overwriting either version of the user's work.
export function mergeImport(current, incoming) {
  const result = { ...incoming, ...current };
  for (const key of ['subjects', 'topics', 'recallSessions', 'worksheets', 'contestWeeks', 'weeklyChecklist', 'weeklyTasks']) {
    const rows = new Map((current[key] || []).map(row => [row.id, row]));
    for (const row of incoming[key] || []) {
      const existing = rows.get(row.id);
      if (existing && canonical(existing) !== canonical(row)) {
        throw new Error(`A ${key} record already exists with different content. Export both copies before choosing which to keep; nothing was imported.`);
      }
      rows.set(row.id, row);
    }
    result[key] = [...rows.values()];
  }
  result.timetable = Object.fromEntries(Object.keys(emptyState().timetable).map(day => [day,
    [...new Set([...(current.timetable?.[day] || []), ...(incoming.timetable?.[day] || [])])]]));
  result.carryForwardPromptedDates = [...new Set([...(current.carryForwardPromptedDates || []), ...(incoming.carryForwardPromptedDates || [])])];
  return normalizeState(result);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
