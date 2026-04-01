/**
 * Integration tests for download endpoints
 * Tests: GET /api/downloads/:fileId, GET /api/downloads/history
 * Requirements: 7.1, 7.2, 7.3, 13.1
 */

jest.mock('../../services/authService');
jest.mock('../../services/downloadController');
jest.mock('../../db/database');

const request = require('supertest');
const app = require('../../server');
const authService = require('../../services/authService');
const downloadService = require('../../services/downloadController');
const db = require('../../db/database');

const makeUser = () => ({ userId: 2, email: 'user@example.com', role: 'USER' });

describe('Download Endpoints Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/downloads/:fileId ───────────────────────────────────────────

  describe('GET /api/downloads/:fileId', () => {
    it('should stream file successfully with authorized access (Req 7.1, 7.2, 7.3)', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());
      downloadService.getRealIpAddress.mockReturnValue('127.0.0.1');
      downloadService.processDownload.mockImplementation((userId, fileId, ip, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="test.pdf"');
        res.status(200).end('file-content');
        return Promise.resolve();
      });

      const res = await request(app)
        .get('/api/downloads/1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(downloadService.processDownload).toHaveBeenCalledWith(
        makeUser().userId,
        1,
        '127.0.0.1',
        expect.anything()
      );
    });

    it('should return 403 when user plan does not allow access (Req 7.2)', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());
      downloadService.getRealIpAddress.mockReturnValue('127.0.0.1');
      downloadService.processDownload.mockImplementation((userId, fileId, ip, res) => {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Plan does not have access to this file' }
        });
        return Promise.resolve();
      });

      const res = await request(app)
        .get('/api/downloads/5')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 429 when download limit is exceeded (Req 7.3)', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());
      downloadService.getRealIpAddress.mockReturnValue('127.0.0.1');
      downloadService.processDownload.mockImplementation((userId, fileId, ip, res) => {
        res.status(429).json({
          error: {
            code: 'DOWNLOAD_LIMIT_EXCEEDED',
            message: 'Download limit exceeded',
            current: 3,
            max: 3
          }
        });
        return Promise.resolve();
      });

      const res = await request(app)
        .get('/api/downloads/7')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('DOWNLOAD_LIMIT_EXCEEDED');
      expect(res.body.error.current).toBe(3);
      expect(res.body.error.max).toBe(3);
    });

    it('should return 401 when no token is provided (Req 7.1)', async () => {
      const res = await request(app).get('/api/downloads/1');

      expect(res.status).toBe(401);
      expect(downloadService.processDownload).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid (non-numeric) file ID', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());

      const res = await request(app)
        .get('/api/downloads/abc')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_ID');
    });
  });

  // ─── GET /api/downloads/history ───────────────────────────────────────────

  describe('GET /api/downloads/history', () => {
    it('should return download history ordered by date (Req 13.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());
      const mockHistory = [
        { id: 3, downloaded_at: '2024-03-01T10:00:00.000Z', filename: 'c.pdf', mime_type: 'application/pdf', size: 300 },
        { id: 2, downloaded_at: '2024-02-01T10:00:00.000Z', filename: 'b.pdf', mime_type: 'application/pdf', size: 200 },
        { id: 1, downloaded_at: '2024-01-01T10:00:00.000Z', filename: 'a.pdf', mime_type: 'application/pdf', size: 100 }
      ];
      db.all.mockResolvedValue(mockHistory);

      const res = await request(app)
        .get('/api/downloads/history')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.downloads).toHaveLength(3);
      // Verify ordering: most recent first
      expect(res.body.downloads[0].downloaded_at).toBe('2024-03-01T10:00:00.000Z');
      expect(res.body.downloads[2].downloaded_at).toBe('2024-01-01T10:00:00.000Z');
      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY d.downloaded_at DESC'),
        [makeUser().userId]
      );
    });

    it('should return empty array when user has no downloads', async () => {
      authService.verifyToken.mockResolvedValue(makeUser());
      db.all.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/downloads/history')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.downloads).toEqual([]);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/downloads/history');

      expect(res.status).toBe(401);
      expect(db.all).not.toHaveBeenCalled();
    });
  });
});
