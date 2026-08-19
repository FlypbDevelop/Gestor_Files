import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AuthResponse,
  User,
  Plan,
  File,
  FilePermissions,
  FileWithDownloadsRemaining,
  DownloadHistoryEntry,
  AdminStats,
  UserDashboard,
  CreditTransaction,
  ApiRequestError,
  MostDownloadedFile,
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
    const res: AxiosResponse<{ user: User }> = await this.instance.get('/auth/me');
    return res.data.user;
  }

  // ---- Files ----

  async listFiles(): Promise<FileWithDownloadsRemaining[]> {
    const res: AxiosResponse<FileWithDownloadsRemaining[]> = await this.instance.get('/files/my');
    return res.data;
  }

  async listAllFiles(): Promise<File[]> {
    const res: AxiosResponse<{ files: File[] }> = await this.instance.get('/files');
    return res.data.files;
  }

  async uploadFile(
    file: globalThis.File,
    permissions: FilePermissions & { customName?: string; description?: string; version?: string }
  ): Promise<File> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('allowedPlanIds', JSON.stringify(permissions.allowedPlanIds));
    if (permissions.maxDownloadsPerUser !== null && permissions.maxDownloadsPerUser !== undefined) {
      formData.append('maxDownloadsPerUser', String(permissions.maxDownloadsPerUser));
    }
    if (permissions.creditCost !== null && permissions.creditCost !== undefined) {
      formData.append('creditCost', String(permissions.creditCost));
    }
    if (permissions.customName) formData.append('customName', permissions.customName);
    if (permissions.description) formData.append('description', permissions.description);
    if (permissions.version) formData.append('version', permissions.version);
    const res: AxiosResponse<{ file: File }> = await this.instance.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.file;
  }

  async updateFilePermissions(fileId: number, permissions: FilePermissions): Promise<File> {
    const res: AxiosResponse<{ file: File }> = await this.instance.put(
      `/files/${fileId}/permissions`,
      permissions
    );
    return res.data.file;
  }

  // ---- Credits (admin) ----

  async grantCredits(userId: number, amount: number): Promise<User> {
    const res: AxiosResponse<{ user: User }> = await this.instance.post(
      `/users/${userId}/credits`,
      { amount }
    );
    return res.data.user;
  }

  async updatePlanMultiplier(planId: number, multiplier: number): Promise<Plan> {
    const res: AxiosResponse<{ plan: Plan }> = await this.instance.put(
      `/plans/${planId}/multiplier`,
      { multiplier }
    );
    return res.data.plan;
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
    const res: AxiosResponse<{
      stats: { totalUsers: number; totalFiles: number; totalDownloads: number };
      mostDownloadedFiles: MostDownloadedFile[];
      userDistributionByPlan: { plan_name: string; user_count: number }[];
    }> = await this.instance.get('/dashboard/admin');
    const { stats, mostDownloadedFiles, userDistributionByPlan } = res.data;
    return {
      totalUsers: stats.totalUsers,
      totalFiles: stats.totalFiles,
      totalDownloads: stats.totalDownloads,
      mostDownloadedFiles,
      usersByPlan: userDistributionByPlan.map((p) => ({
        plan_name: p.plan_name,
        user_count: p.user_count,
      })),
    };
  }

  async getUserDashboard(): Promise<UserDashboard> {
    const res: AxiosResponse<{
      currentPlan: { id: number; name: string; price: number; features: unknown };
      downloadHistory: DownloadHistoryEntry[];
      totalDownloads: number;
      credits: number;
      creditTransactions: CreditTransaction[];
    }> = await this.instance.get('/dashboard/user');
    const { currentPlan, downloadHistory, totalDownloads, credits, creditTransactions } = res.data;
    return {
      plan: currentPlan as unknown as Plan,
      downloadHistory,
      totalDownloads,
      credits,
      creditTransactions,
    };
  }

  // ---- Users (admin) ----

  async listAllUsers(): Promise<User[]> {
    const res: AxiosResponse<{ users: User[] }> = await this.instance.get('/users');
    return res.data.users;
  }

  async updateUserPlan(userId: number, planId: number): Promise<User> {
    const res: AxiosResponse<{ user: User }> = await this.instance.put(`/users/${userId}/plan`, { planId });
    return res.data.user;
  }

  // ---- Plans ----

  async listPlans(): Promise<Plan[]> {
    const res: AxiosResponse<Plan[]> = await this.instance.get('/plans');
    return res.data;
  }

  // ---- Credits (user purchase) ----

  async listCreditPackages(): Promise<CreditPackage[]> {
    const res: AxiosResponse<CreditPackage[]> = await this.instance.get('/credits/packages');
    return res.data;
  }

  async purchaseCredits(packageId: number): Promise<{ message: string; payment: SimulatedPayment; package: CreditPackage; user: User }> {
    const res = await this.instance.post('/credits/purchase', { packageId });
    return res.data;
  }
}

const apiClient = new ApiClient();
export default apiClient;
