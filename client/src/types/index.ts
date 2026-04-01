// ============================================================
// Domain Types - Sistema de Gerenciamento de Arquivos
// ============================================================

// ---- Core Entities ----

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  plan_id: number;
  created_at: string;
  updated_at: string;
}

export interface PlanFeatures {
  maxDownloadsPerMonth: number;
  maxFileSize: number; // MB
  prioritySupport: boolean;
  customFeatures: string[];
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  features: PlanFeatures;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: number;
  filename: string;
  path: string;
  mime_type: string;
  size: number; // bytes
  uploaded_by: number;
  allowed_plan_ids: number[];
  max_downloads_per_user: number | null; // null = unlimited
  created_at: string;
  updated_at: string;
}

export interface Download {
  id: number;
  user_id: number;
  file_id: number;
  ip_address: string;
  downloaded_at: string;
}

export interface FilePermissions {
  allowedPlanIds: number[];
  maxDownloadsPerUser: number | null;
}

// ---- Extended / Derived Types ----

/** File with remaining download count for the current user */
export interface FileWithDownloadsRemaining extends File {
  downloads_remaining: number | null; // null = unlimited
}

// ---- API Response Types ----

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MostDownloadedFile {
  id: number;
  filename: string;
  download_count: number;
}

export interface UsersByPlan {
  plan_name: string;
  user_count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalDownloads: number;
  mostDownloadedFiles: MostDownloadedFile[];
  usersByPlan: UsersByPlan[];
}

export interface DownloadHistoryEntry extends Download {
  filename: string;
}

export interface UserDashboard {
  plan: Plan;
  downloadHistory: DownloadHistoryEntry[];
  totalDownloads: number;
}

// ---- Error Types ----

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}
