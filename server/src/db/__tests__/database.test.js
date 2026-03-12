const path = require('path');
const fs = require('fs');
const { 
  initializeDatabase, 
  closeDatabase, 
  run, 
  get, 
  all 
} = require('../database');

describe('Database Module', () => {
  const testDbPath = path.join(__dirname, 'test.db');

  beforeAll(() => {
    // Set test database path
    process.env.DB_PATH = testDbPath;
  });

  afterEach(async () => {
    // Close database connection after each test
    await closeDatabase();
    
    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initializeDatabase', () => {
    it('should initialize database connection successfully', async () => {
      const db = await initializeDatabase();
      expect(db).toBeDefined();
    });

    it('should enable foreign keys', async () => {
      await initializeDatabase();
      const result = await get('PRAGMA foreign_keys');
      expect(result.foreign_keys).toBe(1);
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      await initializeDatabase();
    });

    it('should execute CREATE TABLE statement', async () => {
      const sql = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `;
      const result = await run(sql);
      expect(result).toBeDefined();
    });

    it('should execute INSERT statement and return lastID', async () => {
      await run('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      const result = await run('INSERT INTO test_table (name) VALUES (?)', ['Test']);
      expect(result.lastID).toBe(1);
      expect(result.changes).toBe(1);
    });

    it('should handle parameterized queries', async () => {
      await run('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test 1']);
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test 2']);
      
      const rows = await all('SELECT * FROM test_table');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Test 1');
      expect(rows[1].name).toBe('Test 2');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await initializeDatabase();
      await run('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test']);
    });

    it('should retrieve a single row', async () => {
      const row = await get('SELECT * FROM test_table WHERE id = ?', [1]);
      expect(row).toBeDefined();
      expect(row.name).toBe('Test');
    });

    it('should return undefined when no row found', async () => {
      const row = await get('SELECT * FROM test_table WHERE id = ?', [999]);
      expect(row).toBeUndefined();
    });
  });

  describe('all', () => {
    beforeEach(async () => {
      await initializeDatabase();
      await run('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test 1']);
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test 2']);
      await run('INSERT INTO test_table (name) VALUES (?)', ['Test 3']);
    });

    it('should retrieve all rows', async () => {
      const rows = await all('SELECT * FROM test_table');
      expect(rows).toHaveLength(3);
    });

    it('should return empty array when no rows found', async () => {
      const rows = await all('SELECT * FROM test_table WHERE id > ?', [100]);
      expect(rows).toHaveLength(0);
    });

    it('should handle WHERE clause with parameters', async () => {
      const rows = await all('SELECT * FROM test_table WHERE name LIKE ?', ['%1']);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Test 1');
    });
  });

  describe('closeDatabase', () => {
    it('should close database connection', async () => {
      await initializeDatabase();
      await closeDatabase();
      // Should be able to reinitialize
      await initializeDatabase();
      const result = await get('SELECT 1 as test');
      expect(result.test).toBe(1);
    });

    it('should handle closing when no connection exists', async () => {
      await expect(closeDatabase()).resolves.not.toThrow();
    });
  });
});
