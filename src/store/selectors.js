/**
 * selectors.js — Pure derived-query functions.
 * Never call localStorage directly; receive state as argument.
 */

import { getNextRevisionDate } from './revisionLogic.js';
import { today, getDayKey, getMondayOf, daysUntil, addDays, RELEVANCE_WEIGHT } from './utils.js';

/** Weekly persistent tasks for the week containing weekStart (defaults to current week) */
export function getWeeklyTasks(state, weekStart) {
  const ws = weekStart || getMondayOf(today());
  return (state.weeklyTasks || []).filter(t => t.weekStart === ws);
}

/** Checklist items for a specific date + type */
export function getChecklistForDate(state, date, type) {
  return (state.weeklyChecklist || [])
    .filter(item => item.date === date && item.type === type)
    .sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

/** Activities for a specific date */
export function getActivitiesForDate(state, date) {
  const activityTypes = ['event', 'fitness', 'outing', 'reminder'];
  return (state.weeklyChecklist || [])
    .filter(item => item.date === date && activityTypes.includes(item.type))
    .sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

/** Revision topics due on or before a given date */
export function getRevisionDueForDate(state, date) {
  return getEnrichedTopics(state)
    .filter(t => t.nextRevision <= date)
    .sort((a, b) => a.nextRevision.localeCompare(b.nextRevision));
}

/** Enrich a topic with derived fields */
export function enrichTopic(topic) {
  return {
    ...topic,
    // An explicitly opted-out new topic has no revision date. Preserve an
    // already-scheduled `_nextRevision` from round one for legacy entries.
    nextRevision: topic._nextRevision || (topic.needsRevision === false ? null : getNextRevisionDate(topic)),
  };
}

/** All topics enriched */
export function getEnrichedTopics(state) {
  return (state.topics || []).map(enrichTopic);
}

/** Topics due for revision (nextRevision <= today) */
export function getRevisionDue(state) {
  const td = today();
  return getEnrichedTopics(state)
    .filter(t => t.nextRevision <= td)
    .sort((a, b) => a.nextRevision.localeCompare(b.nextRevision));
}

/** Subjects for today's timetable */
export function getTodaySubjects(state) {
  const dayKey = getDayKey(today());
  const ids = (state.timetable || {})[dayKey] || [];
  return ids
    .map(id => (state.subjects || []).find(s => s.id === id))
    .filter(Boolean);
}

/** Active contest week (closest to / containing today) */
export function getActiveContestWeek(state) {
  const weeks = state.contestWeeks || [];
  if (!weeks.length) return null;
  const td = today();
  const thisMonday = getMondayOf(td);
  const byRecentSelection = (a, b) => (b.selectedAt || '').localeCompare(a.selectedAt || '');
  const currentWeeks = weeks.filter(w => w.weekStart === thisMonday).sort(byRecentSelection);
  return currentWeeks[0] || [...weeks].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart) || byRecentSelection(a, b)
  )[0];
}

/** Topics for the active contest subject in current syllabus cycle */
export function getContestTopics(state, contestWeek) {
  if (!contestWeek || !contestWeek.subjectId) return [];
  const allTopics = getEnrichedTopics(state).filter(
    t => t.subjectId === contestWeek.subjectId
  );

  // If this contest is already completed with topics snapshot, return those
  if (contestWeek.completed && contestWeek.topicsCovered?.length) {
    const topicMap = new Set(contestWeek.topicsCovered);
    const snapshotted = allTopics.filter(t => topicMap.has(t.id));
    if (snapshotted.length > 0) return snapshotted;
  }

  // Find previous completed contest for this subject
  const pastCompleted = (state.contestWeeks || [])
    .filter(w => w.subjectId === contestWeek.subjectId && w.completed && w.weekStart < contestWeek.weekStart)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  if (pastCompleted) {
    const cutoff = pastCompleted.completedAt || pastCompleted.weekStart;
    return allTopics.filter(t => t.date >= cutoff);
  }

  return allTopics;
}

/** Weighted confidence % for a set of topics */
export function computeContestConfidence(topics) {
  if (!topics.length) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const t of topics) {
    const w = RELEVANCE_WEIGHT[t.contestRelevance] || 1;
    weightedSum += (t.understoodPct || 0) * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/** Checklist items for today (given type: 'must'|'optional') */
export function getTodayChecklist(state, type) {
  const td = today();
  return (state.weeklyChecklist || [])
    .filter(item => item.date === td && item.type === type)
    .sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

/** Today's activities (events, fitness, outings, reminders) sorted by time */
export function getTodayActivities(state) {
  const td = today();
  const activityTypes = ['event', 'fitness', 'outing', 'reminder'];
  return (state.weeklyChecklist || [])
    .filter(item => item.date === td && activityTypes.includes(item.type))
    .sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

/** Subject by id */
export function getSubject(state, id) {
  return (state.subjects || []).find(s => s.id === id) || null;
}

/** Revision queue: overdue / today / this week */
export function getRevisionQueue(state) {
  const td = today();
  const enriched = getEnrichedTopics(state);
  const pending = enriched.filter(t => Boolean(t.nextRevision) && !t.revisionCompleted && (t.revisionCount ?? t.revisionStage ?? 0) < 2);
  const overdue = pending
    .filter(t => t.nextRevision < td)
    .sort((a, b) => a.nextRevision.localeCompare(b.nextRevision));
  const dueToday = pending
    .filter(t => t.nextRevision === td)
    .sort((a, b) => (a.confidence || 3) - (b.confidence || 3));
  // Next 7 days
  const weekEnd = addDays(td, 7);
  const thisWeek = pending
    .filter(t => t.nextRevision > td && t.nextRevision <= weekEnd)
    .sort((a, b) => a.nextRevision.localeCompare(b.nextRevision));
  return { overdue, dueToday, thisWeek };
}

/** Days until next Friday from today */
export function daysUntilFriday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,...5=Fri
  const diff = day <= 5 ? 5 - day : 7 - (day - 5);
  return diff === 0 ? 0 : diff;
}
