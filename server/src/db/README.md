# Database Module

This directory contains the database connection, migration system, and database-related utilities for the File Manager system.

## Structure

```
db/
├── database.js           # SQLite connection and query helpers
├── MigrationRunner.js    # Migration execution system
├── migrate.js            # CLI script to run migrations
├── migrations/           # SQL migration files
│   ├── 001_create_plans_table.sql
│   ├── 002_create_users_table.sql
│   └── ...
└── __tests__/           # Unit tests
```

## Database Connection

The `database.js` module provides a singleton SQLite connection with helper methods:

```javascript
const { initializeDatabase, run, get, all } = require('./db/database');

// Initialize connection
await initializeDatabase();

// Run a query (INSERT, UPDATE, DELETE)
const result = await run('INSERT INTO users (name) VALUES (?)', ['John']);
console.log(result.lastID); // ID of inserted row

// Get a single row
const user = await get('SELECT * FROM users WHERE id = ?', [1]);

// Get all rows
const users = await all('SELECT * FROM users');
```

## Migration System

The migration system automatically tracks and executes SQL migrations in order.

### Creating Migrations

1. Create a new `.sql` file in `migrations/` directory
2. Name it with a numeric prefix: `NNN_description.sql`
3. Write your SQL statements (multiple statements separated by semicolons)

Example migration (`001_create_users_table.sql`):

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Running Migrations

Migrations run automatically on server startup. To run manually:

```bash
npm run migrate
```

The system:
- Creates a `migrations` table to track executed migrations
- Detects pending migrations by comparing files to executed list
- Executes migrations in alphabetical order
- Marks each migration as executed after success
- Never re-runs already executed migrations

### Migration Tracking

The `migrations` table structure:

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

Configure the database path via environment variable:

```env
DB_PATH=./database.sqlite
```

Default: `./database.sqlite` (relative to server root)

## Testing

Unit tests use in-memory SQLite databases:

```bash
npm test -- src/db/__tests__/database.test.js
npm test -- src/db/__tests__/MigrationRunner.test.js
```

## Features

- **Singleton Connection**: Single database connection shared across the application
- **Foreign Keys**: Automatically enabled for referential integrity
- **Promise-based API**: All operations return promises
- **Parameterized Queries**: Protection against SQL injection
- **Migration Tracking**: Automatic detection and execution of pending migrations
- **Idempotent Migrations**: Safe to run multiple times
- **Transaction Support**: Via SQLite's built-in transaction handling

## Requirements Validated

- **Requirement 1.1**: Database persistence for authentication
- **Requirement 2.1**: User registration with database storage
- **Requirement 8.1**: Download logging to database

## Next Steps

The following tasks will add:
- Table schemas (plans, users, files, downloads)
- Seed data for default plans and admin user
- Model classes for data access
