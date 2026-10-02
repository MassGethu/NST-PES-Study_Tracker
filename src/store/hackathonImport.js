import { newHackathon, officialUrl, validateHackathon } from './hackathons.js';

const columns = {
  name: ['name', 'hackathon name'],
  url: ['official url', 'registration url', 'hackathon url'],
  registrationDeadline: ['registration deadline'],
  deadline: ['submission deadline', 'final submission deadline'],
  location: ['location online status'],
  eligibility: ['eligibility'],
  teamLimit: ['team size', 'team limit'],
  domains: ['domains'],
  rules: ['rules summary', 'rules'],
  prize: ['prizes', 'prize'],
  sourceLinks: ['source links', 'sources'],
  verification: ['verification status'],
  checked: ['date last checked', 'last checked'],
};
const normalized = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cellText = value => value instanceof Date ? value.toISOString() : String(value ?? '').trim();

function deadline(value) {
  if (value === null || value === undefined || value === '') return { value: '', note: '' };
  const raw = cellText(value);
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
    return { value: value.toISOString().slice(0, 10), note: hasTime ? raw : '' };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw) return { value: raw, note: '' };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) && Number.isFinite(Date.parse(raw))) {
    return { value: new Date(raw).toISOString(), note: '' };
  }
  const zone = raw.match(/\s+(IST|UTC|GMT)$/i);
  if (zone) {
    const timestamp = Date.parse(`${raw.slice(0, zone.index)} GMT${zone[1].toUpperCase() === 'IST' ? '+0530' : '+0000'}`);
    if (Number.isFinite(timestamp)) return { value: new Date(timestamp).toISOString(), note: '' };
  }
  // A calendar date is useful, but it must not acquire an invented time or time zone.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) && !/\d{1,2}[:/]\d{2}/.test(raw) && !/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(raw)) {
    const timestamp = Date.parse(raw);
    if (Number.isFinite(timestamp)) return { value: new Date(timestamp).toISOString().slice(0, 10), note: '' };
  }
  return { value: '', note: raw };
}

function duplicateKey(row) {
  const url = officialUrl(row.url);
  if (!url) return '';
  const parsed = new URL(url);
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '').toLowerCase()}${parsed.search}`;
}
function nameKey(row) {
  const year = String(row.registrationDeadline || row.deadline || '').match(/^\d{4}/)?.[0]
    || row.name.match(/\b20\d{2}\b/)?.[0] || '';
  return `${normalized(row.name)}:${year}`;
}

export function previewHackathonImport(matrix, existing = []) {
  const headerIndex = matrix.slice(0, 10).findIndex(row => {
    const headers = row.map(normalized);
    return columns.name.some(label => headers.includes(label)) && columns.url.some(label => headers.includes(label));
  });
  if (headerIndex < 0) throw new Error('Could not find Name and Official URL columns in this sheet.');
  const headers = matrix[headerIndex].map(normalized);
  const index = Object.fromEntries(Object.entries(columns).map(([key, aliases]) => [key, aliases.map(label => headers.indexOf(label)).find(i => i >= 0) ?? -1]));
  const seenUrls = new Set(existing.map(duplicateKey).filter(Boolean));
  const seenNames = new Set(existing.map(nameKey));
  const added = []; const skipped = [];
  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    if (cells.every(value => value === null || value === undefined || String(value).trim() === '')) return;
    const line = headerIndex + offset + 2;
    const get = key => index[key] < 0 ? '' : cellText(cells[index[key]]);
    const name = get('name');
    const url = officialUrl(get('url'));
    if (!name || !url) return skipped.push({ line, name: name || '(unnamed)', reason: 'Missing name or valid official URL' });
    const urlKey = duplicateKey({ url });
    const row = newHackathon(crypto.randomUUID(), name, url);
    for (const key of ['eligibility', 'teamLimit', 'domains', 'rules', 'prize']) row[key] = get(key).slice(0, 10000);
    const registration = deadline(index.registrationDeadline < 0 ? '' : cells[index.registrationDeadline]);
    const submission = deadline(index.deadline < 0 ? '' : cells[index.deadline]);
    row.registrationDeadline = registration.value;
    row.deadline = submission.value;
    const eventNameKey = nameKey(row);
    if (seenUrls.has(urlKey) || seenNames.has(eventNameKey)) return skipped.push({ line, name, reason: 'Already in the manager or repeated in this sheet' });
    const notes = [
      get('location') && `Location / online status: ${get('location')}`,
      get('verification') && `Verification status: ${get('verification')}`,
      get('checked') && `Last checked: ${get('checked')}`,
      get('sourceLinks') && `Source links: ${get('sourceLinks')}`,
      registration.note && `Registration deadline (unparsed, verify manually): ${registration.note}`,
      submission.note && `Submission deadline (unparsed, verify manually): ${submission.note}`,
    ].filter(Boolean);
    row.notes = notes.join('\n').slice(0, 10000);
    const error = validateHackathon(row);
    if (error) return skipped.push({ line, name, reason: error });
    seenUrls.add(urlKey); seenNames.add(eventNameKey); added.push(row);
  });
  return { added, skipped };
}
