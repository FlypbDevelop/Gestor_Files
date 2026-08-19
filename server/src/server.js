require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeDatabase } = require('./db/database');
const MigrationRunner = require('./db/MigrationRunner');
const { createLogger } = require('./utils/logger');

const logger = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições HTTP
app.use((req, _res, next) => {
  logger.info('request', { method: req.method, path: req.path });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/downloads', require('./routes/downloads'));
app.use('/api/users', require('./routes/users'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/credits', require('./routes/credits'));

// Error handler global
app.use((err, req, res, next) => {
  logger.error('unhandled_error', {
    message: err.message,
    code: err.code,
    status: err.status,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : {}
    }
  });
});

// Initialize database and run migrations
async function startServer() {
  try {
    logger.info('database_init', { message: 'Initializing database...' });
    await initializeDatabase();

    logger.info('migrations_start', { message: 'Running migrations...' });
    const runner = new MigrationRunner();
    await runner.runMigrations();

    logger.info('database_ready', { message: 'Database ready' });
  } catch (error) {
    logger.error('startup_failed', { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().then(() => {
    app.listen(PORT, () => {
      logger.info('server_started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  });
}

module.exports = app;
