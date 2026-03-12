// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn()
  }
}));

const uploadService = require('../uploadService');
const db = require('../../db/database');
const fs = require('fs').promises;

describe('UploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp and hash', () => {
      const originalName = 'test-file.pdf';
      const filename1 = uploadService.generateUniqueFilename(originalName);
      const filename2 = uploadService.generateUniqueFilename(originalName);

      expect(filename1).toMatch(/^\d+-[a-f0-9]{16}-test-file\.pdf$/);
      expect(filename2).toMatch(/^\d+-[a-f0-9]{16}-test-file\.pdf$/);
      expect(filename1).not.toBe(filename2); // Should be unique
    });

    it('should sanitize filename to prevent path traversal', () => {
      const maliciousName = '../../../etc/passwd.txt';
      const filename = uploadService.generateUniqueFilename(maliciousName);

      expect(filename).not.toContain('..');
      expect(filename).not.toContain('/');
      // path.basename extracts just "passwd" from the path, then sanitizes it
      expect(filename).toMatch(/^\d+-[a-f0-9]{16}-passwd\.txt$/);
    });

    it('should preserve file extension', () => {
      const filename = uploadService.generateUniqueFilename('document.docx');
      expect(filename).toMatch(/\.docx$/);
    });

    it('should handle files without extension', () => {
      const filename = uploadService.generateUniqueFilename('README');
      expect(filename).toMatch(/^\d+-[a-f0-9]{16}-README$/);
    });
  });

  describe('validateFile', () => {
    it('should validate file successfully when size is within limit', () => {
      const file = {
        originalname: 'test.pdf',
        size: 50 * 1024 * 1024, // 50MB
        mimetype: 'application/pdf'
      };

      expect(() => uploadService.validateFile(file)).not.toThrow();
    });

    it('should throw error when no file is provided', () => {
      expect(() => uploadService.validateFile(null)).toThrow('No file provided');
      expect(() => uploadService.validateFile(undefined)).toThrow('No file provided');
    });

    it('should throw error when file exceeds 100MB', () => {
      const file = {
        originalname: 'large.pdf',
        size: 101 * 1024 * 1024, // 101MB
        mimetype: 'application/pdf'
      };

      expect(() => uploadService.validateFile(file)).toThrow('File size exceeds maximum of 100MB');
    });

    it('should accept file exactly at 100MB limit', () => {
      const file = {
        originalname: 'max.pdf',
        size: 100 * 1024 * 1024, // Exactly 100MB
        mimetype: 'application/pdf'
      };

      expect(() => uploadService.validateFile(file)).not.toThrow();
    });
  });

  describe('processUpload', () => {
    const mockFile = {
      originalname: 'test-document.pdf',
      filename: '1234567890-abcdef1234567890-test-document.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 1024, // 1MB
      path: '/uploads/1234567890-abcdef1234567890-test-document.pdf'
    };

    it('should create database record and return file data', async () => {
      db.run.mockResolvedValue({ lastID: 42 });

      const result = await uploadService.processUpload(mockFile, 1);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        [
          'test-document.pdf',
          '1234567890-abcdef1234567890-test-document.pdf',
          'application/pdf',
          1024 * 1024,
          1,
          '[]',
          null
        ]
      );

      expect(result).toMatchObject({
        id: 42,
        filename: 'test-document.pdf',
        path: '1234567890-abcdef1234567890-test-document.pdf',
        mime_type: 'application/pdf',
        size: 1024 * 1024,
        uploaded_by: 1,
        allowed_plan_ids: [],
        max_downloads_per_user: null
      });
    });

    it('should throw error and cleanup file when database insert fails', async () => {
      const dbError = new Error('Database error');
      db.run.mockRejectedValue(dbError);
      fs.unlink.mockResolvedValue();

      await expect(uploadService.processUpload(mockFile, 1)).rejects.toThrow('Database error');

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(mockFile.filename)
      );
    });

    it('should throw error when file validation fails', async () => {
      const largeFile = {
        ...mockFile,
        size: 101 * 1024 * 1024 // 101MB
      };

      await expect(uploadService.processUpload(largeFile, 1)).rejects.toThrow('File size exceeds maximum of 100MB');
      expect(db.run).not.toHaveBeenCalled();
    });

    it('should throw error when no file is provided', async () => {
      await expect(uploadService.processUpload(null, 1)).rejects.toThrow('No file provided');
      expect(db.run).not.toHaveBeenCalled();
    });

    it('should handle cleanup failure gracefully', async () => {
      const dbError = new Error('Database error');
      db.run.mockRejectedValue(dbError);
      fs.unlink.mockRejectedValue(new Error('Cleanup failed'));

      // Should still throw the original database error
      await expect(uploadService.processUpload(mockFile, 1)).rejects.toThrow('Database error');
    });
  });

  describe('Configuration', () => {
    it('should have correct upload directory path', () => {
      expect(uploadService.UPLOAD_DIR).toContain('uploads');
    });

    it('should have correct max file size (100MB)', () => {
      expect(uploadService.MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });

    it('should export multer upload middleware', () => {
      expect(uploadService.upload).toBeDefined();
      expect(typeof uploadService.upload.single).toBe('function');
    });
  });
});
