import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewHackathonImport } from './hackathonImport.js';
import { formatDeadline } from './hackathons.js';

const headers = ['Name', 'Official URL', 'Registration deadline', 'Submission deadline', 'Location / online status', 'Eligibility', 'Team size', 'Domains', 'Rules summary', 'Prizes', 'Source links', 'Verification status', 'Date last checked'];
const record = (name, url) => [name, url, '2026-10-05', '2026-10-20T23:59:00+05:30', 'Online', 'Students', '2–4', 'AI', 'Build a prototype', '₹10,000', 'https://example.com/source', 'Verified', '2026-10-01'];

test('scheduled sheet maps event facts, retains provenance and does not invent a time for date-only deadlines', () => {
  const result = previewHackathonImport([headers, record('Event A', 'https://example.com/a')]);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].registrationDeadline, '2026-10-05');
  assert.match(formatDeadline(result.added[0].registrationDeadline), /time unknown/);
  assert.equal(result.added[0].deadline, '2026-10-20T18:29:00.000Z');
  assert.equal(result.added[0].status, 'Registration Pending');
  assert.equal(result.added[0].domains, 'AI');
  assert.equal(result.added[0].rules, 'Build a prototype');
  assert.match(result.added[0].notes, /Verification status: Verified/);
  assert.match(result.added[0].notes, /Source links: https:\/\/example.com\/source/);
});

test('existing events, repeated URLs and invalid rows are skipped without changing existing records', () => {
  const existing = previewHackathonImport([headers, record('Event A', 'https://example.com/a')]).added;
  const result = previewHackathonImport([headers,
    record('Event A', 'https://example.com/a?utm_source=mail'),
    record('Event B', 'https://example.com/b'),
    record('Event B', 'https://example.com/b'),
    record('No link', 'not a URL'),
  ], existing);
  assert.deepEqual(result.added.map(row => row.name), ['Event B']);
  assert.equal(result.skipped.length, 3);
  assert.equal(existing[0].name, 'Event A');
});

test('unknown time zone and ambiguous dates remain review notes instead of fabricated exact deadlines', () => {
  const input = record('Event C', 'https://example.com/c');
  input[2] = '10/05/2026'; input[3] = 'Oct 20 2026 23:59';
  const result = previewHackathonImport([headers, input]).added[0];
  assert.equal(result.registrationDeadline, ''); assert.equal(result.deadline, '');
  assert.match(result.notes, /Registration deadline \(unparsed, verify manually\): 10\/05\/2026/);
  assert.match(result.notes, /Submission deadline \(unparsed, verify manually\): Oct 20 2026 23:59/);
});

test('a later edition with the same name is not mistaken for a duplicate', () => {
  const older = previewHackathonImport([headers, record('Annual Challenge', 'https://example.com/2026')]).added;
  const newer = record('Annual Challenge', 'https://example.com/2027');
  newer[2] = '2027-10-05'; newer[3] = '2027-10-20';
  const result = previewHackathonImport([headers, newer], older);
  assert.equal(result.added.length, 1);
});
