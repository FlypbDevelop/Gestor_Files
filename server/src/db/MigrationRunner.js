const fs = require('fs').promises;
const path = require('path');
const { run, get, all } = require('./database');

/**
 * MigrationRunner - Executes database migrations
 * Tracks executed migrations in a migrations table
 */
class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Create migrations tracking table if it doesn't exist
   * @returns {Promise<void>}
   */
  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await run(sql);
    console.log('Migrations table ready');
  }

  /**
   * Get list of executed migrations
   * @returns {Promise<string[]>} Array of migration names
   */
  async getExecutedMigrations() {
    try {
      const rows = await all('SELECT name FROM migrations ORDER BY name');
      return rows.map(row => row.name);
    } catch (error) {
      // If table doesn't exist yet, return empty array
      if (error.message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get list of pending migrations
   * @returns {Promise<string[]>} Array of migration filenames
   */
  async getPendingMigrations() {
    try {
      // Get all migration files
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get executed migrations
      const executed = await this.getExecutedMigrations();

      // Return only pending migrations
      return migrationFiles.filter(file => !executed.includes(file));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Migrations directory does not exist yet');
        return [];
      }
      throw error;
    }
  }

  /**
   * Mark migration as executed
   * @param {string} migrationName - Name of the migration file
   * @returns {Promise<void>}
   */
  async markMigrationExecuted(migrationName) {
    await run('INSERT INTO migrations (name) VALUES (?)', [migrationName]);
  }

  /**
   * Execute a single migration file
   * @param {string} filename - Migration filename
   * @returns {Promise<void>}
   */
  async executeMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = await fs.readFile(filePath, 'utf8');

    console.log(`Executing migration: ${filename}`);

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await run(statement);
    }

    await this.markMigrationExecuted(filename);
    console.log(`Migration completed: ${filename}`);
  }

  /**
   * Run all pending migrations
   * @returns {Promise<number>} Number of migrations executed
   */
  async runMigrations() {
    console.log('Starting migration process...');

    // Ensure migrations table exists
    await this.createMigrationsTable();

    // Get pending migrations
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations');
      return 0;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    // Execute each migration
    for (const migration of pending) {
      try {
        await this.executeMigration(migration);
      } catch (error) {
        console.error(`Failed to execute migration ${migration}:`, error.message);
        throw error;
      }
    }

    console.log(`Successfully executed ${pending.length} migration(s)`);
    return pending.length;
  }
}

module.exports = MigrationRunner;
