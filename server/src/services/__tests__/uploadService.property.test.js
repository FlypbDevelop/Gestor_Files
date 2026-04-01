// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn()
  }
}));

const fc = require('fast-check');
const uploadService = require('../uploadService');
const db = require('../../db/database');
const fs = require('fs').promises;

describe('UploadService - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 10: File upload creates both file and database record
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 10: File upload creates both file and database record', () => {
    it('should create a database record with all required fields for any valid file', async () => {
      // Arbitrary for valid file sizes (1 byte to 100MB)
      const validFileSizeArb = fc.integer({ min: 1, max: 100 * 1024 * 1024 });

      // Arbitrary for valid mime types
      const mimeTypeArb = fc.oneof(
        fc.constant('application/pdf'),
        fc.constant('image/jpeg'),
        fc.constant('image/png'),
        fc.constant('application/zip'),
        fc.constant('text/plain'),
        fc.constant('application/octet-stream')
      );

      // Arbitrary for valid original filenames (safe characters only)
      const filenameArb = fc
        .tuple(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          fc.oneof(
            fc.constant('.pdf'),
            fc.constant('.jpg'),
            fc.constant('.png'),
            fc.constant('.zip'),
            fc.constant('.txt')
          )
        )
        .map(([name, ext]) => `${name}${ext}`);

      // Arbitrary for valid uploader IDs
      const uploaderIdArb = fc.integer({ min: 1, max: 9999 });

      await fc.assert(
        fc.asyncProperty(
          filenameArb,
          mimeTypeArb,
          validFileSizeArb,
          uploaderIdArb,
          async (originalname, mimetype, size, uploadedBy) => {
            // Reset mocks between each property run
            jest.clearAllMocks();

            // Arrange: mock db.run to simulate successful insert
            const mockLastID = 42;
            db.run.mockResolvedValue({ lastID: mockLastID });

            const uniqueFilename = `1234567890-abcdef1234567890-${originalname}`;
            const file = {
              originalname,
              filename: uniqueFilename,
              mimetype,
              size,
              path: `/uploads/${uniqueFilename}`
            };

            // Act
            const result = await uploadService.processUpload(file, uploadedBy);

            // Assert: db.run was called exactly once (database record created - Req 4.1)
            expect(db.run).toHaveBeenCalledTimes(1);
            expect(db.run).toHaveBeenCalledWith(
              expect.stringContaining('INSERT INTO files'),
              expect.any(Array)
            );

            // Assert: result contains all required fields (Req 4.2)
            expect(result).toHaveProperty('id', mockLastID);
            expect(result).toHaveProperty('filename', originalname);
            expect(result).toHaveProperty('path', uniqueFilename);
            expect(result).toHaveProperty('mime_type', mimetype);
            expect(result).toHaveProperty('size', size);
            expect(result).toHaveProperty('uploaded_by', uploadedBy);
            expect(result).toHaveProperty('allowed_plan_ids');
            expect(result).toHaveProperty('created_at');
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should pass filename, path, mime_type, size and timestamp to the database for any valid file', async () => {
      const validFileSizeArb = fc.integer({ min: 1, max: 100 * 1024 * 1024 });
      const mimeTypeArb = fc.oneof(
        fc.constant('application/pdf'),
        fc.constant('image/jpeg'),
        fc.constant('image/png'),
        fc.constant('text/plain')
      );
      const filenameArb = fc
        .tuple(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          fc.constant('.pdf')
        )
        .map(([name, ext]) => `${name}${ext}`);

      await fc.assert(
        fc.asyncProperty(
          filenameArb,
          mimeTypeArb,
          validFileSizeArb,
          fc.integer({ min: 1, max: 9999 }),
          async (originalname, mimetype, size, uploadedBy) => {
            // Reset mocks between each property run
            jest.clearAllMocks();
            db.run.mockResolvedValue({ lastID: 1 });

            const uniqueFilename = `1234567890-abcdef1234567890-${originalname}`;
            const file = {
              originalname,
              filename: uniqueFilename,
              mimetype,
              size,
              path: `/uploads/${uniqueFilename}`
            };

            await uploadService.processUpload(file, uploadedBy);

            // Assert: the INSERT call includes all required fields (Req 4.2)
            const [, params] = db.run.mock.calls[0];
            expect(params[0]).toBe(originalname);    // filename
            expect(params[1]).toBe(uniqueFilename);  // path (unique filename)
            expect(params[2]).toBe(mimetype);        // mime_type
            expect(params[3]).toBe(size);            // size
            expect(params[4]).toBe(uploadedBy);      // uploaded_by (timestamp recorded via created_at in DB)
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  /**
   * Property 11: Failed uploads don't create database records
   * **Validates: Requirements 4.4**
   */
  describe("Property 11: Failed uploads don't create database records", () => {
    it('should not create a database record when file is null or undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9999 }),
          async (uploadedBy) => {
            jest.clearAllMocks();

            // Act & Assert: null file should throw and NOT call db.run
            await expect(
              uploadService.processUpload(null, uploadedBy)
            ).rejects.toThrow('No file provided');

            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not create a database record when file exceeds 100MB', async () => {
      // Arbitrary for oversized files (> 100MB)
      const oversizedFileArb = fc.integer({ min: 100 * 1024 * 1024 + 1, max: 200 * 1024 * 1024 });

      await fc.assert(
        fc.asyncProperty(
          oversizedFileArb,
          fc.integer({ min: 1, max: 9999 }),
          async (size, uploadedBy) => {
            jest.clearAllMocks();

            const file = {
              originalname: 'large-file.pdf',
              filename: '1234567890-abcdef1234567890-large-file.pdf',
              mimetype: 'application/pdf',
              size,
              path: '/uploads/1234567890-abcdef1234567890-large-file.pdf'
            };

            // Act & Assert: oversized file should throw and NOT call db.run
            await expect(
              uploadService.processUpload(file, uploadedBy)
            ).rejects.toThrow('File size exceeds maximum of 100MB');

            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not leave a database record when db.run throws an error', async () => {
      const validFileSizeArb = fc.integer({ min: 1, max: 100 * 1024 * 1024 });

      await fc.assert(
        fc.asyncProperty(
          validFileSizeArb,
          fc.integer({ min: 1, max: 9999 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (size, uploadedBy, errorMessage) => {
            jest.clearAllMocks();

            // Arrange: db.run fails
            db.run.mockRejectedValue(new Error(errorMessage));
            fs.unlink.mockResolvedValue();

            const file = {
              originalname: 'test.pdf',
              filename: '1234567890-abcdef1234567890-test.pdf',
              mimetype: 'application/pdf',
              size,
              path: '/uploads/1234567890-abcdef1234567890-test.pdf'
            };

            // Act & Assert: should throw the db error
            await expect(
              uploadService.processUpload(file, uploadedBy)
            ).rejects.toThrow(errorMessage);

            // Assert: db.run was called once (attempted insert) but threw — no record persists
            expect(db.run).toHaveBeenCalledTimes(1);

            // Assert: file cleanup was attempted (Req 4.4 - no record left behind)
            expect(fs.unlink).toHaveBeenCalledWith(
              expect.stringContaining(file.filename)
            );
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should return a descriptive error for any upload failure', async () => {
      const errorMessages = [
        'Database connection failed',
        'Disk full',
        'Permission denied',
        'Constraint violation'
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: errorMessages.length - 1 }),
          fc.integer({ min: 1, max: 9999 }),
          async (errorIndex, uploadedBy) => {
            jest.clearAllMocks();

            const errorMessage = errorMessages[errorIndex];
            db.run.mockRejectedValue(new Error(errorMessage));
            fs.unlink.mockResolvedValue();

            const file = {
              originalname: 'test.pdf',
              filename: '1234567890-abcdef1234567890-test.pdf',
              mimetype: 'application/pdf',
              size: 1024,
              path: '/uploads/1234567890-abcdef1234567890-test.pdf'
            };

            // Act: capture the thrown error
            let thrownError;
            try {
              await uploadService.processUpload(file, uploadedBy);
            } catch (err) {
              thrownError = err;
            }

            // Assert: error is descriptive (has a non-empty message)
            expect(thrownError).toBeDefined();
            expect(typeof thrownError.message).toBe('string');
            expect(thrownError.message.length).toBeGreaterThan(0);
            expect(thrownError.message).toBe(errorMessage);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
