import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referencesFor, hasRecallReference, recallStatus } from './recall.js';

test('concept tags, blank notes and unvisited links are not assessment references', () => {
  const topic = { id: 'lecture', topicName: 'Computers', concepts: ['Definition of computer'], bullets: [' ', ''], notes: 'https://notebooklm.google.com/notebook/example' };
  assert.equal(hasRecallReference(topic), false);
  assert.equal(referencesFor([topic])[0].concepts[0], 'Definition of computer');
  assert.equal(recallStatus({ status: 'failed', lectures: referencesFor([topic]) }), 'Notes needed');
  assert.equal(hasRecallReference({ ...topic, photos: ['saved photo'], audio: 'saved audio' }), false);
});

test('saved text or generated multimodal notes make recall assessment available', () => {
  const topic = { id: 'lecture', topicName: 'Computers', bullets: [' A computer processes data. '], notes: '' };
  assert.equal(referencesFor([topic])[0].reference, 'A computer processes data.');
  assert.equal(hasRecallReference(topic), true);
  assert.equal(referencesFor([{ ...topic, ai_notes: ' AI summary ' }])[0].reference, 'AI summary');
  assert.equal(recallStatus({ status: 'failed', lectures: referencesFor([topic]) }), 'Assessment failed');
  assert.equal(recallStatus({ status: 'complete', lectures: referencesFor([topic]) }), 'Assessed');
});
