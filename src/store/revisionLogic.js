/**
 * revisionLogic.js
 *
 * Spaced-repetition schedule (2 times only):
 * Round 1: +4 days after lecture date
 * Round 2: +10 days after 1st revision
 * After Round 2: Topic revision is completed
 */

import { addDays, today } from './utils.js';

export const INTERVALS = [4, 10];

/** Compute next-revision date from a topic */
export function getNextRevisionDate(topic) {
  if (topic.revisionCompleted || (topic.revisionCount ?? topic.revisionStage ?? 0) >= 2) {
    return null;
  }
  const count = topic.revisionCount ?? topic.revisionStage ?? 0;
  if (count === 0) {
    const base = topic.date || today();
    return addDays(base, 4);
  }
  if (count === 1) {
    const base = topic.lastRevised || topic.date || today();
    return addDays(base, 10);
  }
  return null;
}

/**
 * Return updated topic fields after a revision.
 * @param {object} topic
 * @param {'high'|'medium'|'low'} confidence
 * @returns {object} partial topic fields to merge
 */
export function markRevised(topic, confidence) {
  const currentCount = topic.revisionCount ?? topic.revisionStage ?? 0;
  const newCount = currentCount + 1;
  const now = today();
  const confMap = { high: 4, medium: 3, low: 2 };

  if (newCount >= 2) {
    // Completed after 2 revisions
    return {
      revisionStage: 2,
      revisionCount: 2,
      revisionCompleted: true,
      lastRevised: now,
      confidence: confMap[confidence] ?? topic.confidence,
      needsRevision: false,
      _nextRevision: null,
    };
  }

  // 1st revision completed, 2nd due in 10 days
  const nextRevision = addDays(now, 10);
  return {
    revisionStage: 1,
    revisionCount: 1,
    revisionCompleted: false,
    lastRevised: now,
    confidence: confMap[confidence] ?? topic.confidence,
    needsRevision: false,
    _nextRevision: nextRevision,
  };
}

