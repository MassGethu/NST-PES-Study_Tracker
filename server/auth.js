const crypto = require('crypto');
const express = require('express');
const { getPool } = require('./database');

const router = express.Router();
const SESSION_COOKIE = 'nst_session';
const SESSION_DAYS = 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expectedHex] = String(stored || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return cookies;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
    return cookies;
  }, {});
}

function sessionCookie(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await getPool().query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  );
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 86400));
}

async function optionalUser(req, _res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return next();
    const result = await getPool().query(
      `SELECT u.id, u.email, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(token)],
    );
    if (result.rows[0]) req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  next();
}

router.post('/register', async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '').trim().slice(0, 100);
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  let client;
  try {
    client = await getPool().connect();
    await client.query('BEGIN');
    const id = crypto.randomUUID();
    const result = await client.query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name`,
      [id, email, displayName, hashPassword(password)],
    );
    await client.query('INSERT INTO user_states (user_id, state) VALUES ($1, NULL)', [id]);
    await client.query('COMMIT');
    await createSession(id, res);
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  } finally {
    client?.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const result = await getPool().query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [email],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    await createSession(user.id, res);
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) await getPool().query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/me', optionalUser, (req, res) => {
  res.json({ user: req.user || null });
});

module.exports = { authRouter: router, optionalUser, requireUser };
