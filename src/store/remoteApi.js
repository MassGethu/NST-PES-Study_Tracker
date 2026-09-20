async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (response.status !== 204 && !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The server did not return an API response. Check the deployment’s API routing.');
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const remoteApi = {
  me: () => request('/api/auth/me'),
  changePassword: payload => request('/api/auth/password', { method: 'POST', body: JSON.stringify(payload) }),
  login: payload => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getState: () => request('/api/state'),
  saveState: (state, baseVersion, accountId) => request('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ state, baseVersion, accountId }),
  }),
};

function mergeById(remoteItems = [], localItems = [], fallbackKey = 'id') {
  const merged = new Map();
  remoteItems.forEach(item => merged.set(item[fallbackKey], item));
  localItems.forEach(item => merged.set(item[fallbackKey], item));
  return [...merged.values()];
}

export function mergeAppStates(remote, local) {
  if (!remote) return local;
  if (!local) return remote;
  const timetable = {};
  const days = new Set([...Object.keys(remote.timetable || {}), ...Object.keys(local.timetable || {})]);
  days.forEach(day => {
    timetable[day] = [...new Set([...(remote.timetable?.[day] || []), ...(local.timetable?.[day] || [])])];
  });
  return {
    ...remote,
    ...local,
    subjects: mergeById(remote.subjects, local.subjects),
    recallSessions: mergeById(remote.recallSessions, local.recallSessions),
    topics: mergeById(remote.topics, local.topics),
    weeklyChecklist: mergeById(remote.weeklyChecklist, local.weeklyChecklist),
    weeklyTasks: mergeById(remote.weeklyTasks, local.weeklyTasks),
    contestWeeks: mergeById(remote.contestWeeks, local.contestWeeks),
    carryForwardPromptedDates: [...new Set([
      ...(remote.carryForwardPromptedDates || []),
      ...(local.carryForwardPromptedDates || []),
    ])],
    timetable,
    _seeded: true,
  };
}
