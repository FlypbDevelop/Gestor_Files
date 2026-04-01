const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const accessValidator = require('./accessValidator');
const fileManager = require('./fileManager');

/**
 * DownloadController Service
 * Handles file download validation, logging, and streaming
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.3, 8.4, 15.2, 15.3
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
 * @returns {Promise<{id: number, user_id: number, file_id: number, ip_address: string, downloaded_at: string}>}
 */
async function logDownload(userId, fileId, ipAddress) {
  const result = await db.run(
    'INSERT INTO downloads (user_id, file_id, ip_address) VALUES (?, ?, ?)',
    [userId, fileId, ipAddress]
  );

  return {
    id: result.lastID,
    user_id: userId,
    file_id: fileId,
    ip_address: ipAddress,
    downloaded_at: new Date().toISOString()
  };
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
 * Atomicity: log is created BEFORE streaming; if streaming fails the log is rolled back.
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

    // Generic denial (e.g. File not found from validator)
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: reason } });
  }

  // Step 2: Get file record
  const file = await fileManager.getFileById(fileId);
  if (!file) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
  }

  // Step 3: Log the download BEFORE streaming (Req 8.4)
  const downloadLog = await logDownload(userId, fileId, ipAddress);

  // Step 4: Stream the file; rollback log on failure
  const filePath = path.join(UPLOAD_DIR, file.path);

  try {
    await streamFile(filePath, file.filename, file.mime_type, res);
  } catch (streamError) {
    // Rollback: delete the log entry so atomicity is preserved
    try {
      await db.run('DELETE FROM downloads WHERE id = ?', [downloadLog.id]);
    } catch (rollbackError) {
      console.error('Failed to rollback download log:', rollbackError);
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
  getRealIpAddress
};
