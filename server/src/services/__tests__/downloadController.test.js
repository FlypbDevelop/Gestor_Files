jest.mock('../../db/database');
jest.mock('../accessValidator');
jest.mock('../fileManager');
jest.mock('fs');

const db = require('../../db/database');
const accessValidator = require('../accessValidator');
const fileManager = require('../fileManager');
const fs = require('fs');

const {
  processDownload,
  logDownload,
  streamFile,
  getRealIpAddress,
  debitCredits,
  rollbackCreditDownload
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

const MOCK_FILE = {
  id: 1,
  filename: 'report.pdf',
  path: 'abc123-report.pdf',
  mime_type: 'application/pdf',
  size: 2048,
  max_downloads_per_user: 5,
  allowed_plan_ids: [2]
};

// ─── getRealIpAddress ─────────────────────────────────────────────────────────

describe('getRealIpAddress', () => {
  it('should extract first IP from X-Forwarded-For header', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } };
    expect(getRealIpAddress(req)).toBe('203.0.113.1');
  });

  it('should extract IP from X-Real-IP header when X-Forwarded-For is absent', () => {
    const req = { headers: { 'x-real-ip': '198.51.100.5' } };
    expect(getRealIpAddress(req)).toBe('198.51.100.5');
  });

  it('should fall back to req.ip when no proxy headers are present', () => {
    const req = { headers: {}, ip: '192.168.1.1' };
    expect(getRealIpAddress(req)).toBe('192.168.1.1');
  });

  it('should fall back to req.connection.remoteAddress when req.ip is absent', () => {
    const req = { headers: {}, connection: { remoteAddress: '10.0.0.2' } };
    expect(getRealIpAddress(req)).toBe('10.0.0.2');
  });

  it('should return 0.0.0.0 when no IP source is available', () => {
    const req = { headers: {} };
    expect(getRealIpAddress(req)).toBe('0.0.0.0');
  });

  it('should prefer X-Forwarded-For over X-Real-IP', () => {
    const req = {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8'
      }
    };
    expect(getRealIpAddress(req)).toBe('1.2.3.4');
  });
});

// ─── logDownload ──────────────────────────────────────────────────────────────

describe('logDownload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should insert a record into downloads and return the download object with id', async () => {
    db.run.mockResolvedValue({ lastID: 42 });

    const result = await logDownload(7, 3, '1.2.3.4');

    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO downloads (user_id, file_id, ip_address, credit_cost) VALUES (?, ?, ?, ?)',
      [7, 3, '1.2.3.4', null]
    );

    expect(result).toMatchObject({
      id: 42,
      user_id: 7,
      file_id: 3,
      ip_address: '1.2.3.4',
      credit_cost: null
    });
    expect(result.downloaded_at).toBeDefined();
  });

  it('should store credit_cost when logging an avulso download', async () => {
    db.run.mockResolvedValue({ lastID: 43 });

    const result = await logDownload(7, 3, '1.2.3.4', 5);

    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO downloads (user_id, file_id, ip_address, credit_cost) VALUES (?, ?, ?, ?)',
      [7, 3, '1.2.3.4', 5]
    );
    expect(result.credit_cost).toBe(5);
  });

  it('should propagate database errors', async () => {
    db.run.mockRejectedValue(new Error('DB error'));

    await expect(logDownload(1, 1, '0.0.0.0')).rejects.toThrow('DB error');
  });
});

// ─── streamFile ───────────────────────────────────────────────────────────────

describe('streamFile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should set correct headers and pipe the read stream to res', async () => {
    const mockStream = {
      on: jest.fn(),
      pipe: jest.fn()
    };

    // Simulate 'end' event firing after pipe
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'end') {
        setImmediate(handler);
      }
      return mockStream;
    });

    fs.statSync.mockReturnValue({ size: 2048 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();

    await streamFile('/uploads/abc.pdf', 'report.pdf', 'application/pdf', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="report.pdf"'
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 2048);
    expect(mockStream.pipe).toHaveBeenCalledWith(res);
  });

  it('should reject when the read stream emits an error', async () => {
    const mockStream = {
      on: jest.fn(),
      pipe: jest.fn()
    };

    const streamError = new Error('read error');
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'error') {
        setImmediate(() => handler(streamError));
      }
      return mockStream;
    });

    fs.statSync.mockReturnValue({ size: 100 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();

    await expect(
      streamFile('/uploads/missing.pdf', 'missing.pdf', 'application/pdf', res)
    ).rejects.toThrow('read error');
  });
});

// ─── processDownload ──────────────────────────────────────────────────────────

describe('processDownload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 when plan does not have access', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({
      allowed: false,
      reason: 'Plan does not have access to this file'
    });

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Plan does not have access to this file' }
    });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('should return 429 with current/max when download limit is exceeded', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({
      allowed: false,
      reason: 'Download limit exceeded'
    });
    fileManager.getFileById.mockResolvedValue(MOCK_FILE);
    accessValidator.checkDownloadLimit.mockResolvedValue({ allowed: false, current: 5, max: 5 });

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'DOWNLOAD_LIMIT_EXCEEDED',
        message: 'Download limit exceeded',
        current: 5,
        max: 5
      }
    });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not found', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({
      allowed: false,
      reason: 'User not found'
    });

    const res = makeRes();
    await processDownload(999, 1, '1.2.3.4', res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'UNAUTHORIZED', message: 'User not found' }
    });
  });

  it('should return 404 when file record is not found after access check passes', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true });
    fileManager.getFileById.mockResolvedValue(null);

    const res = makeRes();
    await processDownload(1, 999, '1.2.3.4', res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'File not found' }
    });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('should log the download and stream the file on success', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true });
    fileManager.getFileById.mockResolvedValue(MOCK_FILE);
    db.run.mockResolvedValue({ lastID: 10 });

    // Mock streamFile internals
    const mockStream = { on: jest.fn(), pipe: jest.fn() };
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'end') setImmediate(handler);
      return mockStream;
    });
    fs.statSync.mockReturnValue({ size: 2048 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    // Log was created before streaming
    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO downloads (user_id, file_id, ip_address, credit_cost) VALUES (?, ?, ?, ?)',
      [1, 1, '1.2.3.4', null]
    );

    // File was streamed
    expect(mockStream.pipe).toHaveBeenCalledWith(res);
  });

  it('should return 402 when credits are insufficient for an avulso download', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({
      allowed: false,
      reason: 'INSUFFICIENT_CREDITS',
      required: 5,
      balance: 2
    });

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Créditos insuficientes para este download',
        required: 5,
        balance: 2
      }
    });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('should debit credits and stream when avulso download is allowed', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true, creditCost: 3 });
    fileManager.getFileById.mockResolvedValue(MOCK_FILE);

    db.withTransaction.mockImplementation(fn => fn());
    db.run
      .mockResolvedValueOnce({ changes: 1 }) // guarded credit debit
      .mockResolvedValueOnce({ lastID: 77 })  // credit_transactions insert
      .mockResolvedValueOnce({ lastID: 10 }); // downloads insert

    const mockStream = { on: jest.fn(), pipe: jest.fn() };
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'end') setImmediate(handler);
      return mockStream;
    });
    fs.statSync.mockReturnValue({ size: 2048 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    expect(db.run).toHaveBeenCalledWith(
      'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
      [3, 1, 3]
    );
    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO credit_transactions (user_id, amount, reason, file_id) VALUES (?, ?, ?, ?)',
      [1, -3, 'DOWNLOAD', 1]
    );
    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO downloads (user_id, file_id, ip_address, credit_cost) VALUES (?, ?, ?, ?)',
      [1, 1, '1.2.3.4', 3]
    );
    expect(mockStream.pipe).toHaveBeenCalledWith(res);
  });

  it('should refund credits and remove logs when avulso stream fails', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true, creditCost: 3 });
    fileManager.getFileById.mockResolvedValue(MOCK_FILE);

    db.withTransaction.mockImplementation(fn => fn());
    db.run
      .mockResolvedValueOnce({ changes: 1 }) // guarded credit debit
      .mockResolvedValueOnce({ lastID: 77 })  // credit_transactions insert
      .mockResolvedValueOnce({ lastID: 10 })  // downloads insert
      .mockResolvedValueOnce({ changes: 1 })  // rollback: delete transaction
      .mockResolvedValueOnce({ changes: 1 })  // rollback: refund credits
      .mockResolvedValueOnce({ changes: 1 }); // rollback: delete download log

    const mockStream = { on: jest.fn(), pipe: jest.fn() };
    const streamError = new Error('disk read error');
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'error') setImmediate(() => handler(streamError));
      return mockStream;
    });
    fs.statSync.mockReturnValue({ size: 2048 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM credit_transactions WHERE id = ?', [77]);
    expect(db.run).toHaveBeenCalledWith('UPDATE users SET credits = credits + ? WHERE id = ?', [3, 1]);
    expect(db.run).toHaveBeenCalledWith('DELETE FROM downloads WHERE id = ?', [10]);
  });

  it('should rollback the log entry when streaming fails', async () => {
    accessValidator.validateDownloadAccess.mockResolvedValue({ allowed: true });
    fileManager.getFileById.mockResolvedValue(MOCK_FILE);
    db.run
      .mockResolvedValueOnce({ lastID: 55 }) // logDownload INSERT
      .mockResolvedValueOnce({ changes: 1 }); // rollback DELETE

    // Simulate stream error
    const mockStream = { on: jest.fn(), pipe: jest.fn() };
    const streamError = new Error('disk read error');
    mockStream.on.mockImplementation((event, handler) => {
      if (event === 'error') setImmediate(() => handler(streamError));
      return mockStream;
    });
    fs.statSync.mockReturnValue({ size: 2048 });
    fs.createReadStream.mockReturnValue(mockStream);

    const res = makeRes();
    await processDownload(1, 1, '1.2.3.4', res);

    // Rollback DELETE should have been called with the log id
    expect(db.run).toHaveBeenCalledWith('DELETE FROM downloads WHERE id = ?', [55]);
  });
});

// ─── debitCredits / rollbackCreditDownload ─────────────────────────────────────

describe('debitCredits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should debit, write ledger and log inside a transaction when balance is enough', async () => {
    db.withTransaction.mockImplementation(fn => fn());
    db.run
      .mockResolvedValueOnce({ changes: 1 })
      .mockResolvedValueOnce({ lastID: 50 })
      .mockResolvedValueOnce({ lastID: 51 });

    const result = await debitCredits(1, 9, 4, '1.2.3.4');

    expect(db.withTransaction).toHaveBeenCalled();
    expect(result).toMatchObject({ transactionId: 50, cost: 4 });
    expect(result.downloadLog).toMatchObject({ id: 51, credit_cost: 4 });
  });

  it('should throw INSUFFICIENT_CREDITS and roll back when balance is not enough', async () => {
    db.withTransaction.mockImplementation(fn => fn());
    db.run.mockResolvedValueOnce({ changes: 0 });

    await expect(debitCredits(1, 9, 4, '1.2.3.4')).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS'
    });
  });

  it('should propagate transaction errors', async () => {
    db.withTransaction.mockRejectedValue(new Error('transaction failed'));

    await expect(debitCredits(1, 9, 4, '1.2.3.4')).rejects.toThrow('transaction failed');
  });
});

describe('rollbackCreditDownload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should refund credits, delete ledger entry and download log', async () => {
    db.run.mockResolvedValue({ changes: 1 });

    await rollbackCreditDownload(1, 4, 50, 51);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM credit_transactions WHERE id = ?', [50]);
    expect(db.run).toHaveBeenCalledWith('UPDATE users SET credits = credits + ? WHERE id = ?', [4, 1]);
    expect(db.run).toHaveBeenCalledWith('DELETE FROM downloads WHERE id = ?', [51]);
  });

  it('should only delete the download log when there is no credit transaction', async () => {
    db.run.mockResolvedValue({ changes: 1 });

    await rollbackCreditDownload(1, null, null, 51);

    expect(db.run).not.toHaveBeenCalledWith('DELETE FROM credit_transactions WHERE id = ?', [null]);
    expect(db.run).not.toHaveBeenCalledWith(expect.stringContaining('credits +'), expect.anything());
    expect(db.run).toHaveBeenCalledWith('DELETE FROM downloads WHERE id = ?', [51]);
  });
});
