const express = require('express');
const router = express.Router();
const { upload } = require('../services/uploadService');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const fileController = require('../controllers/fileController');

/**
 * File Routes
 * Handles file upload, permissions, deletion, and listing
 * Requirements: 4.1, 5.1, 5.2
 */

// POST /api/files/upload - Upload a file (ADMIN only)
// Order: authMiddleware → roleCheck → multer → controller
router.post(
  '/upload',
  authMiddleware,
  roleCheck(['ADMIN']),
  upload.single('file'),
  fileController.uploadFile
);

// GET /api/files - List all files (ADMIN only)
router.get(
  '/',
  authMiddleware,
  roleCheck(['ADMIN']),
  fileController.listFiles
);

// PUT /api/files/:id/permissions - Update file permissions (ADMIN only)
router.put(
  '/:id/permissions',
  authMiddleware,
  roleCheck(['ADMIN']),
  fileController.updatePermissions
);

// DELETE /api/files/:id - Delete a file (ADMIN only)
router.delete(
  '/:id',
  authMiddleware,
  roleCheck(['ADMIN']),
  fileController.deleteFile
);

module.exports = router;
