const express = require('express');
const { getPool } = require('./database');
const { requireUser } = require('./auth');

const router = express.Router();

router.get('/', requireUser, async (req, res, next) => {
  try {
    const result = await getPool().query(
      'SELECT state, version, updated_at FROM user_states WHERE user_id = $1',
      [req.user.id],
    );
    const row = result.rows[0] || { state: null, version: 0, updated_at: null };
    res.json({ accountId: req.user.id, state: row.state, version: row.version, updatedAt: row.updated_at });
  } catch (error) {
    next(error);
  }
});

router.put('/', requireUser, async (req, res, next) => {
  try {
    // A tab opened as one user must never write into a different user's session.
    if (req.body.accountId !== req.user.id) return res.status(409).json({ error: 'Account changed. Reload before making changes.' });
    const state = req.body.state;
    const baseVersion = Number(req.body.baseVersion);
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ error: 'A valid application state object is required.' });
    }
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      return res.status(400).json({ error: 'A valid baseVersion is required.' });
    }
    const result = await getPool().query(
      `UPDATE user_states
       SET state = $1::jsonb, version = version + 1, updated_at = NOW()
       WHERE user_id = $2 AND version = $3
       RETURNING version, updated_at`,
      [JSON.stringify(state), req.user.id, baseVersion],
    );
    if (!result.rows[0]) {
      const current = await getPool().query('SELECT version FROM user_states WHERE user_id = $1', [req.user.id]);
      return res.status(409).json({ error: 'Your data changed in another session.', version: current.rows[0]?.version ?? 0 });
    }
    res.json({ version: result.rows[0].version, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
