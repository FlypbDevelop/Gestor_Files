// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn()
  }
}));

const fileManager = require('../fileManager');
const db = require('../../db/database');
const fs = require('fs').promises;

describe('FileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── createFile ────────────────────────────────────────────────────────────

  describe('createFile', () => {
    it('should create a file record and return it (Req 4.1)', async () => {
      db.run.mockResolvedValue({ lastID: 7 });

      const fileData = {
        filename: 'report.pdf',
        path: 'uploads/report.pdf',
        mime_type: 'application/pdf',
        size: 2048,
        uploaded_by: 3
      };

      const result = await fileManager.createFile(fileData);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        ['report.pdf', 'uploads/report.pdf', 'application/pdf', 2048, 3, '[]', null]
      );

      expect(result).toMatchObject({
        id: 7,
        filename: 'report.pdf',
        path: 'uploads/report.pdf',
        mime_type: 'application/pdf',
        size: 2048,
        uploaded_by: 3,
        allowed_plan_ids: [],
        max_downloads_per_user: null
      });

      expect(result.created_at).toBeDefined();
    });

    it('should propagate database errors', async () => {
      db.run.mockRejectedValue(new Error('DB write failed'));

      await expect(
        fileManager.createFile({
          filename: 'x.pdf',
          path: 'x.pdf',
          mime_type: 'application/pdf',
          size: 100,
          uploaded_by: 1
        })
      ).rejects.toThrow('DB write failed');
    });
  });

  // ─── getFileById ───────────────────────────────────────────────────────────

  describe('getFileById', () => {
    it('should return the file with parsed allowed_plan_ids when found', async () => {
      db.get.mockResolvedValue({
        id: 5,
        filename: 'doc.pdf',
        path: 'doc.pdf',
        mime_type: 'application/pdf',
        size: 512,
        uploaded_by: 1,
        allowed_plan_ids: '[2,3]',
        max_downloads_per_user: 10,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const result = await fileManager.getFileById(5);

      expect(db.get).toHaveBeenCalledWith('SELECT * FROM files WHERE id = ?', [5]);
      expect(result).toMatchObject({
        id: 5,
        filename: 'doc.pdf',
        allowed_plan_ids: [2, 3],
        max_downloads_per_user: 10
      });
    });

    it('should return null when file is not found', async () => {
      db.get.mockResolvedValue(null);

      const result = await fileManager.getFileById(999);

      expect(result).toBeNull();
    });

    it('should handle empty allowed_plan_ids gracefully', async () => {
      db.get.mockResolvedValue({
        id: 1,
        filename: 'empty.pdf',
        path: 'empty.pdf',
        mime_type: 'application/pdf',
        size: 100,
        uploaded_by: 1,
        allowed_plan_ids: null,
        max_downloads_per_user: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const result = await fileManager.getFileById(1);

      expect(result.allowed_plan_ids).toEqual([]);
    });
  });

  // ─── updateFilePermissions ─────────────────────────────────────────────────

  describe('updateFilePermissions', () => {
    const mockUpdatedFile = {
      id: 1,
      filename: 'file.pdf',
      path: 'file.pdf',
      mime_type: 'application/pdf',
      size: 1024,
      uploaded_by: 1,
      allowed_plan_ids: '[1,2]',
      max_downloads_per_user: 5,
      created_at: '2024-01-01T00:00:00.000Z'
    };

    it('should update plan IDs and max downloads, returning updated file (Req 5.1, 5.2)', async () => {
      db.run.mockResolvedValue({ changes: 1 });
      db.get.mockResolvedValue(mockUpdatedFile);

      const result = await fileManager.updateFilePermissions(1, [1, 2], 5);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files'),
        [JSON.stringify([1, 2]), 5, 1]
      );

      expect(result).toMatchObject({
        id: 1,
        allowed_plan_ids: [1, 2],
        max_downloads_per_user: 5
      });
    });

    it('should allow null maxDownloadsPerUser (unlimited)', async () => {
      db.run.mockResolvedValue({ changes: 1 });
      db.get.mockResolvedValue({ ...mockUpdatedFile, max_downloads_per_user: null, allowed_plan_ids: '[1]' });

      const result = await fileManager.updateFilePermissions(1, [1], null);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files'),
        [JSON.stringify([1]), null, 1]
      );
      expect(result.max_downloads_per_user).toBeNull();
    });

    it('should reject non-array allowedPlanIds with INVALID_PLAN_ID', async () => {
      await expect(
        fileManager.updateFilePermissions(1, 'not-an-array', null)
      ).rejects.toMatchObject({ code: 'INVALID_PLAN_ID', statusCode: 400 });

      expect(db.run).not.toHaveBeenCalled();
    });

    it('should reject plan IDs that are not positive integers with INVALID_PLAN_ID', async () => {
      await expect(
        fileManager.updateFilePermissions(1, [0], null)
      ).rejects.toMatchObject({ code: 'INVALID_PLAN_ID', statusCode: 400 });

      await expect(
        fileManager.updateFilePermissions(1, [-1], null)
      ).rejects.toMatchObject({ code: 'INVALID_PLAN_ID', statusCode: 400 });

      await expect(
        fileManager.updateFilePermissions(1, [1.5], null)
      ).rejects.toMatchObject({ code: 'INVALID_PLAN_ID', statusCode: 400 });

      expect(db.run).not.toHaveBeenCalled();
    });

    it('should reject negative maxDownloadsPerUser with INVALID_DOWNLOAD_LIMIT', async () => {
      await expect(
        fileManager.updateFilePermissions(1, [1], -5)
      ).rejects.toMatchObject({ code: 'INVALID_DOWNLOAD_LIMIT', statusCode: 400 });

      expect(db.run).not.toHaveBeenCalled();
    });

    it('should reject zero maxDownloadsPerUser with INVALID_DOWNLOAD_LIMIT', async () => {
      await expect(
        fileManager.updateFilePermissions(1, [1], 0)
      ).rejects.toMatchObject({ code: 'INVALID_DOWNLOAD_LIMIT', statusCode: 400 });

      expect(db.run).not.toHaveBeenCalled();
    });

    it('should reject float maxDownloadsPerUser with INVALID_DOWNLOAD_LIMIT', async () => {
      await expect(
        fileManager.updateFilePermissions(1, [1], 2.5)
      ).rejects.toMatchObject({ code: 'INVALID_DOWNLOAD_LIMIT', statusCode: 400 });

      expect(db.run).not.toHaveBeenCalled();
    });
  });

  // ─── listFilesForPlan ──────────────────────────────────────────────────────

  describe('listFilesForPlan', () => {
    it('should return only files whose allowed_plan_ids includes the user plan (Req 6.1)', async () => {
      db.all.mockResolvedValue([
        {
          id: 1,
          filename: 'a.pdf',
          path: 'a.pdf',
          mime_type: 'application/pdf',
          size: 100,
          uploaded_by: 1,
          allowed_plan_ids: '[1,2]',
          max_downloads_per_user: null,
          downloads_count: 0,
          created_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          filename: 'b.pdf',
          path: 'b.pdf',
          mime_type: 'application/pdf',
          size: 200,
          uploaded_by: 1,
          allowed_plan_ids: '[3]',
          max_downloads_per_user: null,
          downloads_count: 0,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]);

      const result = await fileManager.listFilesForPlan(1, 42);

      // Only file id=1 is accessible to plan 1
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should include downloads_remaining when max_downloads_per_user is set (Req 5.2)', async () => {
      db.all.mockResolvedValue([
        {
          id: 10,
          filename: 'limited.pdf',
          path: 'limited.pdf',
          mime_type: 'application/pdf',
          size: 512,
          uploaded_by: 1,
          allowed_plan_ids: '[2]',
          max_downloads_per_user: 5,
          downloads_count: 2,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]);

      const result = await fileManager.listFilesForPlan(2, 7);

      expect(result).toHaveLength(1);
      expect(result[0].downloads_remaining).toBe(3); // 5 - 2
    });

    it('should set downloads_remaining to null when max_downloads_per_user is null', async () => {
      db.all.mockResolvedValue([
        {
          id: 11,
          filename: 'unlimited.pdf',
          path: 'unlimited.pdf',
          mime_type: 'application/pdf',
          size: 512,
          uploaded_by: 1,
          allowed_plan_ids: '[1]',
          max_downloads_per_user: null,
          downloads_count: 10,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]);

      const result = await fileManager.listFilesForPlan(1, 7);

      expect(result[0].downloads_remaining).toBeNull();
    });

    it('should return empty array when no files match the plan', async () => {
      db.all.mockResolvedValue([
        {
          id: 3,
          filename: 'other.pdf',
          path: 'other.pdf',
          mime_type: 'application/pdf',
          size: 100,
          uploaded_by: 1,
          allowed_plan_ids: '[5]',
          max_downloads_per_user: null,
          downloads_count: 0,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]);

      const result = await fileManager.listFilesForPlan(1, 42);

      expect(result).toEqual([]);
    });

    it('should pass userId to db.all for downloads_count subquery', async () => {
      db.all.mockResolvedValue([]);

      await fileManager.listFilesForPlan(1, 99);

      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('downloads'),
        [99]
      );
    });
  });

  // ─── deleteFile ────────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('should delete the DB record and the physical file on success', async () => {
      db.get.mockResolvedValue({
        id: 4,
        filename: 'todelete.pdf',
        path: 'todelete.pdf',
        mime_type: 'application/pdf',
        size: 100,
        uploaded_by: 1,
        allowed_plan_ids: '[]',
        max_downloads_per_user: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });
      db.run.mockResolvedValue({ changes: 1 });
      fs.unlink.mockResolvedValue();

      await fileManager.deleteFile(4);

      expect(db.run).toHaveBeenCalledWith('DELETE FROM files WHERE id = ?', [4]);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('todelete.pdf'));
    });

    it('should throw FILE_NOT_FOUND when file does not exist', async () => {
      db.get.mockResolvedValue(null);

      await expect(fileManager.deleteFile(999)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
        statusCode: 404
      });

      expect(db.run).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should not throw when physical file is already missing (ENOENT)', async () => {
      db.get.mockResolvedValue({
        id: 5,
        filename: 'gone.pdf',
        path: 'gone.pdf',
        mime_type: 'application/pdf',
        size: 100,
        uploaded_by: 1,
        allowed_plan_ids: '[]',
        max_downloads_per_user: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });
      db.run.mockResolvedValue({ changes: 1 });

      const enoent = new Error('File not found on disk');
      enoent.code = 'ENOENT';
      fs.unlink.mockRejectedValue(enoent);

      await expect(fileManager.deleteFile(5)).resolves.toBeUndefined();
      expect(db.run).toHaveBeenCalledWith('DELETE FROM files WHERE id = ?', [5]);
    });
  });
});
