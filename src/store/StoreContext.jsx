/**
 * StoreContext.jsx — Global state via React Context + useReducer.
 * All mutations go through dispatch(). State is persisted on every change.
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, useState } from 'react';
import { emptyState, normalizeState, readCache, writeCache, downloadBackup } from './accountStorage.js';
import { remoteApi } from './remoteApi.js';
import { uuid, today, getMondayOf } from './utils.js';
import { markRevised as applyMarkRevised } from './revisionLogic.js';
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

// Legacy records are loaded verbatim: account assignment must not rerun old data migrations.

function matchesContest(contest, action) {
  if (action.id) return contest.id === action.id;
  if (action.subjectId) return contest.weekStart === action.weekStart && contest.subjectId === action.subjectId;
  return contest.weekStart === action.weekStart;
}

function reducer(state, action) {
  switch (action.type) {
    case 'SAVE_WORKSHEET':
      return { ...state, worksheets: [...(state.worksheets || []).filter(w => w.id !== action.payload.id), action.payload] };
    case 'DELETE_WORKSHEET':
      return { ...state, worksheets: (state.worksheets || []).filter(w => w.id !== action.id) };
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
      return normalizeState(action.payload);
    }

    default:
      return state;
  }
}

// ── Context setup ─────────────────────────────────────────────────────────────

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, null, emptyState);
  const [account, setAccount] = useState({ user: null, status: 'checking', syncStatus: 'local', error: '' });
  const sessionRef = useRef(null);
  const stateRef = useRef(state);
  const pendingRef = useRef(false);
  const queueRef = useRef(Promise.resolve());
  const timerRef = useRef(null);
  const connectingRef = useRef(null);

  function dispatch(action) {
    if (!sessionRef.current) return;
    const next = reducer(stateRef.current, action);
    stateRef.current = next;
    pendingRef.current = true;
    rawDispatch({ type: 'REPLACE_STORE', payload: next });
    try { writeCache(sessionRef.current.id, next, sessionRef.current.version, true); }
    catch { setAccount(a => ({ ...a, error: 'Browser backup is full. Keep this page open until online saving finishes.' })); }
  }

  async function connectAccount(user) {
    setAccount({ user: null, status: 'checking', syncStatus: 'syncing', error: '' });
    const remote = await remoteApi.getState();
    if (remote.accountId !== user.id) throw new Error('Account changed in another tab. Sign in again.');
    const cache = readCache(user.id);
    const conflict = cache?.pending && cache.version !== remote.version;
    const next = normalizeState(cache?.pending ? cache.state : remote.state);
    sessionRef.current = { id: user.id, version: remote.version, conflict };
    stateRef.current = next;
    pendingRef.current = Boolean(cache?.pending);
    rawDispatch({ type: 'REPLACE_STORE', payload: next });
    setAccount({ user, status: 'signed-in', syncStatus: conflict ? 'error' : cache?.pending ? 'saving' : 'synced',
      error: conflict ? 'Another session changed the server copy. Your unsaved browser copy is preserved. Export it in Settings, then reload the server copy.' : '' });
    try { localStorage.setItem('nst_active_account', user.id); } catch { /* Server ownership checks remain authoritative. */ }
  }

  useEffect(() => {
    let active = true;
    // Reuse the initial request during StrictMode's effect replay.
    connectingRef.current ||= remoteApi.me();
    connectingRef.current.then(async ({ user }) => {
      if (!active) return;
      if (user) await connectAccount(user);
      else setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: '' });
    }).catch(error => {
      if (active) setAccount({ user: null, status: 'anonymous', syncStatus: 'error', error: error.message });
    });
    return () => { active = false; };
  }, []);

  function flush() {
    clearTimeout(timerRef.current);
    const run = queueRef.current.catch(() => {}).then(async () => {
      const session = sessionRef.current;
      if (!session || !pendingRef.current) return;
      if (session.conflict) throw new Error('Resolve the sync conflict in Settings before saving.');
      const snapshot = stateRef.current;
      try {
        const saved = await remoteApi.saveState(snapshot, session.version, session.id);
        if (sessionRef.current !== session) return;
        session.version = saved.version;
        pendingRef.current = stateRef.current !== snapshot;
        try { writeCache(session.id, stateRef.current, saved.version, pendingRef.current); } catch { /* Remote save succeeded. */ }
        setAccount(a => ({ ...a, syncStatus: pendingRef.current ? 'saving' : 'synced', error: '' }));
      } catch (error) {
        if (error.status === 409 || error.status === 401) session.conflict = true;
        setAccount(a => ({ ...a, syncStatus: 'error', error: error.message }));
        throw error;
      }
    });
    queueRef.current = run;
    return run;
  }

  useEffect(() => {
    if (!sessionRef.current || !pendingRef.current || sessionRef.current.conflict) return;
    setAccount(a => ({ ...a, syncStatus: 'saving' }));
    timerRef.current = setTimeout(() => { flush().catch(() => {}); }, 500);
    return () => clearTimeout(timerRef.current);
  }, [state]);

  useEffect(() => {
    const warn = event => { if (pendingRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const switched = event => {
      if (event.key !== 'nst_active_account' || !sessionRef.current || event.newValue === sessionRef.current.id) return;
      // The per-account pending copy stays on disk. Hide the previous user's UI immediately.
      clearTimeout(timerRef.current);
      sessionRef.current = null;
      pendingRef.current = false;
      stateRef.current = emptyState();
      rawDispatch({ type: 'REPLACE_STORE', payload: stateRef.current });
      setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: 'Account changed in another tab. Please sign in again.' });
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('storage', switched);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('storage', switched); };
  }, []);

  async function login(credentials) {
    setAccount(a => ({ ...a, status: 'checking', error: '' }));
    try {
      const { user } = await remoteApi.login(credentials);
      await connectAccount(user);
      return { ok: true };
    } catch (error) {
      sessionRef.current = null;
      setAccount({ user: null, status: 'anonymous', syncStatus: 'error', error: error.message });
      return { ok: false, error: error.message };
    }
  }

  async function logout() {
    try {
      await flush();
      if (pendingRef.current) await flush();
      await remoteApi.logout();
      try { localStorage.setItem('nst_active_account', ''); } catch { /* Best-effort notification. */ }
      sessionRef.current = null;
      pendingRef.current = false;
      stateRef.current = emptyState();
      rawDispatch({ type: 'REPLACE_STORE', payload: stateRef.current });
      setAccount({ user: null, status: 'anonymous', syncStatus: 'local', error: '' });
    } catch (error) { setAccount(a => ({ ...a, error: 'Sign out stopped to protect unsaved data. ' + error.message })); }
  }

  async function reloadServer() {
    if (pendingRef.current) downloadBackup(stateRef.current, 'unsaved-safety-copy');
    await queueRef.current.catch(() => {});
    const remote = await remoteApi.getState();
    if (remote.accountId !== sessionRef.current.id) throw new Error('Account changed in another tab. Reopen the website to sign in again.');
    sessionRef.current.version = remote.version;
    sessionRef.current.conflict = false;
    pendingRef.current = false;
    stateRef.current = normalizeState(remote.state);
    writeCache(sessionRef.current.id, stateRef.current, remote.version, false);
    rawDispatch({ type: 'REPLACE_STORE', payload: stateRef.current });
    setAccount(a => ({ ...a, syncStatus: 'synced', error: '' }));
  }

  const isWorksheet = account.user?.role === 'student_worksheet';

  // Derived values (memoised)
  const derived = useMemo(() => ({
    revisionDue:          getRevisionDue(state),
    todaySubjects:        getTodaySubjects(state),
    activeContest:        isWorksheet ? null : getActiveContestWeek(state),
    todayMust:            getTodayChecklist(state, 'must'),
    todayOptional:        getTodayChecklist(state, 'optional'),
    todayActivities:      getTodayActivities(state),
    revisionQueue:        getRevisionQueue(state),
    daysUntilFriday:      daysUntilFriday(),
    weeklyTasks:          getWeeklyTasks(state),
    getContestTopics:     (cw) => isWorksheet ? [] : getContestTopics(state, cw),
    getContestConfidence: (topics) => isWorksheet ? 0 : computeContestConfidence(topics),
    getSubject:           (id) => getSubject(state, id),
    getChecklistForDate:  (date, type) => getChecklistForDate(state, date, type),
    getActivitiesForDate: (date) => getActivitiesForDate(state, date),
    getRevisionDueForDate:(date) => getRevisionDueForDate(state, date),
    getWeeklyTasks:       (ws) => getWeeklyTasks(state, ws),
  }), [state, isWorksheet]);

  return (
    <StoreContext.Provider value={{ state, dispatch, derived, account, login, logout, isWorksheet, flush, reloadServer }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
