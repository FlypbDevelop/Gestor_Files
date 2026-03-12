#!/usr/bin/env node

/**
 * Migration runner script
 * Usage: npm run migrate
 */

require('dotenv').config();
const MigrationRunner = require('./MigrationRunner');
const { initializeDatabase, closeDatabase } = require('./database');

async function runMigrations() {
  try {
    console.log('Initializing database connection...');
    await initializeDatabase();

    const runner = new MigrationRunner();
    const count = await runner.runMigrations();

    console.log(`\nMigration process completed. ${count} migration(s) executed.`);
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

runMigrations();
