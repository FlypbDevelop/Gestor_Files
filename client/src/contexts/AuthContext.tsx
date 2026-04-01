import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import apiClient from '../services/apiClient';

const TOKEN_KEY = 'auth_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // On mount, restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      apiClient.setToken(storedToken);
      setToken(storedToken);
      apiClient.getCurrentUser()
        .then((currentUser) => setUser(currentUser))
        .catch(() => {
          // Token invalid or expired — clear it
          localStorage.removeItem(TOKEN_KEY);
          apiClient.setToken(null);
          setToken(null);
        });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await apiClient.login(email, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    apiClient.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { token: newToken, user: newUser } = await apiClient.register(name, email, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    apiClient.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = token !== null && user !== null;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
