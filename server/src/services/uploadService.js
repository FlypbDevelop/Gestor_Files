const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const db = require('../db/database');

/**
 * Upload Service
 * Handles file uploads with multer configuration
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

// Upload directory configuration
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * Ensure upload directory exists
 * @returns {Promise<void>}
 */
async function ensureUploadDirectory() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Generate unique filename using timestamp and random hash
 * @param {string} originalName - Original filename
 * @returns {string} Unique filename
 */
function generateUniqueFilename(originalName) {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  
  // Sanitize filename to prevent path traversal
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  return `${timestamp}-${randomHash}-${sanitizedName}${ext}`;
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDirectory();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  }
});

/**
 * Multer upload configuration
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

/**
 * Validate file before processing
 * @param {Express.Multer.File} file - Uploaded file
 * @returns {boolean} True if file is valid
 * @throws {Error} If validation fails
 */
function validateFile(file) {
  if (!file) {
    const error = new Error('No file provided');
    error.code = 'NO_FILE';
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_FILE_SIZE) {
    const error = new Error(`File size exceeds maximum of 100MB`);
    error.code = 'FILE_TOO_LARGE';
    error.statusCode = 400;
    throw error;
  }

  return true;
}

/**
 * Process uploaded file and create database record
 * @param {Express.Multer.File} file - Uploaded file from multer
 * @param {number} uploadedBy - ID of the admin user
 * @returns {Promise<Object>} Created file record
 * @throws {Error} If upload fails
 */
async function processUpload(file, uploadedBy) {
  try {
    // Validate file
    validateFile(file);

    // Create database record
    const result = await db.run(
      `INSERT INTO files (filename, path, mime_type, size, uploaded_by, allowed_plan_ids, max_downloads_per_user)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        file.originalname,
        file.filename, // Store the unique filename, not full path
        file.mimetype,
        file.size,
        uploadedBy,
        '[]', // Default: no plans allowed yet
        null  // Default: unlimited downloads
      ]
    );

    // Return file record
    return {
      id: result.lastID,
      filename: file.originalname,
      path: file.filename,
      mime_type: file.mimetype,
      size: file.size,
      uploaded_by: uploadedBy,
      allowed_plan_ids: [],
      max_downloads_per_user: null,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    // If database insert fails, clean up the uploaded file
    if (file && file.filename) {
      try {
        const filePath = path.join(UPLOAD_DIR, file.filename);
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup file after error:', cleanupError);
      }
    }

    // Re-throw with appropriate error code
    if (!error.statusCode) {
      error.statusCode = 500;
      error.code = 'UPLOAD_FAILED';
    }
    throw error;
  }
}

module.exports = {
  upload,
  processUpload,
  validateFile,
  generateUniqueFilename,
  UPLOAD_DIR,
  MAX_FILE_SIZE
};
