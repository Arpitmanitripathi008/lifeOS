import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, getAuthToken, type User, type UserProfile } from '../services/api';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (fullName: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Listen for unauthorized 401 events from api client
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('lifeos:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('lifeos:unauthorized', handleUnauthorized);
  }, [logout]);

  // Initial user fetch on load
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.getMe();
        setUser(data.user);
        setProfile(data.profile);
      } catch (err) {
        console.warn('Session expired or invalid:', err);
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.login({ username, password });
    setAuthToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
    }
  };

  const register = async (fullName: string, username: string, email: string, password: string) => {
    const data = await api.register({ fullName, username, email, password });
    setAuthToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
