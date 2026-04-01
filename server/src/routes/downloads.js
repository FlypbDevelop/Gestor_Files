const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const downloadController = require('../controllers/downloadController');

/**
 * Download Routes
 * Requirements: 7.1, 13.1
 */

// GET /api/downloads/history - Get user's download history (must be before /:fileId)
router.get('/history', authMiddleware, downloadController.getDownloadHistory);

// GET /api/downloads/:fileId - Download a file (protected)
router.get('/:fileId', authMiddleware, downloadController.downloadFile);

module.exports = router;
