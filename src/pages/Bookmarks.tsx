import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import type { Post } from '../types';
import './Profile.css';

export default function Bookmarks() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/bookmarks').then(r => setPosts((r.data.posts || []).map(mapServerPost))).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>Bookmarks</h2>
      </div>
      {loading ? <div className="loading-spinner">Loading...</div>
        : posts.length === 0 ? <div className="profile-empty">No bookmarks yet</div>
        : <div className="profile-posts-list">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>}
    </div>
  );
}
