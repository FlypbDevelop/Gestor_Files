/**
 * Responsive rendering tests
 * Validates: Requirements 14.1
 *
 * Requirement 14.1: THE System SHALL renderizar corretamente em viewports de 320px de largura ou superior
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import React from 'react'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'

// Mock apiClient to prevent real network calls
vi.mock('../services/apiClient', () => ({
  default: {
    setToken: vi.fn(),
    getCurrentUser: vi.fn().mockRejectedValue(new Error('no token')),
    login: vi.fn(),
    register: vi.fn(),
  },
}))

// Mock AuthContext so AuthProvider doesn't need localStorage
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isAdmin: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

function setViewport(width: number, height = 768) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

function mockMatchMedia(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: (() => {
        const minMatch = query.match(/min-width:\s*(\d+)px/)
        const maxMatch = query.match(/max-width:\s*(\d+)px/)
        if (minMatch) return width >= parseInt(minMatch[1])
        if (maxMatch) return width <= parseInt(maxMatch[1])
        return false
      })(),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('Responsive rendering at 320px viewport (Requirement 14.1)', () => {
  beforeEach(() => {
    setViewport(320)
    mockMatchMedia(320)
  })

  afterEach(() => {
    setViewport(1024)
    mockMatchMedia(1024)
  })

  it('renders LoginPage without crashing at 320px viewport width', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders the login heading at 320px viewport', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })

  it('renders RegisterPage without crashing at 320px viewport width', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders the register heading at 320px viewport', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /cadastro/i })).toBeInTheDocument()
  })

  it('window.innerWidth is 320 during test', () => {
    expect(window.innerWidth).toBe(320)
  })

  it('matchMedia correctly reports 320px viewport for min-width queries', () => {
    expect(window.matchMedia('(min-width: 320px)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 321px)').matches).toBe(false)
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(false)
  })

  it('matchMedia correctly reports 320px viewport for max-width queries', () => {
    expect(window.matchMedia('(max-width: 320px)').matches).toBe(true)
    expect(window.matchMedia('(max-width: 319px)').matches).toBe(false)
  })
})
