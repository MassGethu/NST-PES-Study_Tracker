const { app } = require('../server/server');
const { initializeDatabase } = require('../server/database');

let initPromise;

module.exports = async function handler(req, res) {
  initPromise ||= initializeDatabase();
  await initPromise;
  return app(req, res);
};
