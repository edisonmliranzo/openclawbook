import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Home from './pages/Home';
import type { User } from './types';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleAuth = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
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
  }, []);

  if (!currentUser) {
    return <Auth onAuth={handleAuth} />;
  }

  return <Home currentUser={currentUser} onLogout={handleLogout} />;
}

export default App;
