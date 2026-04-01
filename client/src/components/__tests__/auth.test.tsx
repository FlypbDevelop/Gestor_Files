/**
 * Unit tests for auth components (Login and Register)
 * Validates: Requirements 1.1, 1.2, 2.1
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Login from '../auth/Login';
import Register from '../auth/Register';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Login component
// ---------------------------------------------------------------------------
describe('Login component', () => {
  it('renders email and password fields and submit button', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('shows error when submitting with empty fields', async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Email e senha são obrigatórios.')).toBeInTheDocument();
  });

  it('shows error when only email is filled', async () => {
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Email e senha são obrigatórios.')).toBeInTheDocument();
  });

  it('shows error when only password is filled', async () => {
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Email e senha são obrigatórios.')).toBeInTheDocument();
  });

  it('calls login with correct credentials on valid submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'secret123'));
  });

  it('navigates to /dashboard after successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('shows error message when login throws', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciais inválidas.'));
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Credenciais inválidas.')).toBeInTheDocument();
  });

  it('disables submit button while loading', async () => {
    let resolve: () => void;
    mockLogin.mockReturnValue(new Promise<void>((res) => { resolve = res; }));
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByRole('button', { name: /entrando/i })).toBeDisabled();
    resolve!();
  });
});

// ---------------------------------------------------------------------------
// Register component
// ---------------------------------------------------------------------------
describe('Register component', () => {
  it('renders name, email, password fields and submit button', () => {
    render(<Register />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('shows error when submitting with all empty fields', async () => {
    render(<Register />);
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText('Todos os campos são obrigatórios.')).toBeInTheDocument();
  });

  it('shows error when password is shorter than 8 characters', async () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'joao@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument();
  });

  it('calls register with correct data on valid submit', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'joao@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith('João', 'joao@example.com', 'senha1234')
    );
  });

  it('navigates to /dashboard after successful register', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'joao@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('shows error message when register throws', async () => {
    mockRegister.mockRejectedValue(new Error('Email já cadastrado.'));
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'joao@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText('Email já cadastrado.')).toBeInTheDocument();
  });

  it('disables submit button while loading', async () => {
    let resolve: () => void;
    mockRegister.mockReturnValue(new Promise<void>((res) => { resolve = res; }));
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'joao@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByRole('button', { name: /criando conta/i })).toBeDisabled();
    resolve!();
  });
});
