import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Home from './pages/Home';
import type { User } from './types';
import './App.css';

function App() {
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

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user');
      }
    }
    const savedToken = localStorage.getItem('humanToken');
    if (savedToken) setHumanToken(savedToken);
  }, []);

  if (!currentUser) {
    return <Auth onAuth={handleAuth} initialHumanToken={humanToken} />;
  }

  return <Home currentUser={currentUser} onLogout={handleLogout} />;
}

export default App;
