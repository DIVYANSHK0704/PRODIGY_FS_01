import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [token,   setToken]   = useState(() => sessionStorage.getItem('accessToken'));
  const navigate              = useNavigate();
  const channelRef            = useRef(null);

  // FIX #4: listen for redirect events dispatched by api.js interceptor
  //         so we use React Router navigate() instead of window.location.href
  useEffect(() => {
    const handleRedirect = (e) => navigate(e.detail.to, { replace: true });
    window.addEventListener('auth:redirect', handleRedirect);
    return () => window.removeEventListener('auth:redirect', handleRedirect);
  }, [navigate]);

  // FIX #6: BroadcastChannel with try/catch fallback for unsupported browsers
  useEffect(() => {
    let channel = null;
    try {
      channel = new BroadcastChannel('auth_channel');
      channelRef.current = channel;
      channel.onmessage = (e) => {
        if (e.data === 'logout') {
          sessionStorage.removeItem('accessToken');
          setToken(null);
          setUser(null);
        }
        if (e.data === 'login') {
          loadUser();
        }
      };
    } catch {
      // BroadcastChannel not supported (e.g. older Safari) — graceful degradation
      console.warn('BroadcastChannel not supported; cross-tab sync disabled.');
    }

    const handleLogout = () => { setToken(null); setUser(null); };
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      channel?.close();
      window.removeEventListener('auth:logout', handleLogout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUser = useCallback(async () => {
    const storedToken = sessionStorage.getItem('accessToken');
    if (!storedToken) { setLoading(false); return; }
    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
    } catch {
      sessionStorage.removeItem('accessToken');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    sessionStorage.setItem('accessToken', data.token);
    setToken(data.token);
    setUser(data.user);
    channelRef.current?.postMessage('login');
    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    if (data.token) {
      sessionStorage.setItem('accessToken', data.token);
      setToken(data.token);
      setUser(data.user);
      channelRef.current?.postMessage('login');
    }
    return data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { /* best-effort */ }
    sessionStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
    channelRef.current?.postMessage('logout');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
