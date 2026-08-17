const path = require('path');
const fs = require('fs').promises;
const db = require('../db/database');

/**
 * FileManager Service
 * Manages file records and permissions
 * Requirements: 4.1, 5.1, 5.2, 5.4, 6.1, 6.2
 */

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

/**
 * Create a file record in the database
 * @param {Object} fileData - {filename, path, mime_type, size, uploaded_by, creditCost}
 * @returns {Promise<Object>} Created file record
 */
async function createFile(fileData) {
  const { filename, path: filePath, mime_type, size, uploaded_by, creditCost = null } = fileData;

  const result = await db.run(
    `INSERT INTO files (filename, path, mime_type, size, uploaded_by, allowed_plan_ids, max_downloads_per_user, credit_cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [filename, filePath, mime_type, size, uploaded_by, '[]', null, creditCost]
  );

  return {
    id: result.lastID,
    filename,
    path: filePath,
    mime_type,
    size,
    uploaded_by,
    allowed_plan_ids: [],
    max_downloads_per_user: null,
    credit_cost: creditCost,
    created_at: new Date().toISOString()
  };
}

/**
 * Fetch a file by ID
 * @param {number} fileId
 * @returns {Promise<Object|null>} File record or null
 */
async function getFileById(fileId) {
  const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
  if (!file) return null;

  return {
    ...file,
    allowed_plan_ids: JSON.parse(file.allowed_plan_ids || '[]')
  };
}

/**
 * List files accessible to a plan, including downloads_remaining per file
 * Files included when: the plan has access OR the file is avulso (credit_cost defined)
 * Avulso files carry an effective_credit_cost based on the user's plan multiplier.
 * @param {number} planId
 * @param {number} userId - For calculating remaining downloads
 * @returns {Promise<Object[]>} Array of file records with downloads_remaining
 */
async function listFilesForPlan(planId, userId) {
  const files = await db.all(
    `SELECT f.*,
      (SELECT COUNT(*) FROM downloads WHERE user_id = ? AND file_id = f.id) as downloads_count
     FROM files f
     ORDER BY f.created_at DESC`,
    [userId]
  );

  const accessValidator = require('./accessValidator');
  const multiplier = await accessValidator.getCreditMultiplier(planId);

  return files
    .filter(file => {
      const allowedPlanIds = JSON.parse(file.allowed_plan_ids || '[]');
      const isAvulso =
        file.credit_cost !== null && file.credit_cost !== undefined;
      return allowedPlanIds.includes(planId) || isAvulso;
    })
    .map(file => {
      const allowedPlanIds = JSON.parse(file.allowed_plan_ids || '[]');
      const downloadsRemaining =
        file.max_downloads_per_user === null
          ? null
          : file.max_downloads_per_user - file.downloads_count;

      const effectiveCreditCost =
        file.credit_cost === null || file.credit_cost === undefined
          ? null
          : accessValidator.computeEffectiveCreditCost(file.credit_cost, multiplier);

      return {
        ...file,
        allowed_plan_ids: allowedPlanIds,
        downloads_remaining: downloadsRemaining,
        effective_credit_cost: effectiveCreditCost
      };
    });
}

/**
 * Delete a file record AND the physical file from disk
 * @param {number} fileId
 * @returns {Promise<void>}
 */
async function deleteFile(fileId) {
  const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
  if (!file) {
    const error = new Error('File not found');
    error.code = 'FILE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Remove DB record first
  await db.run('DELETE FROM files WHERE id = ?', [fileId]);

  // Remove physical file (don't fail if file doesn't exist on disk)
  try {
    const physicalPath = path.join(UPLOAD_DIR, file.path);
    await fs.unlink(physicalPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to delete physical file:', err);
    }
  }
}

/**
 * Update file permissions, avulso credit cost and metadata
 * @param {number} fileId
 * @param {number[]} allowedPlanIds - Array of valid integer plan IDs
 * @param {number|null} maxDownloadsPerUser - Positive integer or NULL
 * @param {Object} metadata - { customName, description, version, creditCost }
 * @returns {Promise<Object>} Updated file record
 */
async function updateFilePermissions(fileId, allowedPlanIds, maxDownloadsPerUser, metadata = {}) {
  // Validate allowedPlanIds
  if (!Array.isArray(allowedPlanIds)) {
    const error = new Error('allowedPlanIds must be an array');
    error.code = 'INVALID_PLAN_ID';
    error.statusCode = 400;
    throw error;
  }

  for (const id of allowedPlanIds) {
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error(`Invalid plan ID: ${id}`);
      error.code = 'INVALID_PLAN_ID';
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate maxDownloadsPerUser
  if (maxDownloadsPerUser !== null && maxDownloadsPerUser !== undefined) {
    if (!Number.isInteger(maxDownloadsPerUser) || maxDownloadsPerUser <= 0) {
      const error = new Error('maxDownloadsPerUser must be a positive integer or NULL');
      error.code = 'INVALID_DOWNLOAD_LIMIT';
      error.statusCode = 400;
      throw error;
    }
  }

  const { customName, description, version, creditCost } = metadata;

  // Validate creditCost: positive integer or null/undefined (not avulso)
  let normalizedCreditCost = null;
  if (creditCost !== undefined && creditCost !== null) {
    if (!Number.isInteger(creditCost) || creditCost <= 0) {
      const error = new Error('creditCost must be a positive integer or NULL');
      error.code = 'INVALID_CREDIT_COST';
      error.statusCode = 400;
      throw error;
    }
    normalizedCreditCost = creditCost;
  } else if (creditCost === null) {
    normalizedCreditCost = null;
  }

  const normalizedMax = maxDownloadsPerUser === undefined ? null : maxDownloadsPerUser;

  await db.run(
    `UPDATE files SET allowed_plan_ids = ?, max_downloads_per_user = ?,
      credit_cost = ?,
      custom_name = ?, description = ?, version = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      JSON.stringify(allowedPlanIds),
      normalizedMax,
      normalizedCreditCost,
      customName !== undefined ? (customName || null) : null,
      description !== undefined ? (description || null) : null,
      version !== undefined ? (version || null) : null,
      fileId
    ]
  );

  return getFileById(fileId);
}

module.exports = {
  createFile,
  getFileById,
  listFilesForPlan,
  deleteFile,
  updateFilePermissions
};
