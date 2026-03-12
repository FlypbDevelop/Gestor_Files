const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const MigrationRunner = require('../MigrationRunner');
const { initializeDatabase, closeDatabase, get, all } = require('../database');

describe('MigrationRunner', () => {
  const testDbPath = path.join(__dirname, 'test-migrations.db');
  const testMigrationsDir = path.join(__dirname, 'test-migrations');
  let runner;

  beforeAll(async () => {
    // Set test database path
    process.env.DB_PATH = testDbPath;
    
    // Create test migrations directory
    await fs.mkdir(testMigrationsDir, { recursive: true });
  });

  beforeEach(async () => {
    await initializeDatabase();
    runner = new MigrationRunner();
    runner.migrationsDir = testMigrationsDir;
  });

  afterEach(async () => {
    await closeDatabase();
    
    // Clean up test database
    if (fsSync.existsSync(testDbPath)) {
      fsSync.unlinkSync(testDbPath);
    }
    
    // Clean up test migrations
    try {
      const files = await fs.readdir(testMigrationsDir);
      for (const file of files) {
        await fs.unlink(path.join(testMigrationsDir, file));
      }
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up test migrations directory
    try {
      await fs.rmdir(testMigrationsDir);
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('createMigrationsTable', () => {
    it('should create migrations table', async () => {
      await runner.createMigrationsTable();
      
      const result = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
      );
      expect(result).toBeDefined();
      expect(result.name).toBe('migrations');
    });

    it('should be idempotent (can be called multiple times)', async () => {
      await runner.createMigrationsTable();
      await runner.createMigrationsTable();
      
      const result = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
      );
      expect(result).toBeDefined();
    });
  });

  describe('getExecutedMigrations', () => {
    it('should return empty array when no migrations executed', async () => {
      await runner.createMigrationsTable();
      const executed = await runner.getExecutedMigrations();
      expect(executed).toEqual([]);
    });

    it('should return list of executed migrations', async () => {
      await runner.createMigrationsTable();
      await runner.markMigrationExecuted('001_test.sql');
      await runner.markMigrationExecuted('002_test.sql');
      
      const executed = await runner.getExecutedMigrations();
      expect(executed).toEqual(['001_test.sql', '002_test.sql']);
    });

    it('should return empty array when migrations table does not exist', async () => {
      const executed = await runner.getExecutedMigrations();
      expect(executed).toEqual([]);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations when none executed', async () => {
      // Create test migration files
      await fs.writeFile(
        path.join(testMigrationsDir, '001_test.sql'),
        'CREATE TABLE test1 (id INTEGER);'
      );
      await fs.writeFile(
        path.join(testMigrationsDir, '002_test.sql'),
        'CREATE TABLE test2 (id INTEGER);'
      );

      await runner.createMigrationsTable();
      const pending = await runner.getPendingMigrations();
      
      expect(pending).toEqual(['001_test.sql', '002_test.sql']);
    });

    it('should return only pending migrations', async () => {
      // Create test migration files
      await fs.writeFile(
        path.join(testMigrationsDir, '001_test.sql'),
        'CREATE TABLE test1 (id INTEGER);'
      );
      await fs.writeFile(
        path.join(testMigrationsDir, '002_test.sql'),
        'CREATE TABLE test2 (id INTEGER);'
      );
      await fs.writeFile(
        path.join(testMigrationsDir, '003_test.sql'),
        'CREATE TABLE test3 (id INTEGER);'
      );

      await runner.createMigrationsTable();
      await runner.markMigrationExecuted('001_test.sql');
      
      const pending = await runner.getPendingMigrations();
      expect(pending).toEqual(['002_test.sql', '003_test.sql']);
    });

    it('should return empty array when migrations directory does not exist', async () => {
      runner.migrationsDir = path.join(__dirname, 'nonexistent');
      const pending = await runner.getPendingMigrations();
      expect(pending).toEqual([]);
    });
  });

  describe('executeMigration', () => {
    it('should execute migration and mark as executed', async () => {
      const migrationContent = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `;
      await fs.writeFile(
        path.join(testMigrationsDir, '001_create_test.sql'),
        migrationContent
      );

      await runner.createMigrationsTable();
      await runner.executeMigration('001_create_test.sql');

      // Check table was created
      const result = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      );
      expect(result).toBeDefined();

      // Check migration was marked as executed
      const executed = await runner.getExecutedMigrations();
      expect(executed).toContain('001_create_test.sql');
    });

    it('should execute multiple statements in a migration', async () => {
      const migrationContent = `
        CREATE TABLE table1 (id INTEGER);
        CREATE TABLE table2 (id INTEGER);
        INSERT INTO table1 (id) VALUES (1);
      `;
      await fs.writeFile(
        path.join(testMigrationsDir, '001_multi.sql'),
        migrationContent
      );

      await runner.createMigrationsTable();
      await runner.executeMigration('001_multi.sql');

      const table1 = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='table1'"
      );
      const table2 = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='table2'"
      );
      
      expect(table1).toBeDefined();
      expect(table2).toBeDefined();
    });
  });

  describe('runMigrations', () => {
    it('should execute all pending migrations in order', async () => {
      // Create test migrations
      await fs.writeFile(
        path.join(testMigrationsDir, '001_first.sql'),
        'CREATE TABLE first (id INTEGER);'
      );
      await fs.writeFile(
        path.join(testMigrationsDir, '002_second.sql'),
        'CREATE TABLE second (id INTEGER);'
      );

      const count = await runner.runMigrations();
      expect(count).toBe(2);

      // Verify tables were created
      const tables = await all(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('first');
      expect(tableNames).toContain('second');
      expect(tableNames).toContain('migrations');
    });

    it('should return 0 when no pending migrations', async () => {
      await runner.createMigrationsTable();
      const count = await runner.runMigrations();
      expect(count).toBe(0);
    });

    it('should not re-execute already executed migrations', async () => {
      await fs.writeFile(
        path.join(testMigrationsDir, '001_test.sql'),
        'CREATE TABLE test (id INTEGER);'
      );

      // Run migrations first time
      const count1 = await runner.runMigrations();
      expect(count1).toBe(1);

      // Run migrations second time
      const count2 = await runner.runMigrations();
      expect(count2).toBe(0);
    });
  });
});
