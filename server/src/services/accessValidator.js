const db = require('../db/database');

/**
 * AccessValidator Service
 * Validates user access to files based on plan and download limits
 * Requirements: 7.1, 7.2, 7.3, 9.1, 9.2, 9.3
 * Avulso downloads (pay-per-download with credits): the file has a base
 * credit_cost and the effective cost depends on the user's plan multiplier.
 */

const DEFAULT_CREDIT_MULTIPLIER = 1.0;

/**
 * Parse a plan's features JSON (tolerant to missing/invalid JSON).
 * @param {string|Object|null} features
 * @returns {Object}
 */
function parsePlanFeatures(features) {
  if (features && typeof features === 'object') return features;
  if (!features) return {};
  try {
    return JSON.parse(features);
  } catch {
    return {};
  }
}

/**
 * Compute the effective credit cost of an avulso download for a given plan.
 * cost = baseCost * multiplier, rounded up to the nearest integer.
 * @param {number} baseCost - files.credit_cost
 * @param {number} multiplier - plan feature creditMultiplier (default 1.0)
 * @returns {number}
 */
function computeEffectiveCreditCost(baseCost, multiplier) {
  const mult = typeof multiplier === 'number' && multiplier > 0 ? multiplier : DEFAULT_CREDIT_MULTIPLIER;
  return Math.max(1, Math.ceil(baseCost * mult));
}

class AccessValidator {
  /**
   * Get the credit multiplier configured on a plan (features.creditMultiplier)
   * @param {number} planId
   * @returns {Promise<number>}
   */
  async getCreditMultiplier(planId) {
    const plan = await db.get('SELECT features FROM plans WHERE id = ?', [planId]);
    const features = parsePlanFeatures(plan ? plan.features : null);
    return typeof features.creditMultiplier === 'number' && features.creditMultiplier > 0
      ? features.creditMultiplier
      : DEFAULT_CREDIT_MULTIPLIER;
  }

  /**
   * Validate whether a user is allowed to download a file.
   * Flow:
   *  1. User exists (7.1)
   *  2. File exists
   *  3. Plan access (7.2): if the user's plan is allowed -> check per-file limit (7.3)
   *  4. Avulso fallback: if the plan has no access but the file is avulso
   *     (credit_cost defined) -> the download is charged in credits; requires balance
   * @param {number} userId
   * @param {number} fileId
   * @returns {Promise<{allowed: boolean, reason?: string, creditCost?: number, required?: number, balance?: number}>}
   */
  async validateDownloadAccess(userId, fileId) {
    // Req 7.1 - Validate user exists
    const user = await db.get('SELECT id, plan_id, credits FROM users WHERE id = ?', [userId]);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Fetch file
    const file = await db.get(
      'SELECT id, allowed_plan_ids, max_downloads_per_user, credit_cost FROM files WHERE id = ?',
      [fileId]
    );
    if (!file) {
      return { allowed: false, reason: 'File not found' };
    }

    // Req 7.2 - Validate plan access
    const allowedPlanIds = JSON.parse(file.allowed_plan_ids || '[]');
    if (this.checkPlanAccess(user.plan_id, allowedPlanIds)) {
      // Req 7.3 - Validate download limit (subscription path)
      const limitCheck = await this.checkDownloadLimit(userId, fileId, file.max_downloads_per_user);
      if (!limitCheck.allowed) {
        return { allowed: false, reason: 'Download limit exceeded' };
      }
      return { allowed: true };
    }

    // Avulso path: plan has no access, but the file is offered as pay-per-download
    if (file.credit_cost !== null && file.credit_cost !== undefined) {
      const multiplier = await this.getCreditMultiplier(user.plan_id);
      const creditCost = computeEffectiveCreditCost(file.credit_cost, multiplier);

      if ((user.credits || 0) < creditCost) {
        return {
          allowed: false,
          reason: 'INSUFFICIENT_CREDITS',
          required: creditCost,
          balance: user.credits || 0
        };
      }

      return { allowed: true, creditCost };
    }

    // No plan access and not avulso
    return { allowed: false, reason: 'Plan does not have access to this file' };
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
module.exports.computeEffectiveCreditCost = computeEffectiveCreditCost;
module.exports.parsePlanFeatures = parsePlanFeatures;
