export const HACKATHON_STATUSES = [
  'Registration Pending', 'Registered', 'Brainstorming', 'Idea Finalized', 'Planning', 'Building',
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
  if (row.status === 'Registration Pending' && !row.registrationDeadline) return 'Choose a registration deadline.';
  if (row.registrationDeadline && !Number.isFinite(Date.parse(row.registrationDeadline))) return 'Choose a valid registration deadline.';
  if (!HACKATHON_STATUSES.includes(row.status)) return 'Choose a progress status.';
  return '';
}

export function sortedHackathons(rows = [], archived = false) {
  return rows.filter(row => Boolean(row.archived) === archived)
    .sort((a, b) => Date.parse(hackathonDeadline(a).value) - Date.parse(hackathonDeadline(b).value));
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

export function hackathonDeadline(row) {
  return row.status === 'Registration Pending'
    ? { label: 'Registration', value: row.registrationDeadline }
    : { label: 'Submission', value: row.deadline };
}
