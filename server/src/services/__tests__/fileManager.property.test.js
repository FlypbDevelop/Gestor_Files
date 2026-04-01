// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn()
  }
}));

const fc = require('fast-check');
const fileManager = require('../fileManager');
const db = require('../../db/database');

describe('FileManager - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: Multiple plans can be assigned to files
   * **Validates: Requirements 5.1**
   */
  describe('Property 12: Multiple plans can be assigned to files', () => {
    it('should accept and store any set of valid plan IDs in allowed_plan_ids', async () => {
      // Arbitrary for arrays of valid plan IDs (positive integers, no duplicates)
      const planIdsArb = fc
        .array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 })
        .map(ids => [...new Set(ids)]); // deduplicate

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          planIdsArb,
          async (fileId, planIds) => {
            jest.clearAllMocks();

            // Setup: db.run succeeds, db.get returns updated file
            db.run.mockResolvedValue({ changes: 1 });
            db.get.mockResolvedValue({
              id: fileId,
              filename: 'test.pdf',
              path: 'test.pdf',
              mime_type: 'application/pdf',
              size: 1024,
              uploaded_by: 1,
              allowed_plan_ids: JSON.stringify(planIds),
              max_downloads_per_user: null,
              created_at: new Date().toISOString()
            });

            // Act: update file permissions with the plan IDs
            const result = await fileManager.updateFilePermissions(fileId, planIds, null);

            // Assert: db.run was called with the correct plan IDs
            expect(db.run).toHaveBeenCalledWith(
              expect.stringContaining('UPDATE files'),
              expect.arrayContaining([JSON.stringify(planIds)])
            );

            // Assert: result contains all plan IDs
            expect(result).toHaveProperty('allowed_plan_ids');
            expect(result.allowed_plan_ids).toEqual(planIds);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 13: Download limits accept positive integers
   * **Validates: Requirements 5.2**
   */
  describe('Property 13: Download limits accept positive integers', () => {
    it('should accept and store any positive integer as max_downloads_per_user', async () => {
      const positiveIntArb = fc.integer({ min: 1, max: 1_000_000 });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          positiveIntArb,
          async (fileId, maxDownloads) => {
            jest.clearAllMocks();

            db.run.mockResolvedValue({ changes: 1 });
            db.get.mockResolvedValue({
              id: fileId,
              filename: 'test.pdf',
              path: 'test.pdf',
              mime_type: 'application/pdf',
              size: 1024,
              uploaded_by: 1,
              allowed_plan_ids: JSON.stringify([1]),
              max_downloads_per_user: maxDownloads,
              created_at: new Date().toISOString()
            });

            // Act: update with a positive integer download limit
            const result = await fileManager.updateFilePermissions(fileId, [1], maxDownloads);

            // Assert: db.run was called with the correct max_downloads value
            expect(db.run).toHaveBeenCalledWith(
              expect.stringContaining('UPDATE files'),
              expect.arrayContaining([maxDownloads])
            );

            // Assert: result stores the value
            expect(result).toHaveProperty('max_downloads_per_user', maxDownloads);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 15: Negative download limits are rejected
   * **Validates: Requirements 5.4**
   */
  describe('Property 15: Negative download limits are rejected', () => {
    it('should reject any negative number as max_downloads_per_user', async () => {
      const negativeIntArb = fc.integer({ min: -1_000_000, max: -1 });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          negativeIntArb,
          async (fileId, negativeLimit) => {
            jest.clearAllMocks();

            // Act & Assert: should throw INVALID_DOWNLOAD_LIMIT
            await expect(
              fileManager.updateFilePermissions(fileId, [1], negativeLimit)
            ).rejects.toMatchObject({
              code: 'INVALID_DOWNLOAD_LIMIT',
              statusCode: 400
            });

            // Assert: db.run was NOT called (validation happens before DB)
            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject zero as max_downloads_per_user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          async (fileId) => {
            jest.clearAllMocks();

            await expect(
              fileManager.updateFilePermissions(fileId, [1], 0)
            ).rejects.toMatchObject({
              code: 'INVALID_DOWNLOAD_LIMIT',
              statusCode: 400
            });

            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject non-integer floats as max_downloads_per_user', async () => {
      // Floats that are not integers (e.g. 1.5, 2.7, -0.5)
      const nonIntegerFloatArb = fc
        .float({ min: -1000, max: 1000 })
        .filter(n => !Number.isInteger(n));

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          nonIntegerFloatArb,
          async (fileId, floatLimit) => {
            jest.clearAllMocks();

            await expect(
              fileManager.updateFilePermissions(fileId, [1], floatLimit)
            ).rejects.toMatchObject({
              code: 'INVALID_DOWNLOAD_LIMIT',
              statusCode: 400
            });

            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Users only see files for their plan
   * **Validates: Requirements 6.1**
   */
  describe('Property 16: Users only see files for their plan', () => {
    it('should return only files where allowed_plan_ids includes the user plan_id', async () => {
      // Arbitrary for plan IDs (1-10 for manageable test space)
      const planIdArb = fc.integer({ min: 1, max: 10 });

      // Arbitrary for a list of files with random allowed_plan_ids
      const filesArb = fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 9999 }),
          filename: fc.constant('file.pdf'),
          path: fc.constant('file.pdf'),
          mime_type: fc.constant('application/pdf'),
          size: fc.constant(1024),
          uploaded_by: fc.constant(1),
          allowed_plan_ids: fc
            .array(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 5 })
            .map(ids => JSON.stringify([...new Set(ids)])),
          max_downloads_per_user: fc.constant(null),
          downloads_count: fc.constant(0),
          created_at: fc.constant(new Date().toISOString())
        }),
        { minLength: 0, maxLength: 20 }
      );

      await fc.assert(
        fc.asyncProperty(
          planIdArb,
          fc.integer({ min: 1, max: 9999 }),
          filesArb,
          async (userPlanId, userId, files) => {
            jest.clearAllMocks();

            // Setup: db.all returns the generated files
            db.all.mockResolvedValue(files);

            // Act: list files for the user's plan
            const result = await fileManager.listFilesForPlan(userPlanId, userId);

            // Assert: every returned file includes the user's plan_id
            for (const file of result) {
              expect(file.allowed_plan_ids).toContain(userPlanId);
            }

            // Assert: no file that should be visible is missing
            const expectedCount = files.filter(f => {
              const ids = JSON.parse(f.allowed_plan_ids || '[]');
              return ids.includes(userPlanId);
            }).length;

            expect(result.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
