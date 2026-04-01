/**
 * Unit tests for ApiClient
 * Validates: Requirements 1.1, 1.2, 4.1, 6.1, 7.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiRequestError } from '../../types';

// Interceptors captured at construction time
let capturedRequestFn: ((c: Record<string, unknown>) => Record<string, unknown>) | null = null;
let capturedResponseSuccess: ((r: unknown) => unknown) | null = null;
let capturedResponseError: ((e: unknown) => never) | null = null;

const { mockPost, mockGet, mockPut, mockDelete } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: mockGet,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: {
          use: (fn: (c: Record<string, unknown>) => Record<string, unknown>) => {
            capturedRequestFn = fn;
          },
        },
        response: {
          use: (onSuccess: (r: unknown) => unknown, onError: (e: unknown) => never) => {
            capturedResponseSuccess = onSuccess;
            capturedResponseError = onError;
          },
        },
      },
    })),
  },
}));

import apiClient from '../apiClient';


describe('ApiClient', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
    apiClient.setToken(null);
  });

  // ---- Token configuration ----
  describe('Token configuration', () => {
    it('does not set Authorization header when no token is set', () => {
      const config = { headers: {} as Record<string, string> };
      const result = capturedRequestFn!(config) as typeof config;
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('sets Authorization header with Bearer token after setToken()', () => {
      apiClient.setToken('my-jwt-token');
      const config = { headers: {} as Record<string, string> };
      const result = capturedRequestFn!(config) as typeof config;
      expect(result.headers.Authorization).toBe('Bearer my-jwt-token');
    });

    it('removes Authorization header after setToken(null)', () => {
      apiClient.setToken('some-token');
      apiClient.setToken(null);
      const config = { headers: {} as Record<string, string> };
      const result = capturedRequestFn!(config) as typeof config;
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('updates token when setToken is called multiple times', () => {
      apiClient.setToken('first-token');
      apiClient.setToken('second-token');
      const config = { headers: {} as Record<string, string> };
      const result = capturedRequestFn!(config) as typeof config;
      expect(result.headers.Authorization).toBe('Bearer second-token');
    });
  });

  // ---- Error handling ----
  describe('Error handling', () => {
    it('throws ApiRequestError with status 401 (Req 1.2)', () => {
      const err = { response: { status: 401, data: { message: 'Invalid credentials' } }, message: 'fail' };
      expect(() => capturedResponseError!(err)).toThrow(ApiRequestError);
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).status).toBe(401);
        expect((e as ApiRequestError).message).toBe('Invalid credentials');
      }
    });

    it('throws ApiRequestError with status 403 and code', () => {
      const err = { response: { status: 403, data: { message: 'Forbidden', code: 'FORBIDDEN' } }, message: 'fail' };
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).status).toBe(403);
        expect((e as ApiRequestError).code).toBe('FORBIDDEN');
      }
    });

    it('throws ApiRequestError with status 409', () => {
      const err = { response: { status: 409, data: { message: 'File already exists' } }, message: 'fail' };
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).status).toBe(409);
      }
    });

    it('throws ApiRequestError with status 429', () => {
      const err = { response: { status: 429, data: { message: 'Too many requests', code: 'RATE_LIMIT' } }, message: 'fail' };
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).status).toBe(429);
        expect((e as ApiRequestError).code).toBe('RATE_LIMIT');
      }
    });

    it('falls back to status 500 when response is absent', () => {
      const err = { message: 'Network Error' };
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).status).toBe(500);
        expect((e as ApiRequestError).message).toBe('Network Error');
      }
    });

    it('falls back to "Unknown error" when no message is available', () => {
      const err = { response: { status: 500, data: {} } };
      try { capturedResponseError!(err); } catch (e) {
        expect((e as ApiRequestError).message).toBe('Unknown error');
      }
    });

    it('passes successful responses through unchanged', () => {
      const response = { data: { token: 'abc' }, status: 200 };
      expect(capturedResponseSuccess!(response)).toBe(response);
    });
  });

  // ---- Auth methods (Req 1.1, 1.2, 7.1) ----
  describe('Auth methods', () => {
    const authResponse = {
      token: 'jwt-token-24h',
      user: { id: 1, name: 'Alice', email: 'alice@example.com', role: 'USER', plan_id: 1, created_at: '', updated_at: '' },
    };

    it('login() POSTs to /auth/login and returns AuthResponse (Req 1.1)', async () => {
      mockPost.mockResolvedValueOnce({ data: authResponse });
      const result = await apiClient.login('alice@example.com', 'password123');
      expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'alice@example.com', password: 'password123' });
      expect(result).toEqual(authResponse);
    });

    it('login() propagates ApiRequestError on 401 (Req 1.2)', async () => {
      mockPost.mockRejectedValueOnce(new ApiRequestError('Invalid credentials', 401));
      await expect(apiClient.login('bad@example.com', 'wrong')).rejects.toBeInstanceOf(ApiRequestError);
    });

    it('login() error has status 401 (Req 1.2)', async () => {
      mockPost.mockRejectedValueOnce(new ApiRequestError('Invalid credentials', 401));
      await expect(apiClient.login('bad@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });
    });

    it('register() POSTs to /auth/register and returns AuthResponse', async () => {
      mockPost.mockResolvedValueOnce({ data: authResponse });
      const result = await apiClient.register('Alice', 'alice@example.com', 'password123');
      expect(mockPost).toHaveBeenCalledWith('/auth/register', { name: 'Alice', email: 'alice@example.com', password: 'password123' });
      expect(result).toEqual(authResponse);
    });

    it('getCurrentUser() GETs /auth/me and returns User (Req 7.1)', async () => {
      mockGet.mockResolvedValueOnce({ data: authResponse.user });
      const result = await apiClient.getCurrentUser();
      expect(mockGet).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(authResponse.user);
    });

    it('getCurrentUser() propagates 401 when not authenticated (Req 7.1)', async () => {
      mockGet.mockRejectedValueOnce(new ApiRequestError('Unauthorized', 401));
      await expect(apiClient.getCurrentUser()).rejects.toMatchObject({ status: 401 });
    });
  });

  // ---- File methods (Req 4.1, 6.1) ----
  describe('File methods', () => {
    const fileRecord = {
      id: 10, filename: 'report.pdf', path: '/uploads/report.pdf',
      mime_type: 'application/pdf', size: 204800, uploaded_by: 1,
      allowed_plan_ids: [1, 2], max_downloads_per_user: null, created_at: '', updated_at: '',
    };

    it('listFiles() GETs /files and returns accessible files (Req 6.1)', async () => {
      const files = [{ ...fileRecord, downloads_remaining: null }];
      mockGet.mockResolvedValueOnce({ data: files });
      const result = await apiClient.listFiles();
      expect(mockGet).toHaveBeenCalledWith('/files');
      expect(result).toEqual(files);
    });

    it('listFiles() propagates 401 when not authenticated (Req 7.1)', async () => {
      mockGet.mockRejectedValueOnce(new ApiRequestError('Unauthorized', 401));
      await expect(apiClient.listFiles()).rejects.toMatchObject({ status: 401 });
    });

    it('uploadFile() POSTs FormData to /files/upload (Req 4.1)', async () => {
      mockPost.mockResolvedValueOnce({ data: fileRecord });
      const file = new globalThis.File([new Blob(['content'])], 'test.txt', { type: 'text/plain' });
      const result = await apiClient.uploadFile(file, { allowedPlanIds: [1, 2], maxDownloadsPerUser: 5 });
      expect(mockPost).toHaveBeenCalledWith('/files/upload', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(result).toEqual(fileRecord);
    });

    it('uploadFile() includes allowedPlanIds as JSON string in FormData (Req 4.1)', async () => {
      mockPost.mockResolvedValueOnce({ data: fileRecord });
      const file = new globalThis.File([new Blob(['x'])], 'f.txt', { type: 'text/plain' });
      await apiClient.uploadFile(file, { allowedPlanIds: [1, 2, 3], maxDownloadsPerUser: null });
      const [, fd] = mockPost.mock.calls[0];
      expect((fd as FormData).get('allowedPlanIds')).toBe('[1,2,3]');
    });

    it('uploadFile() omits maxDownloadsPerUser from FormData when null (Req 4.1)', async () => {
      mockPost.mockResolvedValueOnce({ data: fileRecord });
      const file = new globalThis.File([new Blob(['x'])], 'f.txt', { type: 'text/plain' });
      await apiClient.uploadFile(file, { allowedPlanIds: [1], maxDownloadsPerUser: null });
      const [, fd] = mockPost.mock.calls[0];
      expect((fd as FormData).get('maxDownloadsPerUser')).toBeNull();
    });

    it('uploadFile() includes maxDownloadsPerUser in FormData when set (Req 4.1)', async () => {
      mockPost.mockResolvedValueOnce({ data: fileRecord });
      const file = new globalThis.File([new Blob(['x'])], 'f.txt', { type: 'text/plain' });
      await apiClient.uploadFile(file, { allowedPlanIds: [1], maxDownloadsPerUser: 10 });
      const [, fd] = mockPost.mock.calls[0];
      expect((fd as FormData).get('maxDownloadsPerUser')).toBe('10');
    });

    it('updateFilePermissions() PUTs to /files/:id/permissions', async () => {
      mockPut.mockResolvedValueOnce({ data: fileRecord });
      const permissions = { allowedPlanIds: [1], maxDownloadsPerUser: 10 };
      const result = await apiClient.updateFilePermissions(10, permissions);
      expect(mockPut).toHaveBeenCalledWith('/files/10/permissions', permissions);
      expect(result).toEqual(fileRecord);
    });

    it('deleteFile() DELETEs /files/:id', async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });
      await apiClient.deleteFile(10);
      expect(mockDelete).toHaveBeenCalledWith('/files/10');
    });
  });

  // ---- Download methods (Req 7.1, 6.1) ----
  describe('Download methods', () => {
    it('downloadFile() GETs /downloads/:id with responseType blob (Req 7.1)', async () => {
      const blob = new Blob(['binary'], { type: 'application/octet-stream' });
      mockGet.mockResolvedValueOnce({ data: blob });
      const result = await apiClient.downloadFile(10);
      expect(mockGet).toHaveBeenCalledWith('/downloads/10', { responseType: 'blob' });
      expect(result).toBe(blob);
    });

    it('downloadFile() propagates 401 when not authenticated (Req 7.1)', async () => {
      mockGet.mockRejectedValueOnce(new ApiRequestError('Unauthorized', 401));
      await expect(apiClient.downloadFile(10)).rejects.toMatchObject({ status: 401 });
    });

    it('downloadFile() propagates 403 when plan does not allow access (Req 6.1)', async () => {
      mockGet.mockRejectedValueOnce(new ApiRequestError('Forbidden', 403));
      await expect(apiClient.downloadFile(10)).rejects.toMatchObject({ status: 403 });
    });

    it('getDownloadHistory() GETs /downloads/history', async () => {
      const history = [{ id: 1, user_id: 1, file_id: 10, ip_address: '127.0.0.1', downloaded_at: '', filename: 'report.pdf' }];
      mockGet.mockResolvedValueOnce({ data: history });
      const result = await apiClient.getDownloadHistory();
      expect(mockGet).toHaveBeenCalledWith('/downloads/history');
      expect(result).toEqual(history);
    });
  });
});
