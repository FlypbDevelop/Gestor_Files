// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');

const fc = require('fast-check');
const { AccessValidator } = require('../accessValidator');
const db = require('../../db/database');

describe('AccessValidator - Property-Based Tests', () => {
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new AccessValidator();
  });

  /**
   * Property 20: Unauthenticated download requests fail
   * **Validates: Requirements 7.1**
   */
  describe('Property 20: Unauthenticated download requests fail', () => {
    it('should deny access for any userId when user does not exist in the database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          async (userId, fileId) => {
            jest.clearAllMocks();

            // Setup: user not found (unauthenticated / non-existent user)
            db.get.mockResolvedValueOnce(null);

            // Act
            const result = await validator.validateDownloadAccess(userId, fileId);

            // Assert: access denied with user-not-found reason
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('User not found');
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 21: Unauthorized plan access is denied
   * **Validates: Requirements 7.2**
   */
  describe('Property 21: Unauthorized plan access is denied', () => {
    it('should deny access when user plan is not in the file allowed_plan_ids', async () => {
      // Arbitrary: user plan ID and a list of allowed plan IDs that does NOT include the user plan
      const planAccessArb = fc
        .tuple(
          fc.integer({ min: 1, max: 20 }),
          fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 10 })
        )
        .filter(([userPlanId, allowedIds]) => !allowedIds.includes(userPlanId));

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          planAccessArb,
          async (userId, fileId, [userPlanId, allowedPlanIds]) => {
            jest.clearAllMocks();

            // Setup: user exists with a plan not in the file's allowed list
            db.get
              .mockResolvedValueOnce({ id: userId, plan_id: userPlanId })
              .mockResolvedValueOnce({
                id: fileId,
                allowed_plan_ids: JSON.stringify(allowedPlanIds),
                max_downloads_per_user: null
              });

            // Act
            const result = await validator.validateDownloadAccess(userId, fileId);

            // Assert: access denied due to plan restriction
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Plan does not have access to this file');
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should deny access for any plan ID not in the allowed list (checkPlanAccess)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (planId, allowedPlanIds) => {
            // Precondition: planId is NOT in allowedPlanIds
            fc.pre(!allowedPlanIds.includes(planId));

            const result = validator.checkPlanAccess(planId, allowedPlanIds);

            expect(result).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should allow access for any plan ID that is in the allowed list (checkPlanAccess)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (allowedPlanIds) => {
            // Pick a plan ID that IS in the list
            const planId = allowedPlanIds[0];

            const result = validator.checkPlanAccess(planId, allowedPlanIds);

            expect(result).toBe(true);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 22: Over-limit downloads are denied
   * **Validates: Requirements 7.3**
   */
  describe('Property 22: Over-limit downloads are denied', () => {
    it('should deny access when current download count >= max_downloads_per_user', async () => {
      // Arbitrary: maxDownloads and a current count that is >= maxDownloads
      const overLimitArb = fc
        .tuple(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 200 })
        )
        .filter(([max, current]) => current >= max);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 20 }),
          overLimitArb,
          async (userId, fileId, planId, [maxDownloads, currentCount]) => {
            jest.clearAllMocks();

            // Setup: user exists, plan matches, but download count is at/over limit
            db.get
              .mockResolvedValueOnce({ id: userId, plan_id: planId })
              .mockResolvedValueOnce({
                id: fileId,
                allowed_plan_ids: JSON.stringify([planId]),
                max_downloads_per_user: maxDownloads
              })
              .mockResolvedValueOnce({ count: currentCount });

            // Act
            const result = await validator.validateDownloadAccess(userId, fileId);

            // Assert: access denied due to download limit
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Download limit exceeded');
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 26: Download limit enforcement with count
   * **Validates: Requirements 9.1, 9.2, 9.4**
   */
  describe('Property 26: Download limit enforcement with count', () => {
    it('should return current download count and max in the result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 200 }),
          async (userId, fileId, maxDownloads, currentCount) => {
            jest.clearAllMocks();

            // Setup: db returns a specific download count
            db.get.mockResolvedValueOnce({ count: currentCount });

            // Act
            const result = await validator.checkDownloadLimit(userId, fileId, maxDownloads);

            // Assert: result always includes current count and max (Req 9.4)
            expect(result).toHaveProperty('current', currentCount);
            expect(result).toHaveProperty('max', maxDownloads);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should deny (allowed=false) when current >= max and return the count (Req 9.2, 9.4)', async () => {
      const overLimitArb = fc
        .tuple(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 200 })
        )
        .filter(([max, current]) => current >= max);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          overLimitArb,
          async (userId, fileId, [maxDownloads, currentCount]) => {
            jest.clearAllMocks();

            db.get.mockResolvedValueOnce({ count: currentCount });

            const result = await validator.checkDownloadLimit(userId, fileId, maxDownloads);

            // Req 9.2: deny when count >= max
            expect(result.allowed).toBe(false);
            // Req 9.4: return the number of downloads already made
            expect(result.current).toBe(currentCount);
            expect(result.max).toBe(maxDownloads);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should allow (allowed=true) when current < max and return the count', async () => {
      const underLimitArb = fc
        .tuple(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 200 })
        )
        .filter(([max, current]) => current < max);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          underLimitArb,
          async (userId, fileId, [maxDownloads, currentCount]) => {
            jest.clearAllMocks();

            db.get.mockResolvedValueOnce({ count: currentCount });

            const result = await validator.checkDownloadLimit(userId, fileId, maxDownloads);

            // Req 9.1: count is returned
            expect(result.current).toBe(currentCount);
            // allowed when under limit
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should query downloads table with the correct userId and fileId (Req 9.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 50 }),
          async (userId, fileId, maxDownloads) => {
            jest.clearAllMocks();

            db.get.mockResolvedValueOnce({ count: 0 });

            await validator.checkDownloadLimit(userId, fileId, maxDownloads);

            // Assert: DB was queried with the correct user_id and file_id
            expect(db.get).toHaveBeenCalledWith(
              expect.stringContaining('downloads'),
              [userId, fileId]
            );
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 27: NULL limits allow unlimited downloads
   * **Validates: Requirements 9.3**
   */
  describe('Property 27: NULL limits allow unlimited downloads', () => {
    it('should always allow downloads when maxDownloads is null, regardless of current count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 0, max: 100000 }),
          async (userId, fileId, currentCount) => {
            jest.clearAllMocks();

            // Setup: any number of existing downloads
            db.get.mockResolvedValueOnce({ count: currentCount });

            // Act: maxDownloads is null (unlimited)
            const result = await validator.checkDownloadLimit(userId, fileId, null);

            // Assert: always allowed, max is null
            expect(result.allowed).toBe(true);
            expect(result.max).toBeNull();
            expect(result.current).toBe(currentCount);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should always allow downloads when maxDownloads is undefined, regardless of current count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 0, max: 100000 }),
          async (userId, fileId, currentCount) => {
            jest.clearAllMocks();

            db.get.mockResolvedValueOnce({ count: currentCount });

            const result = await validator.checkDownloadLimit(userId, fileId, undefined);

            expect(result.allowed).toBe(true);
            expect(result.max).toBeNull();
            expect(result.current).toBe(currentCount);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should allow unlimited downloads via validateDownloadAccess when max_downloads_per_user is null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 100000 }),
          async (userId, fileId, planId, currentCount) => {
            jest.clearAllMocks();

            // Setup: user exists, plan matches, max_downloads_per_user is null
            db.get
              .mockResolvedValueOnce({ id: userId, plan_id: planId })
              .mockResolvedValueOnce({
                id: fileId,
                allowed_plan_ids: JSON.stringify([planId]),
                max_downloads_per_user: null
              })
              .mockResolvedValueOnce({ count: currentCount });

            // Act
            const result = await validator.validateDownloadAccess(userId, fileId);

            // Assert: always allowed regardless of download count
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
