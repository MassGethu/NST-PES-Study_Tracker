const crypto = require('crypto');
const express = require('express');
const { getPool } = require('./database');
const { hashPassword, verifyPassword } = require('./passwords');

const router = express.Router();
const SESSION_COOKIE = 'nst_session';
const SESSION_DAYS = 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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
      `SELECT u.id, u.email, u.display_name, u.username, u.role
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

router.post('/register', (_req, res) => res.status(403).json({ error: 'Accounts are created by the site owner.' }));

router.post('/login', async (req, res, next) => {
  try {
    const username = normalizeEmail(req.body.username || req.body.email);
    const password = String(req.body.password || '');
    if (password.length > 128 || username.length > 200) return res.status(400).json({ error: 'Invalid credentials.' });
    const result = await getPool().query(
      'SELECT id, email, display_name, username, role, password_hash FROM users WHERE LOWER(username) = $1 OR email = $1',
      [username],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    await createSession(user.id, res);
    const { password_hash, ...publicUser } = user;
    res.json({ user: publicUser });
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

router.post('/password', optionalUser, requireUser, async (req, res, next) => {
  try {
    const password = String(req.body.password || '');
    const current = String(req.body.currentPassword || '');
    if (password.length < 8 || password.length > 128 || current.length > 128) {
      return res.status(400).json({ error: 'Use a password of 8–128 characters.' });
    }
    const result = await getPool().query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!verifyPassword(current, result.rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect.' });
    await getPool().query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hashPassword(password), req.user.id]);
    await getPool().query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
    await createSession(req.user.id, res);
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = { authRouter: router, optionalUser, requireUser };
