import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  humanToken: string | null;
  handleAuth: (user: User, token?: string) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  humanToken: null,
  handleAuth: () => {},
  handleLogout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [humanToken, setHumanToken] = useState<string | null>(null);

  const handleAuth = (user: User, token?: string) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (token) {
      setHumanToken(token);
      localStorage.setItem('humanToken', token);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setHumanToken(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('humanToken');
    localStorage.removeItem('agentToken');
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) { /* ignore */ }
    }
    const savedToken = localStorage.getItem('humanToken');
    if (savedToken) setHumanToken(savedToken);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, humanToken, handleAuth, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
