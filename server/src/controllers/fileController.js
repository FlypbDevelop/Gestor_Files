const uploadService = require('../services/uploadService');
const fileManager = require('../services/fileManager');

/**
 * File Controller
 * Handles HTTP requests for file management endpoints
 * Requirements: 4.1, 5.1, 5.2
 */

/**
 * Upload a file (ADMIN only)
 * POST /api/files/upload
 * @param {Express.Request} req - Request with file from multer and req.user
 * @param {Express.Response} res - Response
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file provided'
        }
      });
    }

    const fileRecord = await uploadService.processUpload(req.file, req.user.userId);

    res.status(201).json({ file: fileRecord });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Upload error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during file upload'
      }
    });
  }
}

/**
 * Update file permissions (ADMIN only)
 * PUT /api/files/:id/permissions
 * @param {Express.Request} req - Request with params.id and body: { allowedPlanIds, maxDownloadsPerUser }
 * @param {Express.Response} res - Response
 */
async function updatePermissions(req, res) {
  try {
    const fileId = parseInt(req.params.id, 10);

    if (isNaN(fileId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE_ID',
          message: 'Invalid file ID'
        }
      });
    }

    const { allowedPlanIds, maxDownloadsPerUser } = req.body;

    if (!Array.isArray(allowedPlanIds)) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'allowedPlanIds must be an array'
        }
      });
    }

    const updatedFile = await fileManager.updateFilePermissions(
      fileId,
      allowedPlanIds,
      maxDownloadsPerUser !== undefined ? maxDownloadsPerUser : null
    );

    if (!updatedFile) {
      return res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found'
        }
      });
    }

    res.status(200).json({ file: updatedFile });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Update permissions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating file permissions'
      }
    });
  }
}

/**
 * Delete a file (ADMIN only)
 * DELETE /api/files/:id
 * @param {Express.Request} req - Request with params.id
 * @param {Express.Response} res - Response
 */
async function deleteFile(req, res) {
  try {
    const fileId = parseInt(req.params.id, 10);

    if (isNaN(fileId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE_ID',
          message: 'Invalid file ID'
        }
      });
    }

    await fileManager.deleteFile(fileId);

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Delete file error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while deleting the file'
      }
    });
  }
}

/**
 * List all files (ADMIN only)
 * GET /api/files
 * @param {Express.Request} req - Request with req.user
 * @param {Express.Response} res - Response
 */
async function listFiles(req, res) {
  try {
    const db = require('../db/database');
    const files = await db.all(
      'SELECT * FROM files ORDER BY created_at DESC'
    );

    const parsedFiles = files.map(file => ({
      ...file,
      allowed_plan_ids: JSON.parse(file.allowed_plan_ids || '[]')
    }));

    res.status(200).json({ files: parsedFiles });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while listing files'
      }
    });
  }
}

module.exports = {
  uploadFile,
  updatePermissions,
  deleteFile,
  listFiles
};
