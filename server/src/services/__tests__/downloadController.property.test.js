// Mock dependencies BEFORE importing modules
jest.mock('../../db/database');
jest.mock('../accessValidator');
jest.mock('../fileManager');
jest.mock('fs');

const fc = require('fast-check');
const db = require('../../db/database');
const accessValidator = require('../accessValidator');
const fileManager = require('../fileManager');
const fs = require('fs');

const {
  processDownload,
  logDownload,
  streamFile,
  getRealIpAddress
} = require('../downloadController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    headersSent: false
  };
  return res;
}

function makeSuccessStream() {
  const mockStream = { on: jest.fn(), pipe: jest.fn() };
  mockStream.on.mockImplementation((event, handler) => {
    if (event === 'end') setImmediate(handler);
    return mockStream;
  });
  return mockStream;
}

// Arbitrary for valid IPv4 addresses
const ipv4Arb = fc.tuple(
  fc.integer({ min: 1, max: 254 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 254 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// Arbitrary for a valid file record
const fileRecordArb = fc.record({
  id: fc.integer({ min: 1, max: 99999 }),
  filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9._-]/g, 'x') + '.pdf'),
  path: fc.string({ minLength: 8, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') + '.pdf'),
  mime_type: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
  size: fc.integer({ min: 1, max: 10_000_000 }),
  max_downloads_per_user: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  allowed_plan_ids: fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 })
});

describe('DownloadController - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Property 23: Successful downloads create log entries
   * **Validates: Requirements 8.1**
   */
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 23: Successful downloads create log entries', () => {
    it('should insert a downloads record with user_id, file_id, and ip_address for any successful download', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fc.integer({ min: 1, max: 99999 }),
          async (userId, fileId, ipAddress, logId) => {
            jest.clearAllMocks();

            // Access is allowed
            accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true });

            // File exists
            const file = {
              id: fileId,
              filename: 'report.pdf',
              path: 'abc123.pdf',
              mime_type: 'application/pdf',
              size: 1024,
              max_downloads_per_user: null,
              allowed_plan_ids: [1]
            };
            fileManager.getFileById.mockResolvedValue(file);

            // DB insert returns a log id
            db.run.mockResolvedValue({ lastID: logId });

            // Stream succeeds
            const mockStream = makeSuccessStream();
            fs.statSync.mockReturnValue({ size: 1024 });
            fs.createReadStream.mockReturnValue(mockStream);

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Assert: INSERT into downloads was called with correct params (Req 8.1)
            expect(db.run).toHaveBeenCalledWith(
              'INSERT INTO downloads (user_id, file_id, ip_address) VALUES (?, ?, ?)',
              [userId, fileId, ipAddress]
            );
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should return a log entry containing user_id, file_id, ip_address, and downloaded_at via logDownload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fc.integer({ min: 1, max: 99999 }),
          async (userId, fileId, ipAddress, logId) => {
            jest.clearAllMocks();

            db.run.mockResolvedValue({ lastID: logId });

            const result = await logDownload(userId, fileId, ipAddress);

            // Req 8.1: log entry must contain all required fields
            expect(result).toMatchObject({
              id: logId,
              user_id: userId,
              file_id: fileId,
              ip_address: ipAddress
            });
            expect(result.downloaded_at).toBeDefined();
            expect(typeof result.downloaded_at).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Property 24: Failed downloads don't create log entries
   * **Validates: Requirements 8.2**
   */
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 24: Failed downloads don\'t create log entries', () => {
    it('should not insert into downloads when authentication fails (user not found)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          async (userId, fileId, ipAddress) => {
            jest.clearAllMocks();

            accessValidator.validateDownloadAccess.mockResolvedValue({
              allowed: false,
              reason: 'User not found'
            });

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Req 8.2: no log entry should be created
            expect(db.run).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should not insert into downloads when authorization fails (plan restriction)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          async (userId, fileId, ipAddress) => {
            jest.clearAllMocks();

            accessValidator.validateDownloadAccess.mockResolvedValue({
              allowed: false,
              reason: 'Plan does not have access to this file'
            });

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Req 8.2: no log entry should be created
            expect(db.run).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should not insert into downloads when download limit is exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fc.integer({ min: 1, max: 100 }),
          async (userId, fileId, ipAddress, maxDownloads) => {
            jest.clearAllMocks();

            accessValidator.validateDownloadAccess.mockResolvedValue({
              allowed: false,
              reason: 'Download limit exceeded'
            });
            fileManager.getFileById.mockResolvedValue({
              id: fileId,
              filename: 'file.pdf',
              path: 'file.pdf',
              mime_type: 'application/pdf',
              size: 512,
              max_downloads_per_user: maxDownloads,
              allowed_plan_ids: [1]
            });
            accessValidator.checkDownloadLimit.mockResolvedValue({
              allowed: false,
              current: maxDownloads,
              max: maxDownloads
            });

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Req 8.2: no log entry should be created
            expect(db.run).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(429);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Property 25: Real IP address is extracted correctly
   * **Validates: Requirements 8.3**
   */
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 25: Real IP address is extracted correctly', () => {
    it('should extract the first IP from X-Forwarded-For header for any valid IP list', () => {
      fc.assert(
        fc.property(
          ipv4Arb,
          fc.array(ipv4Arb, { minLength: 0, maxLength: 4 }),
          (clientIp, proxyIps) => {
            // Build X-Forwarded-For: clientIp, proxy1, proxy2, ...
            const forwardedFor = [clientIp, ...proxyIps].join(', ');
            const req = { headers: { 'x-forwarded-for': forwardedFor } };

            const result = getRealIpAddress(req);

            // Req 8.3: must return the first (real client) IP
            expect(result).toBe(clientIp);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should extract IP from X-Real-IP header when X-Forwarded-For is absent', () => {
      fc.assert(
        fc.property(
          ipv4Arb,
          (realIp) => {
            const req = { headers: { 'x-real-ip': realIp } };

            const result = getRealIpAddress(req);

            // Req 8.3: must return the X-Real-IP value
            expect(result).toBe(realIp);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should prefer X-Forwarded-For over X-Real-IP when both headers are present', () => {
      fc.assert(
        fc.property(
          ipv4Arb,
          ipv4Arb,
          (forwardedIp, realIp) => {
            fc.pre(forwardedIp !== realIp);

            const req = {
              headers: {
                'x-forwarded-for': forwardedIp,
                'x-real-ip': realIp
              }
            };

            const result = getRealIpAddress(req);

            // Req 8.3: X-Forwarded-For takes precedence
            expect(result).toBe(forwardedIp);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should fall back to req.ip when no proxy headers are present', () => {
      fc.assert(
        fc.property(
          ipv4Arb,
          (ip) => {
            const req = { headers: {}, ip };

            const result = getRealIpAddress(req);

            expect(result).toBe(ip);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should log the extracted real IP address in the download record', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fc.array(ipv4Arb, { minLength: 0, maxLength: 3 }),
          async (userId, fileId, clientIp, proxyIps) => {
            jest.clearAllMocks();

            // Simulate caller extracting IP via getRealIpAddress before calling logDownload
            const forwardedFor = [clientIp, ...proxyIps].join(', ');
            const req = { headers: { 'x-forwarded-for': forwardedFor } };
            const extractedIp = getRealIpAddress(req);

            db.run.mockResolvedValue({ lastID: 1 });

            const result = await logDownload(userId, fileId, extractedIp);

            // Req 8.3: the logged IP must be the real client IP, not a proxy IP
            expect(result.ip_address).toBe(clientIp);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Property 40: Download responses include required headers
   * **Validates: Requirements 15.3**
   */
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 40: Download responses include required headers', () => {
    it('should set Content-Type, Content-Disposition, and Content-Length headers for any file', async () => {
      await fc.assert(
        fc.asyncProperty(
          fileRecordArb,
          async (file) => {
            jest.clearAllMocks();

            const mockStream = makeSuccessStream();
            fs.statSync.mockReturnValue({ size: file.size });
            fs.createReadStream.mockReturnValue(mockStream);

            const res = makeRes();
            const filePath = `/uploads/${file.path}`;

            await streamFile(filePath, file.filename, file.mime_type, res);

            // Req 15.3: all three required headers must be set
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', file.mime_type);
            expect(res.setHeader).toHaveBeenCalledWith(
              'Content-Disposition',
              `attachment; filename="${file.filename}"`
            );
            expect(res.setHeader).toHaveBeenCalledWith('Content-Length', file.size);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should set Content-Length matching the actual file size on disk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'x') + '.bin'),
          fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'x') + '.bin'),
          fc.constantFrom('application/octet-stream', 'application/pdf', 'image/jpeg'),
          fc.integer({ min: 1, max: 50_000_000 }),
          async (filePath, filename, mimeType, fileSize) => {
            jest.clearAllMocks();

            const mockStream = makeSuccessStream();
            fs.statSync.mockReturnValue({ size: fileSize });
            fs.createReadStream.mockReturnValue(mockStream);

            const res = makeRes();
            await streamFile(filePath, filename, mimeType, res);

            // Req 15.3: Content-Length must match the actual file size
            expect(res.setHeader).toHaveBeenCalledWith('Content-Length', fileSize);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Property 41: Filesystem paths are never exposed
   * **Validates: Requirements 15.4**
   */
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 41: Filesystem paths are never exposed', () => {
    it('should not include the real filesystem path in error responses when streaming fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fileRecordArb,
          async (userId, fileId, ipAddress, file) => {
            jest.clearAllMocks();

            accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true });
            fileManager.getFileById.mockResolvedValue({ ...file, id: fileId });
            db.run
              .mockResolvedValueOnce({ lastID: 1 })   // logDownload INSERT
              .mockResolvedValueOnce({ changes: 1 }); // rollback DELETE

            // Simulate stream error
            const mockStream = { on: jest.fn(), pipe: jest.fn() };
            const streamError = new Error('disk read error');
            mockStream.on.mockImplementation((event, handler) => {
              if (event === 'error') setImmediate(() => handler(streamError));
              return mockStream;
            });
            fs.statSync.mockReturnValue({ size: file.size });
            fs.createReadStream.mockReturnValue(mockStream);

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Req 15.4: error response must not expose filesystem paths
            if (res.json.mock.calls.length > 0) {
              const responseBody = JSON.stringify(res.json.mock.calls[0][0]);
              // Must not contain absolute path segments
              expect(responseBody).not.toMatch(/\/uploads\//);
              expect(responseBody).not.toMatch(/\/src\//);
              expect(responseBody).not.toMatch(/[A-Z]:\\/); // Windows paths
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should not include the real filesystem path in access-denied responses', async () => {
      const denialReasons = [
        { reason: 'User not found', status: 401 },
        { reason: 'Plan does not have access to this file', status: 403 },
        { reason: 'Download limit exceeded', status: 429 }
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99999 }),
          fc.integer({ min: 1, max: 99999 }),
          ipv4Arb,
          fc.constantFrom(...denialReasons),
          async (userId, fileId, ipAddress, denial) => {
            jest.clearAllMocks();

            accessValidator.validateDownloadAccess.mockResolvedValue({
              allowed: false,
              reason: denial.reason
            });

            if (denial.reason === 'Download limit exceeded') {
              fileManager.getFileById.mockResolvedValue({
                id: fileId,
                filename: 'file.pdf',
                path: 'file.pdf',
                mime_type: 'application/pdf',
                size: 512,
                max_downloads_per_user: 5,
                allowed_plan_ids: [1]
              });
              accessValidator.checkDownloadLimit.mockResolvedValue({
                allowed: false,
                current: 5,
                max: 5
              });
            }

            const res = makeRes();
            await processDownload(userId, fileId, ipAddress, res);

            // Req 15.4: denial responses must not expose filesystem paths
            if (res.json.mock.calls.length > 0) {
              const responseBody = JSON.stringify(res.json.mock.calls[0][0]);
              expect(responseBody).not.toMatch(/\/uploads\//);
              expect(responseBody).not.toMatch(/\/src\//);
              expect(responseBody).not.toMatch(/[A-Z]:\\/);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should not expose the internal storage path in Content-Disposition header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fileRecordArb,
          async (file) => {
            jest.clearAllMocks();

            const internalPath = `/uploads/${file.path}`;
            const mockStream = makeSuccessStream();
            fs.statSync.mockReturnValue({ size: file.size });
            fs.createReadStream.mockReturnValue(mockStream);

            const res = makeRes();
            await streamFile(internalPath, file.filename, file.mime_type, res);

            // Req 15.4: Content-Disposition must use the original filename, not the internal path
            const dispositionCall = res.setHeader.mock.calls.find(
              ([header]) => header === 'Content-Disposition'
            );
            expect(dispositionCall).toBeDefined();
            const dispositionValue = dispositionCall[1];

            // Must not contain the internal storage path
            expect(dispositionValue).not.toContain('/uploads/');
            expect(dispositionValue).not.toContain(file.path);
            // Must contain the original filename
            expect(dispositionValue).toContain(file.filename);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
