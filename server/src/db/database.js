const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Database connection module for SQLite
 * Provides connection management and initialization
 */

let db = null;

/**
 * Get database connection
 * Creates connection if it doesn't exist
 * @returns {sqlite3.Database} Database instance
 */
function getDatabase() {
  if (db) {
    return db;
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      throw err;
    }
    console.log(`Connected to SQLite database at ${dbPath}`);
  });

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/**
 * Initialize database connection
 * @returns {Promise<sqlite3.Database>} Database instance
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    // Test connection
    database.get('SELECT 1', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(database);
      }
    });
  });
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        db = null;
        console.log('Database connection closed');
        resolve();
      }
    });
  });
}

/**
 * Run a SQL query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<void>}
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Get a single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>}
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Get all rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Execute a callback inside a SQLite transaction (BEGIN/COMMIT/ROLLBACK)
 * If the callback throws, the transaction is rolled back and the error rethrown.
 * @param {Function} callback - Async function receiving no args; return value is passed through
 * @returns {Promise<any>} Result of the callback
 */
async function withTransaction(callback) {
  const database = getDatabase();

  await new Promise((resolve, reject) => {
    database.exec('BEGIN', (err) => (err ? reject(err) : resolve()));
  });

  try {
    const result = await callback();
    await new Promise((resolve, reject) => {
      database.exec('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
    return result;
  } catch (error) {
    await new Promise((resolve, reject) => {
      database.exec('ROLLBACK', (err) => (err ? reject(err) : resolve()));
    });
    throw error;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  run,
  get,
  all,
  withTransaction
};
