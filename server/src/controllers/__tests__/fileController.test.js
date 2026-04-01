/**
 * Integration tests for file management endpoints
 * Tests: POST /api/files/upload, PUT /api/files/:id/permissions,
 *        DELETE /api/files/:id, GET /api/files
 * Requirements: 3.1, 4.1, 5.1
 */

// Mock dependencies before imports
jest.mock('../../services/authService');
// Track whether the multer middleware should simulate a file being attached
// Must be prefixed with 'mock' to be accessible inside jest.mock factory
let mockSimulateFile = true;

jest.mock('../../services/uploadService', () => ({
  processUpload: jest.fn(),
  validateFile: jest.fn(),
  generateUniqueFilename: jest.fn(),
  upload: {
    single: jest.fn(() => (req, res, next) => {
      // Simulate multer attaching a file when multipart data is present
      if (mockSimulateFile && req.headers['content-type'] && req.headers['content-type'].includes('multipart')) {
        req.file = {
          originalname: 'test.pdf',
          filename: '1234-test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          path: '/uploads/1234-test.pdf'
        };
      }
      next();
    })
  }
}));
jest.mock('../../services/fileManager');
jest.mock('../../db/database');

const request = require('supertest');
const app = require('../../server');
const authService = require('../../services/authService');
const uploadService = require('../../services/uploadService');
const fileManager = require('../../services/fileManager');
const db = require('../../db/database');

// Helper to build mock user payloads
const makeAdminUser = () => ({ userId: 1, email: 'admin@example.com', role: 'ADMIN' });
const makeRegularUser = () => ({ userId: 2, email: 'user@example.com', role: 'USER' });

const mockFile = {
  id: 10,
  filename: 'test.pdf',
  path: '1234-test.pdf',
  mime_type: 'application/pdf',
  size: 1024,
  uploaded_by: 1,
  allowed_plan_ids: [],
  max_downloads_per_user: null,
  created_at: '2024-01-01T00:00:00.000Z'
};

describe('File Endpoints Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSimulateFile = true;
  });

  // ─── POST /api/files/upload ───────────────────────────────────────────────

  describe('POST /api/files/upload', () => {
    it('should upload a file successfully as ADMIN', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      uploadService.processUpload.mockResolvedValue(mockFile);

      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer valid-admin-token')
        .attach('file', Buffer.from('file content'), 'test.pdf');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('file');
      expect(res.body.file).toMatchObject({ filename: 'test.pdf' });
    });

    it('should return 400 when no file is provided', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      mockSimulateFile = false;

      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FILE');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('content'), 'test.pdf');

      expect(res.status).toBe(401);
    });

    it('should return 403 when USER tries to upload (Requirement 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer valid-user-token')
        .attach('file', Buffer.from('content'), 'test.pdf');

      expect(res.status).toBe(403);
    });

    it('should return 400 when upload service rejects file (e.g. too large)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      const err = new Error('File size exceeds maximum of 100MB');
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 400;
      uploadService.processUpload.mockRejectedValue(err);

      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer valid-admin-token')
        .attach('file', Buffer.from('content'), 'big.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  // ─── PUT /api/files/:id/permissions ──────────────────────────────────────

  describe('PUT /api/files/:id/permissions', () => {
    it('should update permissions successfully as ADMIN (Requirement 5.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      fileManager.updateFilePermissions.mockResolvedValue({
        ...mockFile,
        allowed_plan_ids: [1, 2],
        max_downloads_per_user: 5
      });

      const res = await request(app)
        .put('/api/files/10/permissions')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ allowedPlanIds: [1, 2], maxDownloadsPerUser: 5 });

      expect(res.status).toBe(200);
      expect(res.body.file.allowed_plan_ids).toEqual([1, 2]);
      expect(res.body.file.max_downloads_per_user).toBe(5);
    });

    it('should return 403 when USER tries to update permissions (Requirement 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .put('/api/files/10/permissions')
        .set('Authorization', 'Bearer valid-user-token')
        .send({ allowedPlanIds: [1] });

      expect(res.status).toBe(403);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .put('/api/files/10/permissions')
        .send({ allowedPlanIds: [1] });

      expect(res.status).toBe(401);
    });

    it('should return 400 when allowedPlanIds is missing', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());

      const res = await request(app)
        .put('/api/files/10/permissions')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ maxDownloadsPerUser: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 404 when file does not exist', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      fileManager.updateFilePermissions.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/files/999/permissions')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ allowedPlanIds: [1] });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid file ID', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());

      const res = await request(app)
        .put('/api/files/abc/permissions')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ allowedPlanIds: [1] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_ID');
    });

    it('should accept null maxDownloadsPerUser (unlimited)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      fileManager.updateFilePermissions.mockResolvedValue({
        ...mockFile,
        allowed_plan_ids: [1],
        max_downloads_per_user: null
      });

      const res = await request(app)
        .put('/api/files/10/permissions')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ allowedPlanIds: [1], maxDownloadsPerUser: null });

      expect(res.status).toBe(200);
      expect(res.body.file.max_downloads_per_user).toBeNull();
    });
  });

  // ─── DELETE /api/files/:id ────────────────────────────────────────────────

  describe('DELETE /api/files/:id', () => {
    it('should delete a file successfully as ADMIN', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      fileManager.deleteFile.mockResolvedValue();

      const res = await request(app)
        .delete('/api/files/10')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('File deleted successfully');
      expect(fileManager.deleteFile).toHaveBeenCalledWith(10);
    });

    it('should return 403 when USER tries to delete (Requirement 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .delete('/api/files/10')
        .set('Authorization', 'Bearer valid-user-token');

      expect(res.status).toBe(403);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).delete('/api/files/10');

      expect(res.status).toBe(401);
    });

    it('should return 404 when file does not exist', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      const err = new Error('File not found');
      err.code = 'FILE_NOT_FOUND';
      err.statusCode = 404;
      fileManager.deleteFile.mockRejectedValue(err);

      const res = await request(app)
        .delete('/api/files/999')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('should return 400 for invalid file ID', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());

      const res = await request(app)
        .delete('/api/files/abc')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_ID');
    });
  });

  // ─── GET /api/files ───────────────────────────────────────────────────────

  describe('GET /api/files', () => {
    it('should list all files as ADMIN', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      db.all.mockResolvedValue([
        { ...mockFile, allowed_plan_ids: '[]' },
        { ...mockFile, id: 11, filename: 'other.zip', allowed_plan_ids: '[1]' }
      ]);

      const res = await request(app)
        .get('/api/files')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(2);
      expect(res.body.files[0].allowed_plan_ids).toEqual([]);
      expect(res.body.files[1].allowed_plan_ids).toEqual([1]);
    });

    it('should return 403 when USER tries to list all files (Requirement 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .get('/api/files')
        .set('Authorization', 'Bearer valid-user-token');

      expect(res.status).toBe(403);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/files');

      expect(res.status).toBe(401);
    });
  });
});
