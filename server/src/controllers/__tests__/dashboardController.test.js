/**
 * Unit and property-based tests for dashboard controllers
 * Tests: getAdminStats, getUserDashboard
 * Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3
 */

jest.mock('../../services/authService');
jest.mock('../../db/database');

const request = require('supertest');
const fc = require('fast-check');
const app = require('../../server');
const authService = require('../../services/authService');
const db = require('../../db/database');
const { getAdminStats, getUserDashboard } = require('../dashboardController');

const makeAdminUser = () => ({ userId: 1, email: 'admin@example.com', role: 'ADMIN' });
const makeRegularUser = (id = 2) => ({ userId: id, email: `user${id}@example.com`, role: 'USER' });

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-negative integer count */
const countArb = fc.integer({ min: 0, max: 1000 });

/** Generates a valid ISO date string */
const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map(d => d.toISOString());

/** Generates a file record with a download count */
const fileWithDownloadCountArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/\0/g, 'x') + '.pdf'),
  mime_type: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
  size: fc.integer({ min: 1, max: 104857600 }),
  download_count: fc.integer({ min: 0, max: 500 })
});

/** Generates an array of file records sorted descending by download_count */
const sortedFilesArb = fc.array(fileWithDownloadCountArb, { minLength: 0, maxLength: 10 })
  .map(files => [...files].sort((a, b) => b.download_count - a.download_count));

/** Generates a plan distribution entry */
const planDistributionArb = fc.record({
  plan_id: fc.integer({ min: 1, max: 10 }),
  plan_name: fc.constantFrom('Free', 'Basic', 'Premium'),
  user_count: fc.integer({ min: 0, max: 200 })
});

/** Generates a download history entry */
const downloadHistoryEntryArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  downloaded_at: isoDateArb,
  filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/\0/g, 'x') + '.pdf'),
  mime_type: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
  size: fc.integer({ min: 1, max: 104857600 })
});

/** Generates a download history array sorted descending by downloaded_at */
const sortedDownloadHistoryArb = fc.array(downloadHistoryEntryArb, { minLength: 0, maxLength: 20 })
  .map(entries =>
    [...entries].sort((a, b) => new Date(b.downloaded_at) - new Date(a.downloaded_at))
  );

/** Generates a user with plan info */
const userWithPlanArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/\0/g, 'x') || 'User'),
  email: fc.emailAddress(),
  role: fc.constant('USER'),
  plan_id: fc.integer({ min: 1, max: 3 }),
  plan_name: fc.constantFrom('Free', 'Basic', 'Premium'),
  plan_price: fc.float({ min: 0, max: 100, noNaN: true }),
  plan_features: fc.constant('{"maxDownloadsPerMonth":10}')
});

// ─── Admin Dashboard Tests ────────────────────────────────────────────────────

describe('Admin Dashboard Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 33: Admin dashboard shows accurate counts
   * Validates: Requirements 12.1
   *
   * For any system state, when an admin requests dashboard statistics,
   * the system should return accurate counts of total users, total files,
   * and total downloads.
   */
  describe('Property 33: Admin dashboard shows accurate counts', () => {
    it('should return the exact counts provided by the database', async () => {
      await fc.assert(
        fc.asyncProperty(
          countArb,
          countArb,
          countArb,
          sortedFilesArb,
          fc.array(planDistributionArb, { minLength: 0, maxLength: 5 }),
          async (totalUsers, totalFiles, totalDownloads, mostDownloaded, planDist) => {
            authService.verifyToken.mockResolvedValue(makeAdminUser());

            db.get
              .mockResolvedValueOnce({ count: totalUsers })
              .mockResolvedValueOnce({ count: totalFiles })
              .mockResolvedValueOnce({ count: totalDownloads });

            db.all
              .mockResolvedValueOnce(mostDownloaded)
              .mockResolvedValueOnce(planDist);

            const res = await request(app)
              .get('/api/dashboard/admin')
              .set('Authorization', 'Bearer valid-admin-token');

            expect(res.status).toBe(200);
            expect(res.body.stats.totalUsers).toBe(totalUsers);
            expect(res.body.stats.totalFiles).toBe(totalFiles);
            expect(res.body.stats.totalDownloads).toBe(totalDownloads);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/dashboard/admin');
      expect(res.status).toBe(401);
    });

    it('should return 403 when a USER role accesses admin dashboard', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());
      const res = await request(app)
        .get('/api/dashboard/admin')
        .set('Authorization', 'Bearer valid-user-token');
      expect(res.status).toBe(403);
    });
  });

  /**
   * Property 34: Most downloaded files ranked correctly
   * Validates: Requirements 12.2
   *
   * Most downloaded files should be ranked in descending order by download count.
   */
  describe('Property 34: Most downloaded files ranked correctly', () => {
    it('should return files in descending order by download_count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fileWithDownloadCountArb, { minLength: 1, maxLength: 10 }),
          async (files) => {
            authService.verifyToken.mockResolvedValue(makeAdminUser());

            // Simulate DB returning files already sorted (as the SQL ORDER BY does)
            const sortedFiles = [...files].sort((a, b) => b.download_count - a.download_count);

            db.get
              .mockResolvedValueOnce({ count: 0 })
              .mockResolvedValueOnce({ count: 0 })
              .mockResolvedValueOnce({ count: 0 });

            db.all
              .mockResolvedValueOnce(sortedFiles)
              .mockResolvedValueOnce([]);

            const res = await request(app)
              .get('/api/dashboard/admin')
              .set('Authorization', 'Bearer valid-admin-token');

            expect(res.status).toBe(200);
            const returnedFiles = res.body.mostDownloadedFiles;

            // Verify descending order
            for (let i = 0; i < returnedFiles.length - 1; i++) {
              expect(returnedFiles[i].download_count).toBeGreaterThanOrEqual(
                returnedFiles[i + 1].download_count
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 35: User distribution by plan is accurate
   * Validates: Requirements 12.3
   *
   * User distribution by plan should accurately reflect the number of users per plan.
   */
  describe('Property 35: User distribution by plan is accurate', () => {
    it('should return the exact plan distribution provided by the database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(planDistributionArb, { minLength: 1, maxLength: 5 }),
          async (planDist) => {
            authService.verifyToken.mockResolvedValue(makeAdminUser());

            db.get
              .mockResolvedValueOnce({ count: 0 })
              .mockResolvedValueOnce({ count: 0 })
              .mockResolvedValueOnce({ count: 0 });

            db.all
              .mockResolvedValueOnce([])
              .mockResolvedValueOnce(planDist);

            const res = await request(app)
              .get('/api/dashboard/admin')
              .set('Authorization', 'Bearer valid-admin-token');

            expect(res.status).toBe(200);
            const returnedDist = res.body.userDistributionByPlan;

            // Each plan entry should match what the DB returned
            expect(returnedDist).toHaveLength(planDist.length);
            planDist.forEach((expected, idx) => {
              expect(returnedDist[idx].plan_id).toBe(expected.plan_id);
              expect(returnedDist[idx].plan_name).toBe(expected.plan_name);
              expect(returnedDist[idx].user_count).toBe(expected.user_count);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ─── User Dashboard Tests ─────────────────────────────────────────────────────

describe('User Dashboard Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 36: User download history is ordered by date
   * Validates: Requirements 13.1
   *
   * User download history should be ordered by date descending (newest first).
   */
  describe('Property 36: User download history is ordered by date', () => {
    it('should return download history in descending date order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          fc.array(downloadHistoryEntryArb, { minLength: 1, maxLength: 15 }),
          async (userId, rawHistory) => {
            authService.verifyToken.mockResolvedValue(makeRegularUser(userId));

            const sortedHistory = [...rawHistory].sort(
              (a, b) => new Date(b.downloaded_at) - new Date(a.downloaded_at)
            );

            db.get.mockResolvedValueOnce({
              id: userId,
              name: 'Test User',
              email: `user${userId}@example.com`,
              role: 'USER',
              plan_id: 1,
              plan_name: 'Free',
              plan_price: 0,
              plan_features: null
            });

            db.all.mockResolvedValueOnce(sortedHistory);

            const res = await request(app)
              .get('/api/dashboard/user')
              .set('Authorization', 'Bearer valid-user-token');

            expect(res.status).toBe(200);
            const history = res.body.downloadHistory;

            // Verify descending date order
            for (let i = 0; i < history.length - 1; i++) {
              const dateA = new Date(history[i].downloaded_at);
              const dateB = new Date(history[i + 1].downloaded_at);
              expect(dateA.getTime()).toBeGreaterThanOrEqual(dateB.getTime());
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 37: User dashboard shows current plan info
   * Validates: Requirements 13.2
   *
   * User dashboard should show the current plan information for the user.
   */
  describe('Property 37: User dashboard shows current plan info', () => {
    it('should return the current plan information for the user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userWithPlanArb,
          async (userWithPlan) => {
            authService.verifyToken.mockResolvedValue(makeRegularUser(userWithPlan.id));

            db.get.mockResolvedValueOnce(userWithPlan);
            db.all.mockResolvedValueOnce([]);

            const res = await request(app)
              .get('/api/dashboard/user')
              .set('Authorization', 'Bearer valid-user-token');

            expect(res.status).toBe(200);
            expect(res.body.currentPlan).toBeDefined();
            expect(res.body.currentPlan.id).toBe(userWithPlan.plan_id);
            expect(res.body.currentPlan.name).toBe(userWithPlan.plan_name);
            expect(res.body.currentPlan.price).toBe(userWithPlan.plan_price);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 38: User dashboard shows accurate download count
   * Validates: Requirements 13.3
   *
   * User dashboard should show the accurate total download count for the user.
   */
  describe('Property 38: User dashboard shows accurate download count', () => {
    it('should return totalDownloads equal to the length of downloadHistory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          fc.array(downloadHistoryEntryArb, { minLength: 0, maxLength: 30 }),
          async (userId, history) => {
            authService.verifyToken.mockResolvedValue(makeRegularUser(userId));

            db.get.mockResolvedValueOnce({
              id: userId,
              name: 'Test User',
              email: `user${userId}@example.com`,
              role: 'USER',
              plan_id: 1,
              plan_name: 'Free',
              plan_price: 0,
              plan_features: null
            });

            db.all.mockResolvedValueOnce(history);

            const res = await request(app)
              .get('/api/dashboard/user')
              .set('Authorization', 'Bearer valid-user-token');

            expect(res.status).toBe(200);
            expect(res.body.totalDownloads).toBe(history.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 39: Download history includes required fields
   * Validates: Requirements 13.4
   *
   * Each download history entry should include filename, date, and time of download.
   */
  describe('Property 39: Download history includes required fields', () => {
    it('should include filename and downloaded_at in every history entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          fc.array(downloadHistoryEntryArb, { minLength: 1, maxLength: 15 }),
          async (userId, history) => {
            authService.verifyToken.mockResolvedValue(makeRegularUser(userId));

            db.get.mockResolvedValueOnce({
              id: userId,
              name: 'Test User',
              email: `user${userId}@example.com`,
              role: 'USER',
              plan_id: 1,
              plan_name: 'Free',
              plan_price: 0,
              plan_features: null
            });

            db.all.mockResolvedValueOnce(history);

            const res = await request(app)
              .get('/api/dashboard/user')
              .set('Authorization', 'Bearer valid-user-token');

            expect(res.status).toBe(200);
            const returnedHistory = res.body.downloadHistory;

            // Every entry must have filename and downloaded_at (date + time)
            returnedHistory.forEach(entry => {
              expect(entry).toHaveProperty('filename');
              expect(typeof entry.filename).toBe('string');
              expect(entry.filename.length).toBeGreaterThan(0);

              expect(entry).toHaveProperty('downloaded_at');
              expect(typeof entry.downloaded_at).toBe('string');
              // downloaded_at must be a parseable date-time string
              expect(isNaN(new Date(entry.downloaded_at).getTime())).toBe(false);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/dashboard/user');
      expect(res.status).toBe(401);
    });

    it('should return 404 when user is not found', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser(9999));
      db.get.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/dashboard/user')
        .set('Authorization', 'Bearer valid-user-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });
});

// ─── Unit Tests: getAdminStats ────────────────────────────────────────────────

describe('getAdminStats (unit)', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 1, role: 'ADMIN' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  /**
   * Requirement 12.1: Admin dashboard shows total users, files, downloads
   */
  it('should return stats with totalUsers, totalFiles, totalDownloads', async () => {
    db.get
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 12 })
      .mockResolvedValueOnce({ count: 30 });
    db.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getAdminStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.stats.totalUsers).toBe(5);
    expect(body.stats.totalFiles).toBe(12);
    expect(body.stats.totalDownloads).toBe(30);
  });

  it('should return zero counts when database has no records', async () => {
    db.get
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    db.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getAdminStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.stats.totalUsers).toBe(0);
    expect(body.stats.totalFiles).toBe(0);
    expect(body.stats.totalDownloads).toBe(0);
  });

  /**
   * Requirement 12.2: Most downloaded files ordered by download_count DESC
   */
  it('should return mostDownloadedFiles in descending order by download_count', async () => {
    const files = [
      { id: 1, filename: 'a.pdf', download_count: 50 },
      { id: 2, filename: 'b.pdf', download_count: 30 },
      { id: 3, filename: 'c.pdf', download_count: 10 }
    ];

    db.get
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 90 });
    db.all
      .mockResolvedValueOnce(files)
      .mockResolvedValueOnce([]);

    await getAdminStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { mostDownloadedFiles } = res.json.mock.calls[0][0];
    expect(mostDownloadedFiles).toHaveLength(3);
    expect(mostDownloadedFiles[0].download_count).toBeGreaterThanOrEqual(mostDownloadedFiles[1].download_count);
    expect(mostDownloadedFiles[1].download_count).toBeGreaterThanOrEqual(mostDownloadedFiles[2].download_count);
  });

  it('should return empty mostDownloadedFiles when no files exist', async () => {
    db.get
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    db.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getAdminStats(req, res);

    const { mostDownloadedFiles } = res.json.mock.calls[0][0];
    expect(mostDownloadedFiles).toEqual([]);
  });

  /**
   * Requirement 12.3: User distribution by plan
   */
  it('should return userDistributionByPlan with plan_id, plan_name, user_count', async () => {
    const planDist = [
      { plan_id: 1, plan_name: 'Free', user_count: 100 },
      { plan_id: 2, plan_name: 'Basic', user_count: 40 },
      { plan_id: 3, plan_name: 'Premium', user_count: 10 }
    ];

    db.get
      .mockResolvedValueOnce({ count: 150 })
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 200 });
    db.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(planDist);

    await getAdminStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { userDistributionByPlan } = res.json.mock.calls[0][0];
    expect(userDistributionByPlan).toHaveLength(3);
    expect(userDistributionByPlan[0]).toMatchObject({ plan_id: 1, plan_name: 'Free', user_count: 100 });
    expect(userDistributionByPlan[1]).toMatchObject({ plan_id: 2, plan_name: 'Basic', user_count: 40 });
  });

  it('should return 500 when database throws an error', async () => {
    db.get.mockRejectedValueOnce(new Error('DB failure'));

    await getAdminStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── Unit Tests: getUserDashboard ─────────────────────────────────────────────

describe('getUserDashboard (unit)', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 42, role: 'USER' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  const mockUser = {
    id: 42,
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
    plan_id: 2,
    plan_name: 'Basic',
    plan_price: 9.99,
    plan_features: '{"maxDownloadsPerMonth":50}'
  };

  /**
   * Requirement 13.1: Download history ordered by date descending
   */
  it('should return downloadHistory ordered by downloaded_at descending', async () => {
    const history = [
      { id: 3, downloaded_at: '2024-03-01T10:00:00.000Z', filename: 'c.pdf', mime_type: 'application/pdf', size: 100 },
      { id: 2, downloaded_at: '2024-02-15T08:00:00.000Z', filename: 'b.pdf', mime_type: 'application/pdf', size: 200 },
      { id: 1, downloaded_at: '2024-01-10T06:00:00.000Z', filename: 'a.pdf', mime_type: 'application/pdf', size: 300 }
    ];

    db.get.mockResolvedValueOnce(mockUser);
    db.all.mockResolvedValueOnce(history);

    await getUserDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { downloadHistory } = res.json.mock.calls[0][0];
    expect(downloadHistory).toHaveLength(3);
    // Verify descending order
    for (let i = 0; i < downloadHistory.length - 1; i++) {
      expect(new Date(downloadHistory[i].downloaded_at).getTime())
        .toBeGreaterThanOrEqual(new Date(downloadHistory[i + 1].downloaded_at).getTime());
    }
  });

  it('should return empty downloadHistory when user has no downloads', async () => {
    db.get.mockResolvedValueOnce(mockUser);
    db.all.mockResolvedValueOnce([]);

    await getUserDashboard(req, res);

    const { downloadHistory } = res.json.mock.calls[0][0];
    expect(downloadHistory).toEqual([]);
  });

  /**
   * Requirement 13.2: Current plan info
   */
  it('should return currentPlan with id, name, price, features', async () => {
    db.get.mockResolvedValueOnce(mockUser);
    db.all.mockResolvedValueOnce([]);

    await getUserDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { currentPlan } = res.json.mock.calls[0][0];
    expect(currentPlan.id).toBe(2);
    expect(currentPlan.name).toBe('Basic');
    expect(currentPlan.price).toBe(9.99);
    expect(currentPlan.features).toEqual({ maxDownloadsPerMonth: 50 });
  });

  it('should handle null plan_features gracefully', async () => {
    db.get.mockResolvedValueOnce({ ...mockUser, plan_features: null });
    db.all.mockResolvedValueOnce([]);

    await getUserDashboard(req, res);

    const { currentPlan } = res.json.mock.calls[0][0];
    expect(currentPlan.features).toBeNull();
  });

  it('should handle non-JSON plan_features as raw string', async () => {
    db.get.mockResolvedValueOnce({ ...mockUser, plan_features: 'unlimited' });
    db.all.mockResolvedValueOnce([]);

    await getUserDashboard(req, res);

    const { currentPlan } = res.json.mock.calls[0][0];
    expect(currentPlan.features).toBe('unlimited');
  });

  /**
   * Requirement 13.3: Total downloads count
   */
  it('should return totalDownloads equal to the number of download history entries', async () => {
    const history = [
      { id: 1, downloaded_at: '2024-03-01T10:00:00.000Z', filename: 'a.pdf', mime_type: 'application/pdf', size: 100 },
      { id: 2, downloaded_at: '2024-02-01T10:00:00.000Z', filename: 'b.pdf', mime_type: 'application/pdf', size: 200 }
    ];

    db.get.mockResolvedValueOnce(mockUser);
    db.all.mockResolvedValueOnce(history);

    await getUserDashboard(req, res);

    const { totalDownloads } = res.json.mock.calls[0][0];
    expect(totalDownloads).toBe(2);
  });

  it('should return totalDownloads of 0 when no downloads exist', async () => {
    db.get.mockResolvedValueOnce(mockUser);
    db.all.mockResolvedValueOnce([]);

    await getUserDashboard(req, res);

    expect(res.json.mock.calls[0][0].totalDownloads).toBe(0);
  });

  it('should return 404 when user is not found in database', async () => {
    db.get.mockResolvedValueOnce(null);

    await getUserDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe('USER_NOT_FOUND');
  });

  it('should return 500 when database throws an error', async () => {
    db.get.mockRejectedValueOnce(new Error('DB failure'));

    await getUserDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });
});
