/**
 * db.js — localStorage persistence layer
 * All reads/writes go through this module.
 */

const STORE_KEY = 'nst_tracker_v1';
const SYNC_META_KEY = 'nst_tracker_sync_meta_v1';
const BACKUP_KEY = 'nst_tracker_pre_backend_backup_v1';

const DEFAULT_STATE = {
  subjects: [],
  recallSessions: [],
  topics: [],
  timetable: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
  weeklyChecklist: [],   // { id, date, text, done, type: 'must'|'optional' }
  carryForwardPromptedDates: [], // dates for which yesterday's carry-forward prompt was handled
  weeklyTasks: [],       // { id, text, done, weekStart, createdAt }  — persists all week
  contestWeeks: [],      // { id, weekStart, subjectId, problemsSolved, mistakesLog[], manualConfidenceOverride }
  _seeded: false,
};

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function hasStoredStore() {
  try { return Boolean(localStorage.getItem(STORE_KEY)); }
  catch { return false; }
}

export function saveStore(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('NST Tracker: failed to save store', e);
  }
}

export function backupLocalStore() {
  try {
    if (!localStorage.getItem(BACKUP_KEY)) {
      localStorage.setItem(BACKUP_KEY, localStorage.getItem(STORE_KEY) || '{}');
    }
  } catch (e) {
    console.error('NST Tracker: failed to create local migration backup', e);
  }
}

export function getSyncOwner() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}').ownerUserId || null; }
  catch { return null; }
}

export function setSyncOwner(ownerUserId) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ownerUserId }));
}

export function exportStore() {
  const raw = localStorage.getItem(STORE_KEY) || '{}';
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nst-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStore(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...DEFAULT_STATE, ...parsed }));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid JSON file' };
  }
}
