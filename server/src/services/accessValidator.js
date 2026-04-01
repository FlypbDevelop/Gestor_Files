const db = require('../db/database');

/**
 * AccessValidator Service
 * Validates user access to files based on plan and download limits
 * Requirements: 7.1, 7.2, 7.3, 9.1, 9.2, 9.3
 */

class AccessValidator {
  /**
   * Validate whether a user is allowed to download a file
   * Checks: user exists (7.1), plan access (7.2), download limit (7.3)
   * @param {number} userId
   * @param {number} fileId
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async validateDownloadAccess(userId, fileId) {
    // Req 7.1 - Validate user exists
    const user = await db.get('SELECT id, plan_id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Fetch file
    const file = await db.get('SELECT id, allowed_plan_ids, max_downloads_per_user FROM files WHERE id = ?', [fileId]);
    if (!file) {
      return { allowed: false, reason: 'File not found' };
    }

    // Req 7.2 - Validate plan access
    const allowedPlanIds = JSON.parse(file.allowed_plan_ids || '[]');
    if (!this.checkPlanAccess(user.plan_id, allowedPlanIds)) {
      return { allowed: false, reason: 'Plan does not have access to this file' };
    }

    // Req 7.3 - Validate download limit
    const limitCheck = await this.checkDownloadLimit(userId, fileId, file.max_downloads_per_user);
    if (!limitCheck.allowed) {
      return { allowed: false, reason: 'Download limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Check if a plan ID is in the list of allowed plan IDs
   * Req 7.2
   * @param {number} planId
   * @param {number[]} allowedPlanIds
   * @returns {boolean}
   */
  checkPlanAccess(planId, allowedPlanIds) {
    return Array.isArray(allowedPlanIds) && allowedPlanIds.includes(planId);
  }

  /**
   * Check if user has not exceeded the download limit for a file
   * Req 9.1, 9.2, 9.3
   * @param {number} userId
   * @param {number} fileId
   * @param {number|null} maxDownloads - NULL means unlimited
   * @returns {Promise<{allowed: boolean, current: number, max: number|null}>}
   */
  async checkDownloadLimit(userId, fileId, maxDownloads) {
    // Req 9.1 - Count previous downloads for user+file
    const row = await db.get(
      'SELECT COUNT(*) as count FROM downloads WHERE user_id = ? AND file_id = ?',
      [userId, fileId]
    );
    const current = row ? row.count : 0;

    // Req 9.3 - NULL means unlimited
    if (maxDownloads === null || maxDownloads === undefined) {
      return { allowed: true, current, max: null };
    }

    // Req 9.2 - Deny if count >= max_downloads_per_user
    const allowed = current < maxDownloads;
    return { allowed, current, max: maxDownloads };
  }
}

module.exports = new AccessValidator();
module.exports.AccessValidator = AccessValidator;
