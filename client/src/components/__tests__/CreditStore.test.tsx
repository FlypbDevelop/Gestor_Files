/**
 * Unit tests for CreditStore component (Phase 2 - Credit Purchase)
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreditStore from '../user/CreditStore';

// Mock the apiClient module
vi.mock('../../services/apiClient', () => ({
  default: {
    listCreditPackages: vi.fn(),
    purchaseCredits: vi.fn(),
  },
}));

import apiClient from '../../services/apiClient';

const mockListCreditPackages = vi.mocked(apiClient.listCreditPackages);
const mockPurchaseCredits = vi.mocked(apiClient.purchaseCredits);

const mockPackages = [
  { id: 1, name: 'Starter', credits: 10, price: 9.9 },
  { id: 2, name: 'Pro', credits: 50, price: 39.9 },
  { id: 3, name: 'Premium', credits: 100, price: 69.9 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListCreditPackages.mockResolvedValue(mockPackages);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreditStore', () => {
  const onCreditsUpdated = vi.fn();

  it('renders loading state initially', () => {
    mockListCreditPackages.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    expect(screen.getByText('Carregando pacotes...')).toBeDefined();
  });

  it('renders credit packages after loading', async () => {
    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
      expect(screen.getByText('Pro')).toBeDefined();
      expect(screen.getByText('Premium')).toBeDefined();
    });
  });

  it('shows credit amounts and prices', async () => {
    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
    });
    // Prices with 2 decimal places
    expect(screen.getByText('R$ 9.90')).toBeDefined();
    expect(screen.getByText('R$ 39.90')).toBeDefined();
    expect(screen.getByText('R$ 69.90')).toBeDefined();
    // Credit amounts
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
  });

  it('calls purchaseCredits when Buy button is clicked', async () => {
    mockPurchaseCredits.mockResolvedValue({
      message: 'Compra de 10 créditos realizada com sucesso',
      payment: { id: 'sim_123', status: 'approved', amount: 9.9, currency: 'BRL', method: 'simulated' },
      package: mockPackages[0],
      user: { credits: 10 },
    });

    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
    });

    const buyButtons = screen.getAllByText('Comprar');
    fireEvent.click(buyButtons[0]);

    expect(mockPurchaseCredits).toHaveBeenCalledWith(1);
    await waitFor(() => {
      expect(onCreditsUpdated).toHaveBeenCalledWith(10);
    });
  });

  it('does not purchase when user cancels confirmation', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
    });

    const buyButtons = screen.getAllByText('Comprar');
    fireEvent.click(buyButtons[0]);

    expect(mockPurchaseCredits).not.toHaveBeenCalled();
    expect(onCreditsUpdated).not.toHaveBeenCalled();
  });

  it('shows error message when purchase fails', async () => {
    mockPurchaseCredits.mockRejectedValue(new Error('Network error'));

    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
    });

    const buyButtons = screen.getAllByText('Comprar');
    fireEvent.click(buyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Erro ao processar compra. Tente novamente.')).toBeDefined();
    });
  });

  it('shows message when no packages available', async () => {
    mockListCreditPackages.mockResolvedValue([]);
    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum pacote disponível no momento.')).toBeDefined();
    });
  });

  it('shows simulated checkout notice', async () => {
    render(<CreditStore onCreditsUpdated={onCreditsUpdated} />);
    await waitFor(() => {
      expect(screen.getByText(/Checkout simulado/)).toBeDefined();
    });
  });
});
