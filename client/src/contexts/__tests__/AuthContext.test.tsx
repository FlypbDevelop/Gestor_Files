/**
 * Unit tests for AuthContext
 * Validates: Requirements 1.1, 1.2, 2.1
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import apiClient from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({
  default: {
    setToken: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'USER' as const,
  plan_id: 1,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const adminUser = { ...mockUser, id: 2, role: 'ADMIN' as const };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

// In-memory localStorage mock
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe('AuthContext', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.mocked(apiClient.getCurrentUser).mockRejectedValue(new Error('no token'));
  });

  it('starts unauthenticated with no stored token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  it('restores session from localStorage on mount (Req 1.1)', async () => {
    localStorageMock.getItem.mockReturnValue('stored-token');
    vi.mocked(apiClient.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('stored-token');
    });
    expect(apiClient.setToken).toHaveBeenCalledWith('stored-token');
  });

  it('clears token if getCurrentUser fails on mount', async () => {
    localStorageMock.getItem.mockReturnValue('bad-token');
    vi.mocked(apiClient.getCurrentUser).mockRejectedValue(new Error('401'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
  });

  it('login sets user, token and localStorage (Req 1.1)', async () => {
    vi.mocked(apiClient.login).mockResolvedValue({ token: 'new-token', user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe('new-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
    expect(apiClient.setToken).toHaveBeenCalledWith('new-token');
  });

  it('login propagates error on invalid credentials (Req 1.2)', async () => {
    vi.mocked(apiClient.login).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.login('bad@example.com', 'wrong');
      })
    ).rejects.toThrow('Unauthorized');

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('register sets user, token and localStorage (Req 2.1)', async () => {
    vi.mocked(apiClient.register).mockResolvedValue({ token: 'reg-token', user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register('Test', 'test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('reg-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'reg-token');
  });

  it('logout clears user, token and localStorage', async () => {
    vi.mocked(apiClient.login).mockResolvedValue({ token: 'tok', user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    expect(apiClient.setToken).toHaveBeenLastCalledWith(null);
  });

  it('isAdmin is true for ADMIN role', async () => {
    vi.mocked(apiClient.login).mockResolvedValue({ token: 'tok', user: adminUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('admin@example.com', 'password');
    });

    expect(result.current.isAdmin).toBe(true);
  });

  it('isAdmin is false for USER role', async () => {
    vi.mocked(apiClient.login).mockResolvedValue({ token: 'tok', user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAdmin).toBe(false);
  });

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });
});
