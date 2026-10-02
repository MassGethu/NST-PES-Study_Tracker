export const HACKATHON_STATUSES = [
  'Registration Pending', 'Registered', 'Brainstorming', 'Idea Finalized', 'Planning', 'Building',
  'Testing', 'PPT / Submission Preparation', 'Submitted',
];
export const EVENT_FIELDS = ['registrationDeadline', 'deadline', 'domains', 'rules', 'prize', 'purpose', 'eligibility', 'teamLimit'];
export const EVENT_LABELS = { registrationDeadline: 'Registration deadline', deadline: 'Submission deadline', domains: 'Domains', rules: 'Rules', prize: 'Prize', purpose: 'Purpose', eligibility: 'Eligibility', teamLimit: 'Team size' };

export function isHackathonUser(user) { return user?.username?.toLowerCase() === 'aadarsh'; }
export function officialUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function newHackathon(id, name, url) {
  return { id, name: name.trim(), url: officialUrl(url), deadline: '', registrationDeadline: '',
    status: 'Registration Pending', idea: '', notes: '', archived: false, difficulty: null,
    domains: '', rules: '', prize: '', purpose: '', eligibility: '', teamLimit: '',
    ideaId: '', nextAction: '', nextActionDate: '', createdAt: new Date().toISOString() };
}
export function validateHackathon(row) {
  if (!row.name?.trim()) return 'Enter a hackathon name.';
  if (!officialUrl(row.url)) return 'Enter a valid http:// or https:// official URL.';
  for (const key of ['deadline', 'registrationDeadline']) {
    if (row[key] && !Number.isFinite(Date.parse(row[key]))) return `Choose a valid ${EVENT_LABELS[key].toLowerCase()}.`;
  }
  if (row.difficulty != null && ![1, 2, 3, 4, 5].includes(row.difficulty)) return 'Choose a difficulty from 1 to 5 stars.';
  if (!HACKATHON_STATUSES.includes(row.status)) return 'Choose a progress status.';
  return '';
}
export function hackathonDeadline(row) {
  const pending = row.status === 'Registration Pending';
  return { label: pending ? 'Registration' : 'Submission', value: pending ? row.registrationDeadline : row.deadline };
}
export function sortedHackathons(rows = [], archived = false) {
  return rows.filter(row => Boolean(row.archived) === archived)
    .sort((a, b) => (Date.parse(hackathonDeadline(a).value) || Infinity) - (Date.parse(hackathonDeadline(b).value) || Infinity));
}
export function localDeadline(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function formatDeadline(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unknown';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return `${new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · time unknown`;
  }
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Work reminders stay visible when overdue; submitted and archived work never alerts.
export function hackathonReminders(rows = [], now = Date.now()) {
  return rows.filter(row => !row.archived && row.status !== 'Submitted').flatMap(row => {
    const submissionDays = row.difficulty == null || row.difficulty >= 3 ? 7 : 3;
    const sameDeadline = row.registrationDeadline && row.deadline && Date.parse(row.registrationDeadline) === Date.parse(row.deadline);
    const deadline = hackathonDeadline(row);
    const windowDays = row.status === 'Registration Pending' && !sameDeadline ? 2 : submissionDays;
    const due = Date.parse(deadline.value);
    if (!Number.isFinite(due) || due - now > windowDays * 86400000) return [];
    return [{ row, ...deadline, overdue: due < now }];
  }).sort((a, b) => Date.parse(a.value) - Date.parse(b.value));
}

// Autofill only empty, unchanged facts. A slow response cannot overwrite the user's edits.
export function applyHackathonFacts(current, captured, result) {
  if (current.url !== captured.url || current.name !== captured.name) return current;
  const next = { ...current, sources: { ...(current.sources || {}) }, researchAt: result.researchedAt,
    researchStatus: 'done', researchError: '', researchWarnings: result.warnings || [], searchSuggestions: result.searchSuggestions || '' };
  for (const key of EVENT_FIELDS) {
    if (!current[key] && current[key] === captured[key] && result.facts[key]?.value) {
      next[key] = result.facts[key].value;
      next.sources[key] = result.facts[key].sources;
    }
  }
  return next;
}
