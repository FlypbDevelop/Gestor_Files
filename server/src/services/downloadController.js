const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const accessValidator = require('./accessValidator');
const fileManager = require('./fileManager');

/**
 * DownloadController Service
 * Handles file download validation, logging, and streaming
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.3, 8.4, 15.2, 15.3
 * Avulso downloads: files.credit_cost defined -> charged in credits
 * (debit + transaction ledger + log happen atomically in a SQLite transaction)
 */

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

/**
 * Extract the real IP address from a request object.
 * Checks X-Forwarded-For and X-Real-IP headers before falling back to req.ip.
 * Req 8.3
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getRealIpAddress(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    // May be comma-separated list; take the first entry
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers && req.headers['x-real-ip'];
  if (realIp) {
    return realIp.trim();
  }

  return req.ip || (req.connection && req.connection.remoteAddress) || '0.0.0.0';
}

/**
 * Insert a download log record into the downloads table.
 * Req 8.1
 * @param {number} userId
 * @param {number} fileId
 * @param {string} ipAddress
 * @param {number|null} creditCost - Credits charged for an avulso download
 * @returns {Promise<{id: number, user_id: number, file_id: number, ip_address: string, credit_cost: number|null, downloaded_at: string}>}
 */
async function logDownload(userId, fileId, ipAddress, creditCost = null) {
  const result = await db.run(
    'INSERT INTO downloads (user_id, file_id, ip_address, credit_cost) VALUES (?, ?, ?, ?)',
    [userId, fileId, ipAddress, creditCost]
  );

  return {
    id: result.lastID,
    user_id: userId,
    file_id: fileId,
    ip_address: ipAddress,
    credit_cost: creditCost,
    downloaded_at: new Date().toISOString()
  };
}

/**
 * Atomically debit credits for an avulso download.
 * Inside a single SQLite transaction: guarded balance check + debit,
 * ledger entry, and download log. If the balance is insufficient the
 * transaction rolls back and an INSUFFICIENT_CREDITS error is thrown.
 * @param {number} userId
 * @param {number} fileId
 * @param {number} cost
 * @param {string} ipAddress
 * @returns {Promise<{downloadLog: Object, transactionId: number, cost: number}>}
 */
async function debitCredits(userId, fileId, cost, ipAddress) {
  return db.withTransaction(async () => {
    // Guarded UPDATE only debits when there is enough balance (race-safe)
    const debit = await db.run(
      'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
      [cost, userId, cost]
    );

    if (debit.changes === 0) {
      const error = new Error('INSUFFICIENT_CREDITS');
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }

    const ledger = await db.run(
      'INSERT INTO credit_transactions (user_id, amount, reason, file_id) VALUES (?, ?, ?, ?)',
      [userId, -cost, 'DOWNLOAD', fileId]
    );

    const downloadLog = await logDownload(userId, fileId, ipAddress, cost);

    return { downloadLog, transactionId: ledger.lastID, cost };
  });
}

/**
 * Compensating rollback after a stream failure: refund credits, remove the
 * ledger entry and the download log so the user is not charged for a
 * download that never completed.
 * @param {number} userId
 * @param {number} cost
 * @param {number|null} transactionId
 * @param {number} downloadLogId
 * @returns {Promise<void>}
 */
async function rollbackCreditDownload(userId, cost, transactionId, downloadLogId) {
  if (transactionId !== null) {
    await db.run('DELETE FROM credit_transactions WHERE id = ?', [transactionId]);
    await db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [cost, userId]);
  }
  await db.run('DELETE FROM downloads WHERE id = ?', [downloadLogId]);
}

/**
 * Stream a file to the HTTP response with proper headers.
 * Req 15.3
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} filename - Original filename for Content-Disposition
 * @param {string} mimeType - MIME type for Content-Type header
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
function streamFile(filePath, filename, mimeType, res) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(filePath);

    readStream.on('error', (err) => {
      reject(err);
    });

    readStream.on('end', () => {
      resolve();
    });

    readStream.pipe(res);
  });
}

/**
 * Process a download request: validate access, log, and stream the file.
 * Atomicity: for avulso downloads the debit + ledger + log are created in a
 * transaction BEFORE streaming; if streaming fails everything is rolled back.
 * Req 7.1, 7.2, 7.3, 7.4, 8.1, 8.4
 * @param {number} userId
 * @param {number} fileId
 * @param {string} ipAddress
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function processDownload(userId, fileId, ipAddress, res) {
  // Step 1: Validate access
  const accessResult = await accessValidator.validateDownloadAccess(userId, fileId);

  if (!accessResult.allowed) {
    const reason = accessResult.reason;

    if (reason === 'User not found') {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: reason } });
    }

    if (reason === 'Plan does not have access to this file') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: reason } });
    }

    if (reason === 'Download limit exceeded') {
      // Get current/max counts for the 429 response
      const file = await fileManager.getFileById(fileId);
      let current = 0;
      let max = null;

      if (file) {
        const limitInfo = await accessValidator.checkDownloadLimit(
          userId,
          fileId,
          file.max_downloads_per_user
        );
        current = limitInfo.current;
        max = limitInfo.max;
      }

      return res.status(429).json({
        error: {
          code: 'DOWNLOAD_LIMIT_EXCEEDED',
          message: reason,
          current,
          max
        }
      });
    }

    if (reason === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'Créditos insuficientes para este download',
          required: accessResult.required,
          balance: accessResult.balance
        }
      });
    }

    // Generic denial (e.g. File not found from validator)
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: reason } });
  }

  // Step 2: Get file record
  const file = await fileManager.getFileById(fileId);
  if (!file) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
  }

  // Step 3: Charge credits (avulso) or just log (subscription path)
  const creditCost = accessResult.creditCost !== undefined ? accessResult.creditCost : null;
  let downloadLog;
  let creditTransactionId = null;

  if (creditCost !== null) {
    try {
      const charged = await debitCredits(userId, fileId, creditCost, ipAddress);
      downloadLog = charged.downloadLog;
      creditTransactionId = charged.transactionId;
    } catch (debitError) {
      if (debitError.code === 'INSUFFICIENT_CREDITS') {
        const user = await db.get('SELECT credits FROM users WHERE id = ?', [userId]);
        return res.status(402).json({
          error: {
            code: 'INSUFFICIENT_CREDITS',
            message: 'Créditos insuficientes para este download',
            required: creditCost,
            balance: user ? user.credits : 0
          }
        });
      }
      throw debitError;
    }
  } else {
    downloadLog = await logDownload(userId, fileId, ipAddress);
  }

  // Step 4: Stream the file; rollback charge/log on failure
  const filePath = path.join(UPLOAD_DIR, file.path);

  try {
    await streamFile(filePath, file.filename, file.mime_type, res);
  } catch (streamError) {
    try {
      await rollbackCreditDownload(userId, creditCost, creditTransactionId, downloadLog.id);
    } catch (rollbackError) {
      console.error('Failed to rollback download:', rollbackError);
    }

    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_ERROR', message: 'Failed to stream file' } });
    }
  }
}

module.exports = {
  processDownload,
  logDownload,
  streamFile,
  getRealIpAddress,
  debitCredits,
  rollbackCreditDownload
};
