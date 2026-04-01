/**
 * Unit tests for ApiClient
 * Validates: Requirements 1.1, 1.2, 4.1, 6.1, 7.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ApiRequestError } from '../../types';

// Mock axios.create so we can intercept calls
vi.mock('axios');

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

(axios.create as ReturnType<typeof vi.fn>).mockReturnValue(mockAxiosInstance);

// Import after mock is set up
const { default: apiClient } = await import('../apiClient');

// Capture the interceptors registered during construction (registered once at module load)
const requestUseCall = mockAxiosInstance.interceptors.request.use.mock.calls[0];
const responseUseCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];

const requestInterceptor: (config: Record<string, unknown>) => Record<string, unknown> =
  requestUseCall?.[0];
const responseSuccessInterceptor: (res: unknown) => unknown = responseUseCall?.[0];
const responseErrorInterceptor: (err: unknown) => never = responseUseCall?.[1];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Token configuration ──────────────────────────────────────────────────────

describe('setToken', () => {
  it('adds Authorization header when token is set', () => {
    apiClient.setToken('my-jwt-token');
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor(config) as typeof config;
    expect(result.headers.Authorization).toBe('Bearer my-jwt-token');
  });

  it('does not add Authorization header when token is null', () => {
    apiClient.setToken(null);
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor(config) as typeof config;
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('replaces previous token when called again', () => {
    apiClient.setToken('first-token');
    apiClient.setToken('second-token');
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor(config) as typeof config;
    expect(result.headers.Authorization).toBe('Bearer second-token');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('response error interceptor', () => {
  it('throws ApiRequestError with status and message from response', () => {
    const axiosError = {
      response: { status: 401, data: { message: 'Unauthorized', code: 'AUTH_FAILED' } },
    };
    expect(() => responseErrorInterceptor(axiosError)).toThrow(ApiRequestError);
    try {
      responseErrorInterceptor(axiosError);
    } catch (e) {
      const err = e as ApiRequestError;
      expect(err.status).toBe(401);
      expect(err.message).toBe('Unauthorized');
      expect(err.code).toBe('AUTH_FAILED');
    }
  });

  it('falls back to 500 when response is absent', () => {
    const axiosError = { message: 'Network Error' };
    try {
      responseErrorInterceptor(axiosError);
    } catch (e) {
      const err = e as ApiRequestError;
      expect(err.status).toBe(500);
      expect(err.message).toBe('Network Error');
    }
  });

  it('falls back to "Unknown error" when no message is available', () => {
    try {
      responseErrorInterceptor({});
    } catch (e) {
      const err = e as ApiRequestError;
      expect(err.message).toBe('Unknown error');
    }
  });

  it('passes through successful responses unchanged', () => {
    const response = { data: { token: 'abc' }, status: 200 };
    expect(responseSuccessInterceptor(response)).toBe(response);
  });
});

// ─── Auth methods (Requirement 1.1, 1.2, 2.1) ────────────────────────────────

describe('login', () => {
  it('posts to /auth/login and returns auth response (Req 1.1)', async () => {
    const mockResponse = { data: { token: 'jwt-token', user: { id: 1, email: 'a@b.com' } } };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.login('a@b.com', 'password123');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'password123',
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('propagates error on invalid credentials (Req 1.2)', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new ApiRequestError('Unauthorized', 401));
    await expect(apiClient.login('bad@email.com', 'wrong')).rejects.toThrow(ApiRequestError);
  });
});

describe('register', () => {
  it('posts to /auth/register and returns auth response', async () => {
    const mockResponse = { data: { token: 'jwt-token', user: { id: 2, email: 'new@b.com' } } };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.register('New User', 'new@b.com', 'password123');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/register', {
      name: 'New User',
      email: 'new@b.com',
      password: 'password123',
    });
    expect(result).toEqual(mockResponse.data);
  });
});

describe('getCurrentUser', () => {
  it('gets /auth/me and returns user', async () => {
    const mockUser = { id: 1, email: 'a@b.com', role: 'USER' };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockUser });

    const result = await apiClient.getCurrentUser();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(mockUser);
  });
});

// ─── File methods (Requirement 4.1, 6.1) ─────────────────────────────────────

describe('listFiles', () => {
  it('gets /files and returns file list (Req 6.1)', async () => {
    const mockFiles = [{ id: 1, filename: 'doc.pdf', downloads_remaining: 5 }];
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockFiles });

    const result = await apiClient.listFiles();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/files');
    expect(result).toEqual(mockFiles);
  });
});

describe('uploadFile', () => {
  it('posts multipart form data to /files/upload (Req 4.1)', async () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const permissions = { allowedPlanIds: [1, 2], maxDownloadsPerUser: 3 };
    const mockResponse = { data: { id: 10, filename: 'test.pdf' } };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.uploadFile(mockFile, permissions);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/files/upload',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    expect(result).toEqual(mockResponse.data);
  });

  it('omits maxDownloadsPerUser from form when null', async () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const permissions = { allowedPlanIds: [1], maxDownloadsPerUser: null };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: { id: 11 } });

    await apiClient.uploadFile(mockFile, permissions);

    const formData: FormData = mockAxiosInstance.post.mock.calls[0][1];
    expect(formData.has('maxDownloadsPerUser')).toBe(false);
  });
});

describe('updateFilePermissions', () => {
  it('puts to /files/:id/permissions', async () => {
    const permissions = { allowedPlanIds: [1], maxDownloadsPerUser: 5 };
    mockAxiosInstance.put.mockResolvedValueOnce({ data: { id: 1, ...permissions } });

    await apiClient.updateFilePermissions(1, permissions);

    expect(mockAxiosInstance.put).toHaveBeenCalledWith('/files/1/permissions', permissions);
  });
});

describe('deleteFile', () => {
  it('deletes /files/:id', async () => {
    mockAxiosInstance.delete.mockResolvedValueOnce({ data: null });

    await apiClient.deleteFile(42);

    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/files/42');
  });
});

// ─── Download methods (Requirement 7.1) ──────────────────────────────────────

describe('downloadFile', () => {
  it('gets /downloads/:fileId with blob responseType (Req 7.1)', async () => {
    const blob = new Blob(['file content']);
    mockAxiosInstance.get.mockResolvedValueOnce({ data: blob });

    const result = await apiClient.downloadFile(5);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/downloads/5', { responseType: 'blob' });
    expect(result).toBe(blob);
  });

  it('propagates 403 error when plan access denied', async () => {
    mockAxiosInstance.get.mockRejectedValueOnce(new ApiRequestError('Forbidden', 403));
    await expect(apiClient.downloadFile(5)).rejects.toThrow(ApiRequestError);
  });

  it('propagates 429 error when download limit exceeded', async () => {
    mockAxiosInstance.get.mockRejectedValueOnce(new ApiRequestError('Too Many Requests', 429));
    await expect(apiClient.downloadFile(5)).rejects.toThrow(ApiRequestError);
  });
});

describe('getDownloadHistory', () => {
  it('gets /downloads/history and returns history entries', async () => {
    const history = [{ id: 1, file_id: 2, filename: 'doc.pdf', downloaded_at: '2024-01-01' }];
    mockAxiosInstance.get.mockResolvedValueOnce({ data: history });

    const result = await apiClient.getDownloadHistory();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/downloads/history');
    expect(result).toEqual(history);
  });
});
