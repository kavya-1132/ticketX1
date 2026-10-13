import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ticketx_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ticketx_token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Re-verify token on mount if present
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ticketx_token');
      if (storedToken) {
        try {
          const res = await getMe();
          setUser(res.user);
          localStorage.setItem('ticketx_user', JSON.stringify(res.user));
        } catch (err) {
          // Token invalid or user blocked
          localStorage.removeItem('ticketx_token');
          localStorage.removeItem('ticketx_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    setError(null);
    try {
      const data = await loginUser(credentials);
      localStorage.setItem('ticketx_token', data.token);
      localStorage.setItem('ticketx_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const data = await registerUser(userData);
      localStorage.setItem('ticketx_token', data.token);
      localStorage.setItem('ticketx_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem('ticketx_token');
    localStorage.removeItem('ticketx_user');
    setToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'admin',
        isOrganiser: user?.role === 'organiser' || user?.role === 'admin',
        isCustomer: user?.role === 'customer',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
