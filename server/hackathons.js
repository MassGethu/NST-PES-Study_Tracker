const STATUSES = ['Registration Pending', 'Registered', 'Brainstorming', 'Idea Finalized', 'Planning', 'Building', 'Testing', 'PPT / Submission Preparation', 'Submitted'];
const FACT_FIELDS = ['registrationDeadline', 'deadline', 'domains', 'rules', 'prize', 'purpose', 'eligibility', 'teamLimit'];
function validUrl(value) {
  try { const url = new URL(value); return typeof value === 'string' && value.length <= 2000 && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function text(value, max = 10000) { return typeof value === 'string' && value.length <= max; }
function optionalDate(value) { return value === undefined || value === '' || (typeof value === 'string' && Number.isFinite(Date.parse(value))); }
function validateHackathons(rows, user) {
  if (rows === undefined) return '';
  if (!Array.isArray(rows)) return 'Hackathons must be an array.';
  if (rows.length && user.username?.toLowerCase() !== 'aadarsh') return 'Hackathons are available only for Aadarsh.';
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) return 'Hackathons must have unique IDs.';
    ids.add(row.id);
    if (!text(row.name, 200) || !row.name.trim()) return 'Enter a valid hackathon name.';
    if (!validUrl(row.url)) return 'Enter a valid official URL.';
    if (!optionalDate(row.deadline)) return 'Enter a valid submission deadline.';
    if (!optionalDate(row.registrationDeadline)) return 'Enter a valid registration deadline.';
    if (!STATUSES.includes(row.status)) return 'Choose a valid hackathon progress status.';
    for (const key of ['idea', 'notes']) if (!text(row[key])) return `Enter valid hackathon ${key}.`;
    for (const key of ['domains', 'rules', 'prize', 'purpose', 'eligibility', 'teamLimit', 'nextAction', 'ideaId']) {
      if (row[key] !== undefined && !text(row[key])) return `Enter valid hackathon ${key}.`;
    }
    if (!optionalDate(row.nextActionDate)) return 'Enter a valid next action date.';
    if (row.difficulty != null && ![1, 2, 3, 4, 5].includes(row.difficulty)) return 'Difficulty must be 1–5 stars.';
    if (typeof row.archived !== 'boolean') return 'Choose a valid hackathon archive state.';
    if (row.sourceText !== undefined && !text(row.sourceText, 40000)) return 'Invalid event source text.';
    if (row.researchCache !== undefined && JSON.stringify(row.researchCache).length > 150000) return 'Event research cache is too large.';
    if (row.sources !== undefined) {
      if (!row.sources || typeof row.sources !== 'object' || Array.isArray(row.sources)) return 'Invalid event sources.';
      for (const sources of Object.values(row.sources)) {
        if (!Array.isArray(sources) || sources.length > 20 || sources.some(s => !s || !validUrl(s.url) || !text(s.title, 500) || (s.excerpt !== undefined && !text(s.excerpt, 1000)))) return 'Invalid event sources.';
      }
    }
    if (row.researchWarnings !== undefined && (!Array.isArray(row.researchWarnings) || row.researchWarnings.length > 20 || row.researchWarnings.some(w => !text(w, 1000)))) return 'Invalid event warnings.';
    if (row.searchSuggestions !== undefined && !text(row.searchSuggestions, 100000)) return 'Invalid search suggestions.';
  }
  return '';
}
function validateIdeas(rows, user) {
  if (rows === undefined) return '';
  if (!Array.isArray(rows)) return 'Idea bank must be an array.';
  if (rows.length && user.username?.toLowerCase() !== 'aadarsh') return 'Idea bank is available only for Aadarsh.';
  const ids = new Set();
  for (const row of rows) {
    if (!row || !text(row.id, 200) || !row.id || ids.has(row.id)) return 'Ideas must have unique IDs.';
    ids.add(row.id);
    if (!text(row.title, 200) || !row.title.trim() || !text(row.description) || !text(row.domains, 2000)) return 'Enter a valid idea title, description and domains.';
  }
  return '';
}
module.exports = { validateHackathons, validateIdeas, validUrl, FACT_FIELDS };
