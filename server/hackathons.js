const STATUSES = ['Registered', 'Brainstorming', 'Idea Finalized', 'Planning', 'Building', 'Testing', 'PPT / Submission Preparation', 'Submitted'];

function validateHackathons(rows, user) {
  if (rows === undefined) return '';
  if (!Array.isArray(rows)) return 'Hackathons must be an array.';
  if (rows.length && user.username?.toLowerCase() !== 'aadarsh') return 'Hackathons are available only for Aadarsh.';
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) return 'Hackathons must have unique IDs.';
    ids.add(row.id);
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 200) return 'Enter a valid hackathon name.';
    try {
      if (typeof row.url !== 'string' || row.url.length > 2000 || !['https:', 'http:'].includes(new URL(row.url).protocol)) return 'Enter a valid official URL.';
    } catch { return 'Enter a valid official URL.'; }
    if (typeof row.deadline !== 'string' || !Number.isFinite(Date.parse(row.deadline))) return 'Enter a valid submission deadline.';
    if (!STATUSES.includes(row.status)) return 'Choose a valid hackathon progress status.';
    for (const key of ['idea', 'notes']) {
      if (typeof row[key] !== 'string' || row[key].length > 10000) return `Enter valid hackathon ${key}.`;
    }
    if (typeof row.archived !== 'boolean') return 'Choose a valid hackathon archive state.';
  }
  return '';
}
module.exports = { validateHackathons };
