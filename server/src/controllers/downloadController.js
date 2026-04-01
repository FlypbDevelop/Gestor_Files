const downloadService = require('../services/downloadController');
const db = require('../db/database');

/**
 * Download Controller
 * Handles HTTP requests for file download and download history
 * Requirements: 7.1, 7.2, 7.3, 7.4, 13.1
 */

/**
 * Download a file
 * GET /api/downloads/:fileId
 * Errors: 401 (unauthenticated), 403 (plan denied), 429 (limit exceeded)
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
async function downloadFile(req, res) {
  try {
    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId)) {
      return res.status(400).json({
        error: { code: 'INVALID_FILE_ID', message: 'Invalid file ID' }
      });
    }

    const userId = req.user.userId;
    const ipAddress = downloadService.getRealIpAddress(req);

    // processDownload handles all validation, logging, and streaming
    // It writes the response directly (including error responses)
    await downloadService.processDownload(userId, fileId, ipAddress, res);
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred during download' }
      });
    }
  }
}

/**
 * Get download history for the authenticated user
 * GET /api/downloads/history
 * Requirements: 13.1, 13.3, 13.4
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
async function getDownloadHistory(req, res) {
  try {
    const userId = req.user.userId;

    const downloads = await db.all(
      `SELECT d.id, d.downloaded_at, f.filename, f.mime_type, f.size
       FROM downloads d
       JOIN files f ON d.file_id = f.id
       WHERE d.user_id = ?
       ORDER BY d.downloaded_at DESC`,
      [userId]
    );

    res.status(200).json({ downloads });
  } catch (error) {
    console.error('Download history error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred while fetching download history' }
    });
  }
}

module.exports = {
  downloadFile,
  getDownloadHistory
};
