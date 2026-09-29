export const HACKATHON_STATUSES = [
  'Registered', 'Brainstorming', 'Idea Finalized', 'Planning', 'Building',
  'Testing', 'PPT / Submission Preparation', 'Submitted',
];

export function isHackathonUser(user) {
  return user?.username?.toLowerCase() === 'aadarsh';
}

export function officialUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function validateHackathon(row) {
  if (!row.name?.trim()) return 'Enter a hackathon name.';
  if (!officialUrl(row.url)) return 'Enter a valid http:// or https:// official URL.';
  if (!row.deadline || !Number.isFinite(Date.parse(row.deadline))) return 'Choose a submission deadline.';
  if (!HACKATHON_STATUSES.includes(row.status)) return 'Choose a progress status.';
  return '';
}

export function sortedHackathons(rows = [], archived = false) {
  return rows.filter(row => Boolean(row.archived) === archived)
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
}

// datetime-local displays the deadline in the viewer's local time zone.
export function localDeadline(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatDeadline(value) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
