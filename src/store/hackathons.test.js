import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyState, normalizeState, mergeImport, parseBackup, readCache, writeCache } from './accountStorage.js';
import { isHackathonUser, officialUrl, validateHackathon, sortedHackathons, localDeadline, hackathonDeadline, newHackathon, hackathonReminders, applyHackathonFacts } from './hackathons.js';
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
  assert.equal(validateHackathon({ ...row, deadline: '' }), '');
  assert.equal(validateHackathons([row], { username: 'aadarsh' }), '');
  assert.match(validateHackathons([row], { username: 'rithika' }), /only for Aadarsh/);
  assert.equal(validateHackathons([], { username: 'rithika' }), '');
  assert.equal(validateHackathons(undefined, { username: 'aadarsh' }), '');
  assert.match(validateHackathons([row, row], { username: 'aadarsh' }), /unique IDs/);
  assert.match(validateHackathons([{ ...row, url: 'javascript:alert(1)' }], { username: 'aadarsh' }), /URL/);
  assert.match(validateHackathons([{ ...row, status: 'unknown' }], { username: 'aadarsh' }), /status/);
});

test('registration pending prioritizes registration deadlines and permits unknown dates at capture', () => {
  const pending = { ...row, id: 'pending', status: 'Registration Pending', registrationDeadline: '2026-10-01T12:00:00Z' };
  assert.deepEqual(hackathonDeadline(pending), { label: 'Registration', value: pending.registrationDeadline });
  assert.deepEqual(sortedHackathons([row, pending]).map(row => row.id), ['pending', 'h1']);
  assert.equal(validateHackathon(pending), '');
  assert.equal(validateHackathons([pending], { username: 'aadarsh' }), '');
  assert.equal(validateHackathon({ ...pending, registrationDeadline: '' }), '');
  assert.equal(validateHackathons([{ ...pending, registrationDeadline: '' }], { username: 'aadarsh' }), '');
  assert.match(validateHackathons([{ ...pending, registrationDeadline: 'invalid' }], { username: 'aadarsh' }), /registration deadline/);
  assert.deepEqual(hackathonDeadline({ ...pending, status: 'Registered' }), { label: 'Submission', value: row.deadline });
  assert.equal(validateHackathons([row], { username: 'aadarsh' }), '');
});

test('capture requires only a name and URL; legacy records remain valid', () => {
  const captured = newHackathon('new', '  Opportunity  ', row.url);
  assert.equal(captured.name, 'Opportunity');
  assert.equal(captured.status, 'Registration Pending');
  assert.equal(captured.deadline, '');
  assert.equal(captured.difficulty, null);
  assert.equal(validateHackathon(captured), '');
  assert.equal(validateHackathons([captured, row], { username: 'aadarsh' }), '');
  assert.equal(hackathonReminders([captured]).length, 0);
  assert.equal(sortedHackathons([captured, row])[0].id, row.id);
});

test('reminders obey 2-day registration, 3/7-day submission and same-deadline rules', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const at = days => new Date(now + days * 86400000).toISOString();
  const submission = (days, difficulty) => ({ ...row, deadline: at(days), difficulty });
  assert.equal(hackathonReminders([submission(3, 2)], now).length, 1);
  assert.equal(hackathonReminders([submission(3.01, 2)], now).length, 0);
  assert.equal(hackathonReminders([submission(7, 3)], now).length, 1);
  assert.equal(hackathonReminders([submission(7.01, 3)], now).length, 0);
  assert.equal(hackathonReminders([submission(7, 5)], now).length, 1);
  assert.equal(hackathonReminders([submission(7, null)], now).length, 1);
  const pending = { ...submission(8, 5), status: 'Registration Pending', registrationDeadline: at(2) };
  assert.equal(hackathonReminders([pending], now)[0].label, 'Registration');
  assert.equal(hackathonReminders([{ ...pending, registrationDeadline: at(2.01) }], now).length, 0);
  assert.equal(hackathonReminders([{ ...pending, deadline: at(7), registrationDeadline: at(7) }], now).length, 1);
  assert.equal(hackathonReminders([{ ...submission(-1, 1) }], now)[0].overdue, true);
  assert.equal(hackathonReminders([{ ...pending, archived: true }, { ...submission(1, 3), status: 'Submitted' }], now).length, 0);
});

test('autofill fills only empty unchanged facts and never replaces ideas or stale event details', () => {
  const captured = newHackathon('new', 'Opportunity', row.url);
  const result = { facts: { domains: { value: 'Health', sources: [{ url: row.url, title: 'Official' }] }, deadline: { value: row.deadline, sources: [{ url: row.url, title: 'Official' }] } }, researchedAt: row.deadline };
  const current = { ...captured, domains: 'My correction', idea: 'My own idea', status: 'Building' };
  const updated = applyHackathonFacts(current, captured, result);
  assert.equal(updated.domains, 'My correction');
  assert.equal(updated.deadline, row.deadline);
  assert.equal(updated.idea, 'My own idea');
  assert.equal(updated.status, 'Building');
  assert.equal(updated.sources.domains, undefined);
  assert.equal(updated.sources.deadline[0].title, 'Official');
  const changed = { ...current, url: 'https://different.example.com' };
  assert.equal(applyHackathonFacts(changed, captured, result), changed);
});

test('idea bank persists, merges and protects originals from conflicting imports', () => {
  const idea = { id: 'idea', title: 'Original', description: 'Reusable concept', domains: 'Health' };
  const original = { ...emptyState(), hackathonIdeas: [idea] };
  assert.deepEqual(parseBackup(JSON.stringify(original)).hackathonIdeas, [idea]);
  assert.deepEqual(mergeImport(emptyState(), original).hackathonIdeas, [idea]);
  assert.equal(mergeImport(original, original).hackathonIdeas.length, 1);
  assert.throws(() => mergeImport(original, { ...original, hackathonIdeas: [{ ...idea, description: 'Different' }] }), /different content/);
});
