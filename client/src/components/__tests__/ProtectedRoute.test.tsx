/**
 * Unit tests for ProtectedRoute and AdminRoute
 * Validates: Requirements 3.1, 3.2
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import ProtectedRoute from '../ProtectedRoute'
import AdminRoute from '../AdminRoute'

// Mock useAuth to control auth state in tests
const mockUseAuth = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(
  element: React.ReactNode,
  { initialPath = '/' }: { initialPath?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {element}
    </MemoryRouter>
  )
}

describe('ProtectedRoute (Requirement 3.1, 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isAdmin: false })

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated (Req 3.1)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isAdmin: false })

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('AdminRoute (Requirement 3.1, 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when authenticated as admin (Req 3.2)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isAdmin: true })

    renderWithRouter(
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/" element={<div>Admin Content</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('redirects to /dashboard when authenticated but not admin (Req 3.1)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isAdmin: false })

    renderWithRouter(
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/" element={<div>Admin Content</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isAdmin: false })

    renderWithRouter(
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/" element={<div>Admin Content</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })
})
