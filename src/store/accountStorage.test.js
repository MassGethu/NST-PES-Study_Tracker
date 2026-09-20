import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, mergeImport, readCache, writeCache, readLegacy, parseBackup } from './accountStorage.js';
import { worksheetsDueThisWeek, validateWorksheet } from './worksheets.js';

test('account caches stay separate and legacy data stays untouched', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const original = { ...emptyState(), topics: [{ id: 't', notes: 'Original', understoodPct: 70 }] };
  storage.set('nst_tracker_v1', JSON.stringify(original));
  writeCache('a', original, 2, true);
  writeCache('r', emptyState(), 1, false);
  assert.deepEqual(readCache('a').state, original);
  assert.equal(readCache('r').state.topics.length, 0);
  assert.deepEqual(readLegacy(), original);
  assert.deepEqual(mergeImport(emptyState(), original), original);
});

test('imports deduplicate IDs, preserve raw values and refuse conflicts', () => {
  const a = { ...emptyState(), topics: [{ id: 't', confidence: 3, understoodPct: 70 }], worksheets: [{ id: 'w', grade: 'A' }] };
  const b = { ...emptyState(), topics: [{ understoodPct: 70, confidence: 3, id: 't' }] };
  assert.equal(mergeImport(a, b).topics.length, 1);
  assert.equal(mergeImport(a, b).worksheets[0].grade, 'A');
  assert.throws(() => mergeImport(a, { ...b, topics: [{ id: 't', confidence: 4 }] }), /different content/);
  assert.throws(() => parseBackup('{"topics":{}}'), /not a tracker backup/);
});

test('worksheet dashboard uses pending due dates, not grades or contest topics', () => {
  const state = { worksheets: [
    { id: 'late', name: 'Late', dueDate: '2026-09-20', status: 'not started' },
    { id: 'soon', name: 'Soon', dueDate: '2026-09-22', status: 'in progress' },
    { id: 'graded', name: 'Graded', dueDate: '2026-09-22', status: 'graded' },
    { id: 'submitted', name: 'Submitted', dueDate: '2026-09-22', status: 'submitted' },
    { id: 'later', name: 'Later', dueDate: '2026-09-28', status: 'not started' },
  ] };
  assert.deepEqual(worksheetsDueThisWeek(state, '2026-09-21').map(w => w.id), ['late', 'soon']);
  const value = { subjectId: 'math', name: 'Worksheet', assignedDate: '2026-09-21', dueDate: '2026-09-22', status: 'graded', grade: '' };
  assert.match(validateWorksheet(value), /grade/);
  assert.equal(validateWorksheet({ ...value, grade: 'A' }), '');
  assert.match(validateWorksheet({ ...value, dueDate: '2026-09-20' }), /Due date/);
});
