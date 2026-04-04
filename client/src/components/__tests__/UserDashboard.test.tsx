/**
 * Testes unitários para o componente UserDashboard
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserDashboard from '../user/UserDashboard';
import { ApiRequestError, UserDashboard as UserDashboardData } from '../../types';

vi.mock('../../services/apiClient', () => ({
  default: {
    getUserDashboard: vi.fn(),
  },
}));

import apiClient from '../../services/apiClient';

const mockGetUserDashboard = vi.mocked(apiClient.getUserDashboard);

const sampleDashboard: UserDashboardData = {
  plan: {
    id: 2,
    name: 'Basic',
    price: 29.9,
    features: {
      maxDownloadsPerMonth: 50,
      maxFileSize: 100,
      prioritySupport: false,
      customFeatures: [],
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  totalDownloads: 7,
  downloadHistory: [
    {
      id: 1,
      user_id: 10,
      file_id: 3,
      filename: 'relatorio.pdf',
      ip_address: '127.0.0.1',
      downloaded_at: '2024-06-15T14:30:00Z',
    },
    {
      id: 2,
      user_id: 10,
      file_id: 5,
      filename: 'imagem.png',
      ip_address: '127.0.0.1',
      downloaded_at: '2024-06-10T09:00:00Z',
    },
    {
      id: 3,
      user_id: 10,
      file_id: 2,
      filename: 'dados.csv',
      ip_address: '127.0.0.1',
      downloaded_at: '2024-06-20T18:45:00Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserDashboard component', () => {
  // ---- Estado de carregamento ----
  it('exibe indicador de carregamento enquanto busca dados', () => {
    mockGetUserDashboard.mockReturnValue(new Promise(() => {}));
    render(<UserDashboard />);
    expect(screen.getByText(/carregando dashboard/i)).toBeInTheDocument();
  });

  // ---- Estado de erro ----
  it('exibe mensagem de erro quando a requisição falha', async () => {
    mockGetUserDashboard.mockRejectedValue(new Error('Falha na rede'));
    render(<UserDashboard />);
    expect(await screen.findByText('Falha na rede')).toBeInTheDocument();
  });

  it('exibe mensagem de erro de ApiRequestError', async () => {
    mockGetUserDashboard.mockRejectedValue(new ApiRequestError('Não autorizado', 401));
    render(<UserDashboard />);
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument();
  });

  // ---- Req 13.2: informações do plano atual ----
  it('exibe o nome do plano atual', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    expect(await screen.findByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Plano atual')).toBeInTheDocument();
  });

  it('exibe preço do plano formatado em PT-BR', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    expect(screen.getByText(/R\$ 29,90\/mês/)).toBeInTheDocument();
  });

  it('exibe "Gratuito" para plano com preço zero', async () => {
    const freeDashboard: UserDashboardData = {
      ...sampleDashboard,
      plan: { ...sampleDashboard.plan, name: 'Free', price: 0 },
    };
    mockGetUserDashboard.mockResolvedValue(freeDashboard);
    render(<UserDashboard />);
    await screen.findByText('Free');
    expect(screen.getByText('Gratuito')).toBeInTheDocument();
  });

  // ---- Req 13.3: total de downloads ----
  it('exibe o total de downloads realizados', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Total de downloads')).toBeInTheDocument();
  });

  // ---- Req 13.4: filename, data e hora no histórico ----
  it('exibe filename de cada download no histórico', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    expect(screen.getAllByText('relatorio.pdf').length).toBeGreaterThan(0);
    expect(screen.getAllByText('imagem.png').length).toBeGreaterThan(0);
    expect(screen.getAllByText('dados.csv').length).toBeGreaterThan(0);
  });

  it('exibe data formatada em PT-BR para cada download', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    // 2024-06-15 → 15/06/2024
    expect(screen.getAllByText('15/06/2024').length).toBeGreaterThan(0);
  });

  it('exibe hora formatada (HH:MM) para cada download (Req 13.4)', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    // Calcula a hora esperada usando o mesmo método do componente (respeita timezone do ambiente)
    const expectedTime = new Date('2024-06-15T14:30:00Z').toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(screen.getAllByText(expectedTime).length).toBeGreaterThan(0);
  });

  it('exibe o cabeçalho "Histórico de downloads" (Req 13.1)', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');
    expect(screen.getByText('Histórico de downloads')).toBeInTheDocument();
  });

  // ---- Req 13.1: ordenação por data descendente ----
  it('ordena o histórico por data descendente (mais recente primeiro)', async () => {
    mockGetUserDashboard.mockResolvedValue(sampleDashboard);
    render(<UserDashboard />);
    await screen.findByText('Basic');

    // dados.csv (20/06) deve aparecer antes de relatorio.pdf (15/06) e imagem.png (10/06)
    const rows = screen.getAllByText(/\.pdf|\.png|\.csv/);
    const filenames = rows.map((el) => el.textContent);
    const dadosIdx = filenames.findIndex((f) => f?.includes('dados.csv'));
    const relatorioIdx = filenames.findIndex((f) => f?.includes('relatorio.pdf'));
    const imagemIdx = filenames.findIndex((f) => f?.includes('imagem.png'));

    expect(dadosIdx).toBeLessThan(relatorioIdx);
    expect(relatorioIdx).toBeLessThan(imagemIdx);
  });

  // ---- Estado vazio ----
  it('exibe mensagem quando não há downloads', async () => {
    mockGetUserDashboard.mockResolvedValue({ ...sampleDashboard, downloadHistory: [], totalDownloads: 0 });
    render(<UserDashboard />);
    await screen.findByText('Basic');
    expect(screen.getByText(/nenhum download realizado/i)).toBeInTheDocument();
  });
});
