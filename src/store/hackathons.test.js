import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyState, normalizeState, mergeImport, parseBackup, readCache, writeCache } from './accountStorage.js';
import { isHackathonUser, officialUrl, validateHackathon, sortedHackathons, localDeadline } from './hackathons.js';
const { validateHackathons } = createRequire(import.meta.url)('../../server/hackathons.js');
const row = { id: 'h1', name: 'Hack', url: 'https://example.com', deadline: '2026-10-05T12:00:00.000Z', idea: '', status: 'Registered', notes: '', archived: false };

test('hackathons survive account cache and backup import without changing legacy records', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const state = { ...emptyState(), hackathons: [row] };
  writeCache('aadarsh', state, 3, true);
  writeCache('rithika', emptyState(), 1, false);
  assert.deepEqual(readCache('aadarsh').state.hackathons, [row]);
  assert.deepEqual(readCache('rithika').state.hackathons, []);
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
  assert.deepEqual(mergeImport(emptyState(), state).hackathons, [row]);
  assert.equal(mergeImport(state, state).hackathons.length, 1);
  assert.throws(() => mergeImport(state, { ...state, hackathons: [{ ...row, idea: 'Different' }] }), /different content/);
  assert.throws(() => parseBackup(JSON.stringify({ ...state, hackathons: {} })), /Invalid hackathons/);
  assert.deepEqual(normalizeState({ subjects: [], topics: [] }).hackathons, []);
});

test('deadline sorting retains past deadlines and submitted entries, and separates archives', () => {
  const rows = [row, { ...row, id: 'old', deadline: '2026-09-01T12:00:00Z' }, { ...row, id: 'done', status: 'Submitted' }, { ...row, id: 'archive', archived: true }];
  assert.deepEqual(sortedHackathons(rows).map(row => row.id), ['old', 'h1', 'done']);
  assert.deepEqual(sortedHackathons(rows, true).map(row => row.id), ['archive']);
  assert.equal(new Date(localDeadline(row.deadline)).getTime(), Date.parse(row.deadline));
});

test('only Aadarsh gets hackathons and server rejects unsafe or malformed data', () => {
  assert.equal(isHackathonUser({ username: 'aadarsh' }), true);
  assert.equal(isHackathonUser({ username: 'rithika' }), false);
  assert.equal(isHackathonUser(null), false);
  assert.equal(validateHackathon(row), '');
  assert.equal(officialUrl('javascript:alert(1)'), '');
  assert.match(validateHackathon({ ...row, deadline: '' }), /deadline/);
  assert.equal(validateHackathons([row], { username: 'aadarsh' }), '');
  assert.match(validateHackathons([row], { username: 'rithika' }), /only for Aadarsh/);
  assert.equal(validateHackathons([], { username: 'rithika' }), '');
  assert.equal(validateHackathons(undefined, { username: 'aadarsh' }), '');
  assert.match(validateHackathons([row, row], { username: 'aadarsh' }), /unique IDs/);
  assert.match(validateHackathons([{ ...row, url: 'javascript:alert(1)' }], { username: 'aadarsh' }), /URL/);
  assert.match(validateHackathons([{ ...row, status: 'unknown' }], { username: 'aadarsh' }), /status/);
});
