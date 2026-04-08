/**
 * Testes unitários para componentes admin: FileUpload, FileManagement, AdminDashboard, UserManagement
 * Valida: Requisitos 4.1, 5.1, 5.2, 11.1, 11.2, 11.4, 12.1, 12.2, 12.3
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FileUpload from '../admin/FileUpload';
import FileManagement from '../admin/FileManagement';
import AdminDashboard from '../admin/AdminDashboard';
import UserManagement from '../admin/UserManagement';
import {
  ApiRequestError,
  FileWithDownloadsRemaining,
  Plan,
  AdminStats,
  User,
} from '../../types';

// Mock único consolidado do apiClient
vi.mock('../../services/apiClient', () => ({
  default: {
    uploadFile: vi.fn(),
    listFiles: vi.fn(),
    updateFilePermissions: vi.fn(),
    deleteFile: vi.fn(),
    getAdminStats: vi.fn(),
    listAllUsers: vi.fn(),
    listPlans: vi.fn(),
    updateUserPlan: vi.fn(),
  },
}));

import apiClient from '../../services/apiClient';

const mockUploadFile = vi.mocked(apiClient.uploadFile);
const mockListFiles = vi.mocked(apiClient.listFiles);
const mockUpdateFilePermissions = vi.mocked(apiClient.updateFilePermissions);
const mockDeleteFile = vi.mocked(apiClient.deleteFile);
const mockGetAdminStats = vi.mocked(apiClient.getAdminStats);
const mockListAllUsers = vi.mocked(apiClient.listAllUsers);
const mockListPlans = vi.mocked(apiClient.listPlans);
const mockUpdateUserPlan = vi.mocked(apiClient.updateUserPlan);

// ---- Fixtures compartilhados ----

const samplePlans: Plan[] = [
  {
    id: 1,
    name: 'Básico',
    price: 0,
    features: { maxDownloadsPerMonth: 5, maxFileSize: 10, prioritySupport: false, customFeatures: [] },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Premium',
    price: 29.9,
    features: { maxDownloadsPerMonth: 100, maxFileSize: 100, prioritySupport: true, customFeatures: [] },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const sampleFiles: FileWithDownloadsRemaining[] = [
  {
    id: 1,
    filename: 'relatorio.pdf',
    path: '/uploads/relatorio.pdf',
    mime_type: 'application/pdf',
    size: 1024 * 512,
    uploaded_by: 1,
    allowed_plan_ids: [1, 2],
    max_downloads_per_user: 5,
    downloads_remaining: 3,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 2,
    filename: 'imagem.png',
    path: '/uploads/imagem.png',
    mime_type: 'image/png',
    size: 1024 * 1024,
    uploaded_by: 1,
    allowed_plan_ids: [2],
    max_downloads_per_user: null,
    downloads_remaining: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const sampleUsers: User[] = [
  {
    id: 1,
    name: 'Alice Silva',
    email: 'alice@example.com',
    role: 'USER',
    plan_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Bob Admin',
    email: 'bob@example.com',
    role: 'ADMIN',
    plan_id: 3,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

const sampleStats: AdminStats = {
  totalUsers: 42,
  totalFiles: 15,
  totalDownloads: 300,
  mostDownloadedFiles: [
    { id: 1, filename: 'relatorio.pdf', download_count: 120 },
    { id: 2, filename: 'imagem.png', download_count: 80 },
  ],
  usersByPlan: [
    { plan_name: 'Free', user_count: 30 },
    { plan_name: 'Premium', user_count: 12 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ============================================================
// FileUpload component — Requisitos 4.1, 5.1, 5.2
// ============================================================

describe('FileUpload component', () => {
  it('renders file input, plan checkboxes, max downloads field and submit button', () => {
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText('Básico')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ilimitado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar arquivo/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting without selecting a file', async () => {
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    expect(await screen.findByText('Selecione um arquivo para enviar.')).toBeInTheDocument();
  });

  it('shows validation error when no plan is selected', async () => {
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    expect(await screen.findByText('Selecione pelo menos um plano.')).toBeInTheDocument();
  });

  it('shows validation error when max downloads is not a positive integer', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    const maxInput = screen.getByPlaceholderText(/ilimitado/i);
    fireEvent.change(maxInput, { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText((content) => content.includes('inteiro positivo'))).toBeInTheDocument();
    expect(mockUpdateFilePermissions).not.toHaveBeenCalled();
  });

  it('toggles plan checkboxes correctly (Req 5.1)', () => {
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const basicCheckbox = screen.getByLabelText('Básico') as HTMLInputElement;
    const premiumCheckbox = screen.getByLabelText('Premium') as HTMLInputElement;
    expect(basicCheckbox.checked).toBe(false);
    fireEvent.click(basicCheckbox);
    expect(basicCheckbox.checked).toBe(true);
    fireEvent.click(premiumCheckbox);
    expect(premiumCheckbox.checked).toBe(true);
    fireEvent.click(basicCheckbox);
    expect(basicCheckbox.checked).toBe(false);
    expect(premiumCheckbox.checked).toBe(true);
  });

  it('calls apiClient.uploadFile with correct args on valid submit (Req 4.1)', async () => {
    const uploadedFile = { ...sampleFiles[0] };
    mockUploadFile.mockResolvedValue(uploadedFile);
    const onUploadComplete = vi.fn();
    render(<FileUpload plans={samplePlans} onUploadComplete={onUploadComplete} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'relatorio.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByLabelText('Básico'));
    fireEvent.click(screen.getByLabelText('Premium'));
    fireEvent.change(screen.getByPlaceholderText(/ilimitado/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledWith(file, { allowedPlanIds: [1, 2], maxDownloadsPerUser: 5 }));
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(uploadedFile));
  });

  it('shows success message after upload and resets form (Req 4.1)', async () => {
    mockUploadFile.mockResolvedValue(sampleFiles[0]);
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'relatorio.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByLabelText('Básico'));
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    expect(await screen.findByText(/enviado com sucesso/i)).toBeInTheDocument();
  });

  it('shows error message when upload fails', async () => {
    mockUploadFile.mockRejectedValue(new ApiRequestError('Arquivo muito grande.', 413));
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByLabelText('Básico'));
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    expect(await screen.findByText('Arquivo muito grande.')).toBeInTheDocument();
  });

  it('disables submit button while uploading', async () => {
    let resolve: (v: typeof sampleFiles[0]) => void;
    mockUploadFile.mockReturnValue(new Promise((res) => { resolve = res; }));
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByLabelText('Básico'));
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    expect(await screen.findByRole('button', { name: /enviando/i })).toBeDisabled();
    resolve!(sampleFiles[0]);
  });

  it('accepts null maxDownloadsPerUser when field is left blank (Req 5.2)', async () => {
    mockUploadFile.mockResolvedValue(sampleFiles[1]);
    render(<FileUpload plans={samplePlans} onUploadComplete={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'imagem.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByLabelText('Premium'));
    fireEvent.click(screen.getByRole('button', { name: /enviar arquivo/i }));
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledWith(file, { allowedPlanIds: [2], maxDownloadsPerUser: null }));
  });
});

// ============================================================
// FileManagement component — Requisitos 5.1, 5.2
// ============================================================

describe('FileManagement component', () => {
  it('shows loading state initially', () => {
    mockListFiles.mockReturnValue(new Promise(() => {}));
    render(<FileManagement plans={samplePlans} />);
    expect(screen.getByText(/carregando arquivos/i)).toBeInTheDocument();
  });

  it('shows error when listFiles fails', async () => {
    mockListFiles.mockRejectedValue(new Error('Falha na rede'));
    render(<FileManagement plans={samplePlans} />);
    expect(await screen.findByText('Falha na rede')).toBeInTheDocument();
  });

  it('shows empty state when no files exist', async () => {
    mockListFiles.mockResolvedValue([]);
    render(<FileManagement plans={samplePlans} />);
    expect(await screen.findByText(/nenhum arquivo cadastrado/i)).toBeInTheDocument();
  });

  it('renders file list with filenames and edit/delete buttons', async () => {
    mockListFiles.mockResolvedValue(sampleFiles);
    render(<FileManagement plans={samplePlans} />);
    expect(await screen.findAllByText('relatorio.pdf')).not.toHaveLength(0);
    expect(screen.getAllByText('imagem.png')).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: /excluir/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('opens edit modal when Editar button is clicked', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    expect(screen.getByText('Editar permissões')).toBeInTheDocument();
  });

  it('modal shows plan checkboxes pre-selected based on file permissions (Req 5.1)', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    const basicCheckbox = screen.getByLabelText('Básico') as HTMLInputElement;
    const premiumCheckbox = screen.getByLabelText('Premium') as HTMLInputElement;
    expect(basicCheckbox.checked).toBe(true);
    expect(premiumCheckbox.checked).toBe(true);
  });

  it('modal shows max downloads pre-filled (Req 5.2)', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    const maxInput = screen.getByPlaceholderText(/ilimitado/i) as HTMLInputElement;
    expect(maxInput.value).toBe('5');
  });

  it('closes modal when Cancelar is clicked', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    expect(screen.getByText('Editar permissões')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByText('Editar permissões')).not.toBeInTheDocument();
  });

  it('shows validation error when saving with no plans selected (Req 5.1)', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    fireEvent.click(screen.getByLabelText('Básico'));
    fireEvent.click(screen.getByLabelText('Premium'));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText('Selecione pelo menos um plano.')).toBeInTheDocument();
  });

  it('calls updateFilePermissions with correct args on save (Req 5.1, 5.2)', async () => {
    const updatedFile = { ...sampleFiles[0], allowed_plan_ids: [2], max_downloads_per_user: 10 };
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockUpdateFilePermissions.mockResolvedValue(updatedFile);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    fireEvent.click(screen.getByLabelText('Básico'));
    const maxInput = screen.getByPlaceholderText(/ilimitado/i);
    fireEvent.change(maxInput, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(mockUpdateFilePermissions).toHaveBeenCalledWith(1, { allowedPlanIds: [2], maxDownloadsPerUser: 10 }));
    await waitFor(() => expect(screen.queryByText('Editar permissões')).not.toBeInTheDocument());
  });

  it('shows error in modal when updateFilePermissions fails', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockUpdateFilePermissions.mockRejectedValue(new ApiRequestError('Permissão negada.', 403));
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText('Permissão negada.')).toBeInTheDocument();
  });

  it('saves with null maxDownloadsPerUser when field is blank (Req 5.2)', async () => {
    const updatedFile = { ...sampleFiles[0], max_downloads_per_user: null };
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockUpdateFilePermissions.mockResolvedValue(updatedFile);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    const maxInput = screen.getByPlaceholderText(/ilimitado/i);
    fireEvent.change(maxInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(mockUpdateFilePermissions).toHaveBeenCalledWith(1, { allowedPlanIds: [1, 2], maxDownloadsPerUser: null }));
  });

  it('calls deleteFile and removes file from list after confirmation', async () => {
    mockListFiles.mockResolvedValue([...sampleFiles]);
    mockDeleteFile.mockResolvedValue(undefined);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockDeleteFile).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryAllByText('relatorio.pdf')).toHaveLength(0));
  });

  it('does not call deleteFile when user cancels confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(screen.getAllByText('relatorio.pdf')).not.toHaveLength(0);
  });

  it('shows error message when deleteFile fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockDeleteFile.mockRejectedValue(new ApiRequestError('Erro ao excluir arquivo.', 500));
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    expect(await screen.findAllByText('Erro ao excluir arquivo.')).not.toHaveLength(0);
  });

  it('disables delete button while deletion is in progress', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let resolve: () => void;
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockDeleteFile.mockReturnValue(new Promise<void>((res) => { resolve = res; }));
    render(<FileManagement plans={samplePlans} />);
    await screen.findAllByText('relatorio.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    expect(await screen.findAllByRole('button', { name: /excluindo/i })).not.toHaveLength(0);
    const disabledButtons = screen.getAllByRole('button', { name: /excluindo/i });
    disabledButtons.forEach((btn) => expect(btn).toBeDisabled());
    resolve!();
    await waitFor(() => expect(mockDeleteFile).toHaveBeenCalled());
  });
});

// ============================================================
// AdminDashboard component — Requisitos 12.1, 12.2, 12.3
// ============================================================

describe('AdminDashboard component', () => {
  it('shows loading state initially (Req 12.1)', () => {
    mockGetAdminStats.mockReturnValue(new Promise(() => {}));
    render(<AdminDashboard />);
    expect(screen.getByText(/carregando estatísticas/i)).toBeInTheDocument();
  });

  it('shows error when getAdminStats fails', async () => {
    mockGetAdminStats.mockRejectedValue(new ApiRequestError('Acesso negado.', 403));
    render(<AdminDashboard />);
    expect(await screen.findByText('Acesso negado.')).toBeInTheDocument();
  });

  it('displays total users, files and downloads cards (Req 12.1)', async () => {
    mockGetAdminStats.mockResolvedValue(sampleStats);
    render(<AdminDashboard />);
    expect(await screen.findByText('Total de Usuários')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total de Arquivos')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Total de Downloads')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('displays most downloaded files table (Req 12.2)', async () => {
    mockGetAdminStats.mockResolvedValue(sampleStats);
    render(<AdminDashboard />);
    expect(await screen.findByText('Arquivos mais baixados')).toBeInTheDocument();
    expect(screen.getAllByText('relatorio.pdf').length).toBeGreaterThan(0);
    expect(screen.getAllByText('imagem.png').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    expect(screen.getAllByText('80').length).toBeGreaterThan(0);
  });

  it('displays user distribution by plan (Req 12.3)', async () => {
    mockGetAdminStats.mockResolvedValue(sampleStats);
    render(<AdminDashboard />);
    expect(await screen.findByText('Distribuição por plano')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText(/30 usuários/i)).toBeInTheDocument();
    expect(screen.getByText(/12 usuários/i)).toBeInTheDocument();
  });

  it('shows empty state when no downloads exist (Req 12.2)', async () => {
    mockGetAdminStats.mockResolvedValue({ ...sampleStats, mostDownloadedFiles: [] });
    render(<AdminDashboard />);
    expect(await screen.findByText(/nenhum download registrado/i)).toBeInTheDocument();
  });

  it('shows empty state when no plan data exists (Req 12.3)', async () => {
    mockGetAdminStats.mockResolvedValue({ ...sampleStats, usersByPlan: [] });
    render(<AdminDashboard />);
    expect(await screen.findByText(/nenhum dado de plano disponível/i)).toBeInTheDocument();
  });
});

// ============================================================
// UserManagement component — Requisitos 11.1, 11.2, 11.4
// ============================================================

describe('UserManagement component', () => {
  it('exibe estado de carregamento inicialmente', () => {
    mockListAllUsers.mockReturnValue(new Promise(() => {}));
    mockListPlans.mockReturnValue(new Promise(() => {}));
    render(<UserManagement />);
    expect(screen.getByText(/carregando usuários/i)).toBeInTheDocument();
  });

  it('exibe erro quando listAllUsers falha', async () => {
    mockListAllUsers.mockRejectedValue(new ApiRequestError('Acesso negado.', 403));
    mockListPlans.mockResolvedValue(samplePlans);
    render(<UserManagement />);
    expect(await screen.findByText('Acesso negado.')).toBeInTheDocument();
  });

  it('exibe estado vazio quando não há usuários', async () => {
    mockListAllUsers.mockResolvedValue([]);
    mockListPlans.mockResolvedValue(samplePlans);
    render(<UserManagement />);
    expect(await screen.findByText(/nenhum usuário cadastrado/i)).toBeInTheDocument();
  });

  it('renderiza lista de usuários com nome, email, perfil e plano (Req 11.1)', async () => {
    mockListAllUsers.mockResolvedValue(sampleUsers);
    mockListPlans.mockResolvedValue(samplePlans);
    render(<UserManagement />);
    // Componente renderiza tabela desktop + cards mobile — usar getAllByText
    expect((await screen.findAllByText('Alice Silva')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Usuário').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('exibe dropdown de planos para cada usuário (Req 11.2)', async () => {
    mockListAllUsers.mockResolvedValue(sampleUsers);
    mockListPlans.mockResolvedValue(samplePlans);
    render(<UserManagement />);
    await screen.findAllByText('Alice Silva');
    const selects = screen.getAllByRole('combobox');
    // Desktop + mobile = 2 selects por usuário
    expect(selects.length).toBeGreaterThanOrEqual(sampleUsers.length * 2);
  });

  it('chama updateUserPlan ao alterar dropdown e atualiza lista (Req 11.1, 11.2, 11.4)', async () => {
    const updatedUser: User = { ...sampleUsers[0], plan_id: 2 };
    mockListAllUsers.mockResolvedValue([...sampleUsers]);
    mockListPlans.mockResolvedValue(samplePlans);
    mockUpdateUserPlan.mockResolvedValue(updatedUser);
    render(<UserManagement />);
    await screen.findAllByText('Alice Silva');
    const aliceSelects = screen.getAllByLabelText('Alterar plano de Alice Silva') as HTMLSelectElement[];
    fireEvent.change(aliceSelects[0], { target: { value: '2' } });
    await waitFor(() => expect(mockUpdateUserPlan).toHaveBeenCalledWith(1, 2));
    await waitFor(() => expect(aliceSelects[0].value).toBe('2'));
  });

  it('exibe mensagem de sucesso após alterar plano (Req 11.4)', async () => {
    const updatedUser: User = { ...sampleUsers[0], plan_id: 2 };
    mockListAllUsers.mockResolvedValue([...sampleUsers]);
    mockListPlans.mockResolvedValue(samplePlans);
    mockUpdateUserPlan.mockResolvedValue(updatedUser);
    render(<UserManagement />);
    await screen.findAllByText('Alice Silva');
    const aliceSelects = screen.getAllByLabelText('Alterar plano de Alice Silva');
    fireEvent.change(aliceSelects[0], { target: { value: '2' } });
    expect((await screen.findAllByText(/plano alterado para premium/i)).length).toBeGreaterThan(0);
  });

  it('exibe mensagem de erro quando updateUserPlan falha', async () => {
    mockListAllUsers.mockResolvedValue([...sampleUsers]);
    mockListPlans.mockResolvedValue(samplePlans);
    mockUpdateUserPlan.mockRejectedValue(new ApiRequestError('Plano inválido.', 400));
    render(<UserManagement />);
    await screen.findAllByText('Alice Silva');
    const aliceSelects = screen.getAllByLabelText('Alterar plano de Alice Silva');
    fireEvent.change(aliceSelects[0], { target: { value: '2' } });
    expect((await screen.findAllByText('Plano inválido.')).length).toBeGreaterThan(0);
  });

  it('desabilita dropdown enquanto atualização está em progresso', async () => {
    let resolve: (u: User) => void;
    mockListAllUsers.mockResolvedValue([...sampleUsers]);
    mockListPlans.mockResolvedValue(samplePlans);
    mockUpdateUserPlan.mockReturnValue(new Promise<User>((res) => { resolve = res; }));
    render(<UserManagement />);
    await screen.findAllByText('Alice Silva');
    const aliceSelects = screen.getAllByLabelText('Alterar plano de Alice Silva') as HTMLSelectElement[];
    fireEvent.change(aliceSelects[0], { target: { value: '2' } });
    aliceSelects.forEach((sel) => expect(sel).toBeDisabled());
    resolve!({ ...sampleUsers[0], plan_id: 2 });
    await waitFor(() => aliceSelects.forEach((sel) => expect(sel).not.toBeDisabled()));
  });
});
