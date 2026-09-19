/**
 * StoreContext.jsx — Global state via React Context + useReducer.
 * All mutations go through dispatch(). State is persisted on every change.
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, useState } from 'react';
import { loadStore, saveStore, hasStoredStore, backupLocalStore, getSyncOwner, setSyncOwner } from './db.js';
import { mergeAppStates, remoteApi } from './remoteApi.js';
import { buildSeedData } from './seed.js';
import { uuid, today } from './utils.js';
import { markRevised as applyMarkRevised } from './revisionLogic.js';
import { addHistoricalLectures } from './historicalLectures.js';
import {
  getRevisionDue, getTodaySubjects, getActiveContestWeek,
  getContestTopics, computeContestConfidence, getTodayChecklist,
  getRevisionQueue, getSubject, daysUntilFriday, getTodayActivities,
  getWeeklyTasks, getChecklistForDate, getActivitiesForDate, getRevisionDueForDate,
} from './selectors.js';

// ── Reducer ──────────────────────────────────────────────────────────────────

export const DISTINCT_COLORS = [
  '#3b82f6', // Vibrant Blue (e.g. M1)
  '#8b5cf6', // Vibrant Purple (e.g. S&AI)
  '#f59e0b', // Vibrant Amber/Gold (e.g. Physics)
  '#10b981', // Vibrant Emerald (e.g. PSP)
  '#ec4899', // Vibrant Rose Pink (e.g. English)
  '#06b6d4', // Vibrant Cyan
  '#f97316', // Vibrant Orange
  '#14b8a6', // Vibrant Teal
  '#6366f1', // Vibrant Indigo
  '#ef4444', // Vibrant Red
];

// Helper to consolidate lab subjects and assign distinct colors
function consolidateSubjects(rawState) {
  if (!rawState || !rawState.subjects) return rawState;

  let subjects = [...rawState.subjects];
  let topics = [...(rawState.topics || [])];
  let timetable = { ...(rawState.timetable || {}) };

  // Map to find base subject for any lab subject
  const labSubjectMap = {}; // labSubjectId -> parentSubjectId

  // First pass: identify lab subjects and pair with non-lab base subjects
  subjects.forEach(s => {
    const isLab = /\s+lab$/i.test(s.name) || s.id.endsWith('-lab') || /lab$/i.test(s.name);
    if (isLab) {
      const baseName = s.name.replace(/\s+lab$/i, '').replace(/lab$/i, '').trim().toLowerCase();
      // Find matching base subject
      const parent = subjects.find(other =>
        other.id !== s.id &&
        (other.name.trim().toLowerCase() === baseName ||
         (baseName === 'physics' && other.name.trim().toLowerCase() === 'phy') ||
         (baseName === 'phy' && other.name.trim().toLowerCase() === 'physics'))
      );
      if (parent) {
        labSubjectMap[s.id] = parent.id;
      }
    }
  });

  // Remap topics
  topics = topics.map(t => {
    if (labSubjectMap[t.subjectId]) {
      return {
        ...t,
        subjectId: labSubjectMap[t.subjectId],
        sessionType: 'lab',
      };
    }
    return {
      ...t,
      sessionType: t.sessionType || 'lecture',
    };
  });

  // Remap timetable
  Object.keys(timetable).forEach(day => {
    const dayList = timetable[day] || [];
    const remapped = dayList.map(id => labSubjectMap[id] || id);
    timetable[day] = [...new Set(remapped)];
  });

  // Remove lab subjects that were merged
  subjects = subjects.filter(s => !labSubjectMap[s.id]);

  // Clean names (e.g., if "Phy" -> "Physics") and assign curated distinct colors
  subjects = subjects.map((s, idx) => ({
    ...s,
    color: DISTINCT_COLORS[idx % DISTINCT_COLORS.length],
  }));

  return {
    ...rawState,
    subjects,
    topics,
    timetable,
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function repairContestSubjectAssignments(state) {
  const topicsById = new Map((state.topics || []).map(topic => [topic.id, topic]));
  const contestWeeks = (state.contestWeeks || []).map(contest => {
    if (!contest.completed || !contest.topicsCovered?.length) return contest;
    const counts = new Map();
    contest.topicsCovered.forEach(topicId => {
      const subjectId = topicsById.get(topicId)?.subjectId;
      if (subjectId) counts.set(subjectId, (counts.get(subjectId) || 0) + 1);
    });
    const [snapshotSubjectId, count = 0] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    const hasClearSubject = snapshotSubjectId && count > contest.topicsCovered.length / 2;
    return hasClearSubject && snapshotSubjectId !== contest.subjectId
      ? { ...contest, subjectId: snapshotSubjectId }
      : contest;
  });
  return { ...state, contestWeeks };
}

function markCurrentUnderstoodLecturesComplete(state) {
  const migrationKey = '_lecture70To100Through20260919';
  if (!state || state[migrationKey]) return state;

  const topics = (state.topics || []).map(topic => {
    const isLecture = (topic.sessionType || 'lecture') === 'lecture';
    if (!isLecture || Number(topic.understoodPct) !== 70) return topic;
    return { ...topic, understoodPct: 100, confidence: 5 };
  });

  return { ...state, topics, [migrationKey]: true };
}

function matchesContest(contest, action) {
  if (action.id) return contest.id === action.id;
  if (action.subjectId) return contest.weekStart === action.weekStart && contest.subjectId === action.subjectId;
  return contest.weekStart === action.weekStart;
}

function reducer(state, action) {
  switch (action.type) {
    case 'SAVE_RECALL_SESSION': {
      const sessions = state.recallSessions || [];
      return { ...state, recallSessions: [
        action.payload, ...sessions.filter(session => session.id !== action.payload.id),
      ] };
    }

    // ── Subjects ──────────────────────────────────────────────────────────────
    case 'ADD_SUBJECT': {
      const nextColor = DISTINCT_COLORS[state.subjects.length % DISTINCT_COLORS.length];
      const s = { id: uuid(), color: nextColor, ...action.payload };
      return { ...state, subjects: [...state.subjects, s] };
    }
    case 'UPDATE_SUBJECT': {
      return {
        ...state,
        subjects: state.subjects.map(s => s.id === action.id ? { ...s, ...action.payload } : s),
      };
    }
    case 'DELETE_SUBJECT': {
      return {
        ...state,
        subjects: state.subjects.filter(s => s.id !== action.id),
        topics:   state.topics.filter(t => t.subjectId !== action.id),
      };
    }

    // ── Topics ────────────────────────────────────────────────────────────────
    case 'ADD_TOPIC': {
      const t = {
        id: uuid(),
        date: today(),
        sessionType: action.payload?.sessionType || 'lecture',
        concepts: [],
        difficulty: 3,
        understoodPct: 70,
        needsRevision: true,
        contestRelevance: 'Medium',
        notes: '',
        bullets: [''],
        lastRevised: null,
        revisionStage: 0,
        confidence: 3,
        _nextRevision: null,
        ...action.payload,
      };
      return { ...state, topics: [t, ...state.topics] };
    }
    case 'UPDATE_TOPIC': {
      return {
        ...state,
        topics: state.topics.map(t => t.id === action.id ? { ...t, ...action.payload } : t),
      };
    }
    case 'DELETE_TOPIC': {
      return { ...state, topics: state.topics.filter(t => t.id !== action.id) };
    }
    case 'MARK_REVISED': {
      const { id, confidence } = action;
      return {
        ...state,
        topics: state.topics.map(t =>
          t.id === id ? { ...t, ...applyMarkRevised(t, confidence) } : t
        ),
      };
    }

    // ── Timetable ─────────────────────────────────────────────────────────────
    case 'SET_TIMETABLE': {
      return { ...state, timetable: action.payload };
    }

    // ── Checklist (daily) ─────────────────────────────────────────────────────
    case 'ADD_CHECKLIST_ITEM': {
      const item = { id: uuid(), date: today(), done: false, ...action.payload };
      return { ...state, weeklyChecklist: [...state.weeklyChecklist, item] };
    }
    case 'TOGGLE_CHECKLIST_ITEM': {
      return {
        ...state,
        weeklyChecklist: state.weeklyChecklist.map(i =>
          i.id === action.id ? { ...i, done: !i.done } : i
        ),
      };
    }
    case 'DELETE_CHECKLIST_ITEM': {
      return {
        ...state,
        weeklyChecklist: state.weeklyChecklist.filter(i => i.id !== action.id),
      };
    }
    case 'CARRY_FORWARD_CHECKLIST_ITEMS': {
      const { itemIds, fromDate, toDate } = action;
      const selectedIds = new Set(itemIds || []);
      const existingKeys = new Set(
        (state.weeklyChecklist || [])
          .filter(item => item.date === toDate)
          .map(item => `${item.type}|${String(item.text || '').trim().toLowerCase()}`)
      );
      const carriedItems = (state.weeklyChecklist || [])
        .filter(item =>
          item.date === fromDate &&
          !item.done &&
          ['must', 'optional'].includes(item.type) &&
          selectedIds.has(item.id)
        )
        .filter(item => {
          const key = `${item.type}|${String(item.text || '').trim().toLowerCase()}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        })
        .map(item => ({
          ...item,
          id: uuid(),
          date: toDate,
          done: false,
          carriedFromId: item.id,
          carriedFromDate: fromDate,
        }));
      return {
        ...state,
        weeklyChecklist: [...state.weeklyChecklist, ...carriedItems],
        carryForwardPromptedDates: [...new Set([...(state.carryForwardPromptedDates || []), toDate])],
      };
    }
    case 'DISMISS_CARRY_FORWARD': {
      return {
        ...state,
        carryForwardPromptedDates: [...new Set([...(state.carryForwardPromptedDates || []), action.date])],
      };
    }

    // ── Contest weeks ─────────────────────────────────────────────────────────
    case 'SET_CONTEST_WEEK': {
      // Each subject keeps an independent record, even within the same week.
      const { weekStart, subjectId } = action.payload;
      const selectedAt = new Date().toISOString();
      const existing = state.contestWeeks.find(w => w.weekStart === weekStart && w.subjectId === subjectId);
      if (existing) {
        return {
          ...state,
          contestWeeks: state.contestWeeks.map(w =>
            w.id === existing.id ? { ...w, selectedAt } : w
          ),
        };
      }
      return {
        ...state,
        contestWeeks: [
          ...state.contestWeeks,
          { id: uuid(), weekStart, subjectId, selectedAt, problemsSolved: 0, mistakesLog: [], manualConfidenceOverride: null, completed: false },
        ],
      };
    }
    case 'UPDATE_CONTEST_WEEK': {
      return {
        ...state,
        contestWeeks: state.contestWeeks.map(w =>
          matchesContest(w, action) ? { ...w, ...action.payload } : w
        ),
      };
    }
    case 'COMPLETE_CONTEST': {
      const { id, weekStart, subjectId, score, contestNotes, keyLearnings, topicsCovered } = action.payload;
      return {
        ...state,
        contestWeeks: state.contestWeeks.map(w =>
          matchesContest(w, { id, weekStart, subjectId })
            ? {
                ...w,
                completed: true,
                completedAt: today(),
                score: score || '',
                contestNotes: contestNotes || '',
                keyLearnings: keyLearnings || '',
                topicsCovered: topicsCovered || [],
              }
            : w
        ),
      };
    }
    case 'REOPEN_CONTEST': {
      return {
        ...state,
        contestWeeks: state.contestWeeks.map(w =>
          matchesContest(w, action)
            ? { ...w, completed: false, completedAt: null }
            : w
        ),
      };
    }
    case 'ADD_MISTAKE': {
      const { weekStart, text } = action;
      return {
        ...state,
        contestWeeks: state.contestWeeks.map(w =>
          matchesContest(w, action)
            ? { ...w, mistakesLog: [...w.mistakesLog, { id: uuid(), timestamp: new Date().toISOString(), text }] }
            : w
        ),
      };
    }

    // ── Weekly persistent tasks ───────────────────────────────────────────────
    case 'ADD_WEEKLY_TASK': {
      const task = {
        id: uuid(),
        text: action.payload.text,
        done: false,
        weekStart: action.payload.weekStart || getMondayOf(today()),
        createdAt: today(),
      };
      return { ...state, weeklyTasks: [...(state.weeklyTasks || []), task] };
    }
    case 'TOGGLE_WEEKLY_TASK': {
      return {
        ...state,
        weeklyTasks: (state.weeklyTasks || []).map(t =>
          t.id === action.id ? { ...t, done: !t.done } : t
        ),
      };
    }
    case 'DELETE_WEEKLY_TASK': {
      return {
        ...state,
        weeklyTasks: (state.weeklyTasks || []).filter(t => t.id !== action.id),
      };
    }

    // ── Full store replace (import) ───────────────────────────────────────────
    case 'REPLACE_STORE': {
      return repairContestSubjectAssignments({ ...action.payload, _seeded: true });
    }

    default:
      return state;
  }
}

// ── Context setup ─────────────────────────────────────────────────────────────

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const isExistingBrowser = hasStoredStore();
    const stored = loadStore();
    let initial = stored;
    if (!initial._seeded) {
      const seed = buildSeedData();
      initial = { ...stored, ...seed, _seeded: true };
    }
    // Perform subject consolidation, then import the supplied lecture history once.
    const consolidated = consolidateSubjects(initial);
    const withHistory = isExistingBrowser ? addHistoricalLectures(consolidated) : consolidated;
    return markCurrentUnderstoodLecturesComplete(repairContestSubjectAssignments(withHistory));
  });
  const [account, setAccount] = useState({ user: null, status: 'checking', syncStatus: 'local', error: '' });
  const versionRef = useRef(0);
  const remoteReadyRef = useRef(false);
  const stateRef = useRef(state);
  const saveTimerRef = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  async function connectAccount(user) {
    setAccount({ user, status: 'signed-in', syncStatus: 'syncing', error: '' });
    const remote = await remoteApi.getState();
    versionRef.current = remote.version;
    const previousOwner = getSyncOwner();
    backupLocalStore();

    let nextState;
    if (!remote.state) {
      nextState = stateRef.current;
    } else if (!previousOwner || previousOwner === user.id) {
      nextState = mergeAppStates(remote.state, stateRef.current);
    } else {
      nextState = remote.state;
    }

    setSyncOwner(user.id);
    dispatch({ type: 'REPLACE_STORE', payload: nextState });
    const saved = await remoteApi.saveState(nextState, versionRef.current);
    versionRef.current = saved.version;
    remoteReadyRef.current = true;
    setAccount({ user, status: 'signed-in', syncStatus: 'synced', error: '' });
  }

  useEffect(() => {
    let active = true;
    remoteApi.me()
      .then(async ({ user }) => {
        if (!active) return;
        if (user) await connectAccount(user);
        else setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: '' });
      })
      .catch(error => {
        if (active) setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: error.status === 503 ? '' : error.message });
      });
    return () => { active = false; };
  }, []);

  // Persist on every state change
  useEffect(() => {
    saveStore(state);
    if (!account.user || !remoteReadyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setAccount(current => ({ ...current, syncStatus: 'saving', error: '' }));
    saveTimerRef.current = setTimeout(async () => {
      try {
        const saved = await remoteApi.saveState(stateRef.current, versionRef.current);
        versionRef.current = saved.version;
        setAccount(current => ({ ...current, syncStatus: 'synced', error: '' }));
      } catch (error) {
        setAccount(current => ({ ...current, syncStatus: 'error', error: error.message }));
      }
    }, 750);
    return () => clearTimeout(saveTimerRef.current);
  }, [state]);

  async function register(credentials) {
    setAccount(current => ({ ...current, status: 'checking', error: '' }));
    try {
      const { user } = await remoteApi.register(credentials);
      await connectAccount(user);
      return { ok: true };
    } catch (error) {
      setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: error.message });
      return { ok: false, error: error.message };
    }
  }

  async function login(credentials) {
    setAccount(current => ({ ...current, status: 'checking', error: '' }));
    try {
      const { user } = await remoteApi.login(credentials);
      await connectAccount(user);
      return { ok: true };
    } catch (error) {
      setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: error.message });
      return { ok: false, error: error.message };
    }
  }

  async function logout() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try { await remoteApi.logout(); } catch { /* Local fallback remains available. */ }
    remoteReadyRef.current = false;
    versionRef.current = 0;
    setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: '' });
  }

  // Derived values (memoised)
  const derived = useMemo(() => ({
    revisionDue:          getRevisionDue(state),
    todaySubjects:        getTodaySubjects(state),
    activeContest:        getActiveContestWeek(state),
    todayMust:            getTodayChecklist(state, 'must'),
    todayOptional:        getTodayChecklist(state, 'optional'),
    todayActivities:      getTodayActivities(state),
    revisionQueue:        getRevisionQueue(state),
    daysUntilFriday:      daysUntilFriday(),
    weeklyTasks:          getWeeklyTasks(state),
    getContestTopics:     (cw) => getContestTopics(state, cw),
    getContestConfidence: (topics) => computeContestConfidence(topics),
    getSubject:           (id) => getSubject(state, id),
    getChecklistForDate:  (date, type) => getChecklistForDate(state, date, type),
    getActivitiesForDate: (date) => getActivitiesForDate(state, date),
    getRevisionDueForDate:(date) => getRevisionDueForDate(state, date),
    getWeeklyTasks:       (ws) => getWeeklyTasks(state, ws),
  }), [state]);

  return (
    <StoreContext.Provider value={{ state, dispatch, derived, account, register, login, logout }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
