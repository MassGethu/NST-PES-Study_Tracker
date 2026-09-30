const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const { Parser } = require('htmlparser2');
function publicAddress(ip) {
  if (net.isIP(ip) === 4) {
    const [a,b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
  }
  // Accept globally routed IPv6 only; mapped, local and transition addresses are excluded.
  return net.isIP(ip) === 6 && /^[23]/i.test(ip) && !/^(2001:(?:0:|db8:)|2002:)/i.test(ip);
}
async function retrieve(url, redirects = 0) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || (target.port && !['80','443'].includes(target.port))) throw new Error('Use a public official HTTP(S) page.');
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Only public websites can be read.');
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? https : http).get(target, { agent: false, headers: { 'User-Agent': 'StudyTracker/1.0', Accept: 'text/html,text/plain' }, lookup: (_host, options, done) => done(null, options.all ? [address] : address.address, address.family) }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 3 || !response.headers.location) return reject(new Error('Too many page redirects. Paste the event text instead.'));
        return retrieve(new URL(response.headers.location, target).href, redirects + 1).then(resolve, reject);
      }
      if (response.statusCode !== 200 || !/text\/(html|plain)/i.test(response.headers['content-type'] || '')) { response.resume(); return reject(new Error('This page could not be read. Paste its event text below instead.')); }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 1500000) request.destroy(new Error('Page is too large. Paste the relevant event text instead.')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => resolve({ url: target.href, html: Buffer.concat(chunks).toString('utf8'), plain: /text\/plain/i.test(response.headers['content-type']) }));
    });
    const timer = setTimeout(() => request.destroy(new Error('Page retrieval timed out. Paste event text instead.')), 12000);
    request.on('close', () => clearTimeout(timer)); request.on('error', reject);
  });
}
function cleanHtml(html) {
  const ignored = new Set(['script','style','nav','footer','noscript','svg','head']);
  let depth = 0; let text = '';
  const parser = new Parser({ onopentag(name) { if (ignored.has(name) || depth) depth++; else if (/^(h[1-6]|p|div|li|tr|br|section)$/.test(name)) text += '\n'; }, ontext(value) { if (!depth) text += value; }, onclosetag(name) { if (depth) depth--; else if (/^(h[1-6]|p|div|li|tr|section)$/.test(name)) text += '\n'; else if (['td','th'].includes(name)) text += ' | '; } }, { decodeEntities: true });
  parser.write(html); parser.end();
  return text.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 40000);
}
async function extractPage(url) {
  const page = await retrieve(url);
  const text = page.plain ? page.html.slice(0,40000) : cleanHtml(page.html);
  if (text.length < 80) throw new Error('The page contains little readable event text. It may require JavaScript or login; paste its event text instead.');
  return { url: page.url, title: new URL(page.url).hostname, text };
}
module.exports = { extractPage, cleanHtml, publicAddress };
