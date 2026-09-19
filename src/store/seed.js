/**
 * seed.js — Pre-populated subjects, timetable, and one sample contest week.
 * Applied on first launch; all data is editable in Settings.
 */

import { uuid, today, getMondayOf } from './utils.js';

export function buildSeedData() {
  const subjects = [
    { id: 's-dsa',  name: 'DSA',           color: '#f97316' },
    { id: 's-math', name: 'Math',           color: '#06b6d4' },
    { id: 's-web',  name: 'Web Dev',        color: '#10b981' },
    { id: 's-comm', name: 'Communication',  color: '#f59e0b' },
  ];

  // Mon–Fri timetable (two subjects per day, typical fast-paced college)
  const timetable = {
    Mon: ['s-dsa',  's-math'],
    Tue: ['s-web',  's-comm'],
    Wed: ['s-dsa',  's-web'],
    Thu: ['s-math', 's-comm'],
    Fri: ['s-dsa',  's-math'],  // Often DSA/Math contest day
    Sat: [],
    Sun: [],
  };

  // Seed this week's contest as DSA (most common first week)
  const contestWeek = {
    id: uuid(),
    weekStart: getMondayOf(today()),
    subjectId: 's-dsa',
    problemsSolved: 0,
    mistakesLog: [],
    manualConfidenceOverride: null,
  };

  return { subjects, timetable, contestWeeks: [contestWeek] };
}
