const { test } = require('node:test');
const assert = require('node:assert/strict');
const { provisionAccounts } = require('./provision');
const { verifyPassword } = require('./passwords');

test('provision test_user alone with NST features and independent data; repeated setup preserves password', async () => {
  const keys = ['AADARSH_INITIAL_PASSWORD', 'RITHIKA_INITIAL_PASSWORD', 'TEST_USER_INITIAL_PASSWORD'];
  const saved = keys.map(key => process.env[key]);
  const users = [{ id: 'owner', username: 'aadarsh' }, { id: 'other', username: 'rithika' }];
  const inserted = [];
  const states = [];
  const client = { release() {}, async query(sql, args) {
    if (sql.startsWith('SELECT id, username')) return { rows: users };
    if (sql.startsWith('INSERT INTO users ')) {
      inserted.push(args); users.push({ id: args[0], username: args[2] });
    }
    if (sql.startsWith('INSERT INTO user_states')) states.push(args[0]);
    return { rows: [] };
  }};
  try {
    keys.forEach(key => delete process.env[key]);
    process.env.TEST_USER_INITIAL_PASSWORD = 'Friends-Only-Test-2026';
    await provisionAccounts({ connect: async () => client });
    await provisionAccounts({ connect: async () => client });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0][2], 'test_user');
    assert.equal(inserted[0][4], 'student_nst');
    assert.equal(verifyPassword('Friends-Only-Test-2026', inserted[0][5]), true);
    assert.deepEqual(states, [inserted[0][0]]);
    assert.notEqual(inserted[0][0], 'owner');
  } finally {
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});
