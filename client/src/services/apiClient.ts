import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AuthResponse,
  User,
  File,
  FilePermissions,
  FileWithDownloadsRemaining,
  DownloadHistoryEntry,
  AdminStats,
  UserDashboard,
  ApiRequestError,
} from '../types';

class ApiClient {
  private instance: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL ?? '/api',
    });

    this.instance.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status: number = error.response?.status ?? 500;
        const message: string =
          error.response?.data?.message ?? error.message ?? 'Unknown error';
        const code: string | undefined = error.response?.data?.code;
        throw new ApiRequestError(message, status, code);
      }
    );
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  // ---- Auth ----

  async login(email: string, password: string): Promise<AuthResponse> {
    const res: AxiosResponse<AuthResponse> = await this.instance.post('/auth/login', {
      email,
      password,
    });
    return res.data;
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res: AxiosResponse<AuthResponse> = await this.instance.post('/auth/register', {
      name,
      email,
      password,
    });
    return res.data;
  }

  async getCurrentUser(): Promise<User> {
    const res: AxiosResponse<User> = await this.instance.get('/auth/me');
    return res.data;
  }

  // ---- Files ----

  async listFiles(): Promise<FileWithDownloadsRemaining[]> {
    const res: AxiosResponse<FileWithDownloadsRemaining[]> = await this.instance.get('/files');
    return res.data;
  }

  async uploadFile(file: globalThis.File, permissions: FilePermissions): Promise<File> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('allowedPlanIds', JSON.stringify(permissions.allowedPlanIds));
    if (permissions.maxDownloadsPerUser !== null) {
      formData.append('maxDownloadsPerUser', String(permissions.maxDownloadsPerUser));
    }
    const res: AxiosResponse<File> = await this.instance.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async updateFilePermissions(fileId: number, permissions: FilePermissions): Promise<File> {
    const res: AxiosResponse<File> = await this.instance.put(
      `/files/${fileId}/permissions`,
      permissions
    );
    return res.data;
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.instance.delete(`/files/${fileId}`);
  }

  // ---- Downloads ----

  async downloadFile(fileId: number): Promise<Blob> {
    const res: AxiosResponse<Blob> = await this.instance.get(`/downloads/${fileId}`, {
      responseType: 'blob',
    });
    return res.data;
  }

  async getDownloadHistory(): Promise<DownloadHistoryEntry[]> {
    const res: AxiosResponse<DownloadHistoryEntry[]> = await this.instance.get(
      '/downloads/history'
    );
    return res.data;
  }

  // ---- Dashboard / Admin ----

  async getAdminStats(): Promise<AdminStats> {
    const res: AxiosResponse<AdminStats> = await this.instance.get('/dashboard/admin');
    return res.data;
  }

  async getUserDashboard(): Promise<UserDashboard> {
    const res: AxiosResponse<UserDashboard> = await this.instance.get('/dashboard/user');
    return res.data;
  }

  // ---- Users (admin) ----

  async listAllUsers(): Promise<User[]> {
    const res: AxiosResponse<User[]> = await this.instance.get('/users');
    return res.data;
  }

  async updateUserPlan(userId: number, planId: number): Promise<User> {
    const res: AxiosResponse<User> = await this.instance.put(`/users/${userId}/plan`, { planId });
    return res.data;
  }
}

const apiClient = new ApiClient();
export default apiClient;
