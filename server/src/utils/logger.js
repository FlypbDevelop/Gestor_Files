/**
 * Logger - Utilitário de logging estruturado para o backend.
 * Requisitos: 8.1 (registro de eventos importantes)
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function formatMessage(level, context, message, meta) {
  const timestamp = new Date().toISOString();
  const base = { timestamp, level, context, message };
  if (meta && Object.keys(meta).length > 0) base.meta = meta;
  return JSON.stringify(base);
}

function log(level, context, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;
  const line = formatMessage(level, context, message, meta);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * Cria um logger com contexto fixo (ex: nome do módulo).
 * @param {string} context - Nome do módulo/serviço
 */
function createLogger(context) {
  return {
    info: (message, meta) => log('info', context, message, meta),
    warn: (message, meta) => log('warn', context, message, meta),
    error: (message, meta) => log('error', context, message, meta),
    debug: (message, meta) => log('debug', context, message, meta),
  };
}

module.exports = { createLogger };
