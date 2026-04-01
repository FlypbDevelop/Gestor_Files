jest.mock('../../db/database');

const { AccessValidator } = require('../accessValidator');
const db = require('../../db/database');

describe('AccessValidator', () => {
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new AccessValidator();
  });

  // ─── checkPlanAccess ───────────────────────────────────────────────────────

  describe('checkPlanAccess', () => {
    it('should return true when planId is in allowedPlanIds (Req 7.2)', () => {
      expect(validator.checkPlanAccess(2, [1, 2, 3])).toBe(true);
    });

    it('should return false when planId is not in allowedPlanIds', () => {
      expect(validator.checkPlanAccess(5, [1, 2, 3])).toBe(false);
    });

    it('should return false for empty allowedPlanIds', () => {
      expect(validator.checkPlanAccess(1, [])).toBe(false);
    });

    it('should return false when allowedPlanIds is not an array', () => {
      expect(validator.checkPlanAccess(1, null)).toBe(false);
      expect(validator.checkPlanAccess(1, undefined)).toBe(false);
    });
  });

  // ─── checkDownloadLimit ────────────────────────────────────────────────────

  describe('checkDownloadLimit', () => {
    it('should allow when maxDownloads is null (unlimited) (Req 9.3)', async () => {
      db.get.mockResolvedValue({ count: 99 });

      const result = await validator.checkDownloadLimit(1, 10, null);

      expect(result).toEqual({ allowed: true, current: 99, max: null });
    });

    it('should allow when current downloads < max (Req 9.1)', async () => {
      db.get.mockResolvedValue({ count: 2 });

      const result = await validator.checkDownloadLimit(1, 10, 5);

      expect(result).toEqual({ allowed: true, current: 2, max: 5 });
    });

    it('should deny when current downloads >= max (Req 9.2)', async () => {
      db.get.mockResolvedValue({ count: 5 });

      const result = await validator.checkDownloadLimit(1, 10, 5);

      expect(result).toEqual({ allowed: false, current: 5, max: 5 });
    });

    it('should deny when current downloads exceed max', async () => {
      db.get.mockResolvedValue({ count: 7 });

      const result = await validator.checkDownloadLimit(1, 10, 5);

      expect(result).toEqual({ allowed: false, current: 7, max: 5 });
    });

    it('should query downloads table with correct user_id and file_id (Req 9.1)', async () => {
      db.get.mockResolvedValue({ count: 0 });

      await validator.checkDownloadLimit(42, 99, 3);

      expect(db.get).toHaveBeenCalledWith(
        expect.stringContaining('downloads'),
        [42, 99]
      );
    });
  });

  // ─── validateDownloadAccess ────────────────────────────────────────────────

  describe('validateDownloadAccess', () => {
    it('should deny when user does not exist (Req 7.1)', async () => {
      db.get.mockResolvedValueOnce(null); // user not found

      const result = await validator.validateDownloadAccess(999, 1);

      expect(result).toEqual({ allowed: false, reason: 'User not found' });
    });

    it('should deny when file does not exist', async () => {
      db.get
        .mockResolvedValueOnce({ id: 1, plan_id: 2 }) // user found
        .mockResolvedValueOnce(null); // file not found

      const result = await validator.validateDownloadAccess(1, 999);

      expect(result).toEqual({ allowed: false, reason: 'File not found' });
    });

    it('should deny when user plan is not in allowed_plan_ids (Req 7.2)', async () => {
      db.get
        .mockResolvedValueOnce({ id: 1, plan_id: 1 }) // user with plan 1
        .mockResolvedValueOnce({ id: 5, allowed_plan_ids: '[2,3]', max_downloads_per_user: null }); // file allows plans 2,3

      const result = await validator.validateDownloadAccess(1, 5);

      expect(result).toEqual({ allowed: false, reason: 'Plan does not have access to this file' });
    });

    it('should deny when download limit is exceeded (Req 7.3, 9.2)', async () => {
      db.get
        .mockResolvedValueOnce({ id: 1, plan_id: 2 }) // user with plan 2
        .mockResolvedValueOnce({ id: 5, allowed_plan_ids: '[2]', max_downloads_per_user: 3 }) // file allows plan 2, max 3
        .mockResolvedValueOnce({ count: 3 }); // already downloaded 3 times

      const result = await validator.validateDownloadAccess(1, 5);

      expect(result).toEqual({ allowed: false, reason: 'Download limit exceeded' });
    });

    it('should allow when all checks pass (Req 7.1, 7.2, 7.3)', async () => {
      db.get
        .mockResolvedValueOnce({ id: 1, plan_id: 2 }) // user with plan 2
        .mockResolvedValueOnce({ id: 5, allowed_plan_ids: '[2]', max_downloads_per_user: 5 }) // file allows plan 2, max 5
        .mockResolvedValueOnce({ count: 2 }); // downloaded 2 times so far

      const result = await validator.validateDownloadAccess(1, 5);

      expect(result).toEqual({ allowed: true });
    });

    it('should allow when max_downloads_per_user is null (unlimited) (Req 9.3)', async () => {
      db.get
        .mockResolvedValueOnce({ id: 1, plan_id: 3 }) // user with plan 3
        .mockResolvedValueOnce({ id: 7, allowed_plan_ids: '[3]', max_downloads_per_user: null }) // unlimited
        .mockResolvedValueOnce({ count: 100 }); // many downloads

      const result = await validator.validateDownloadAccess(1, 7);

      expect(result).toEqual({ allowed: true });
    });
  });
});
