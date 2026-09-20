const { app } = require('../server/server');
const { initializeDatabase } = require('../server/database');

let initPromise;

module.exports = async function handler(req, res) {
  try {
    initPromise ||= initializeDatabase().catch(error => { initPromise = null; throw error; });
    await initPromise;
    return app(req, res);
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    res.status(503).json({ error: 'Account storage is unavailable. Check the server database configuration.' });
  }
};
