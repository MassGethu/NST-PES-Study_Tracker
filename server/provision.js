const crypto = require('crypto');
const { hashPassword } = require('./passwords');

// Admin-only bootstrap. Never expose account claiming or role selection to a browser.
// Existing IDs, email addresses and state documents are preserved.
async function provisionAccounts(pool) {
  const passwords = [process.env.AADARSH_INITIAL_PASSWORD, process.env.RITHIKA_INITIAL_PASSWORD];
  if (!passwords.some(Boolean)) return;
  if (passwords.some(p => !p || p.length < 8 || p.length > 128)) {
    throw new Error('Set both initial account passwords (8–128 characters).');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(78230419)");
    const { rows: users } = await client.query('SELECT id, username FROM users ORDER BY created_at');
    const existingOwner = users.find(u => u.username === 'aadarsh');
    const unclaimed = users.filter(u => !u.username);
    if (!existingOwner && unclaimed.length > 1) {
      throw new Error('Multiple legacy accounts exist; an administrator must identify Aadarsh before provisioning. No data was changed.');
    }
    for (const [index, username] of ['aadarsh', 'rithika'].entries()) {
      if (users.some(u => u.username === username)) continue;
      const displayName = index === 0 ? 'Aadarsh' : 'Rithika';
      const role = index === 0 ? 'student_nst' : 'student_worksheet';
      const old = index === 0 ? unclaimed[0] : null;
      const id = old?.id || crypto.randomUUID();
      if (old) {
        await client.query('UPDATE users SET username=$1, display_name=$2, role=$3, password_hash=$4 WHERE id=$5',
          [username, displayName, role, hashPassword(passwords[index]), id]);
      } else {
        await client.query('INSERT INTO users (id,email,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5,$6)',
          [id, `${username}@tracker.invalid`, username, displayName, role, hashPassword(passwords[index])]);
      }
      await client.query('INSERT INTO user_states (user_id,state) VALUES ($1,NULL) ON CONFLICT (user_id) DO NOTHING', [id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = { provisionAccounts };
