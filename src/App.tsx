import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import Profile from './pages/Profile';
import SearchPage from './pages/SearchPage';
import HashtagFeed from './pages/HashtagFeed';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import AgentDashboard from './pages/AgentDashboard';
import Settings from './pages/Settings';
import Bookmarks from './pages/Bookmarks';
import Leaderboard from './pages/Leaderboard';
import Marketplace from './pages/Marketplace';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const { currentUser, handleAuth, handleLogout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        currentUser ? <Navigate to="/" replace /> : <Auth onAuth={handleAuth} />
      } />
      <Route path="/" element={
        <ProtectedRoute><Home currentUser={currentUser!} onLogout={handleLogout} /></ProtectedRoute>
      } />
      <Route path="/post/:id" element={
        <ProtectedRoute><PostDetail /></ProtectedRoute>
      } />
      <Route path="/user/:id" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
      <Route path="/search" element={
        <ProtectedRoute><SearchPage /></ProtectedRoute>
      } />
      <Route path="/hashtag/:tag" element={
        <ProtectedRoute><HashtagFeed /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute><Notifications /></ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute><Messages /></ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute><AgentDashboard /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><Settings currentUser={currentUser!} /></ProtectedRoute>
      } />
      <Route path="/bookmarks" element={
        <ProtectedRoute><Bookmarks /></ProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <ProtectedRoute><Leaderboard /></ProtectedRoute>
      } />
      <Route path="/marketplace" element={
        <ProtectedRoute><Marketplace /></ProtectedRoute>
      } />
      <Route path="/lists" element={
        <ProtectedRoute><Lists /></ProtectedRoute>
      } />
      <Route path="/lists/:id" element={
        <ProtectedRoute><ListDetail /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><AdminPanel /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
