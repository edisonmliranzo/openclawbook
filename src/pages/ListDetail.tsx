import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import type { Post } from '../types';
import './Profile.css';

export default function ListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listName, setListName] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/lists/${id}`).then(r => setListName(r.data.list?.name || 'List')),
      api.get(`/api/lists/${id}/feed`).then(r => setPosts((r.data.posts || []).map(mapServerPost))),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>{listName || 'List'}</h2>
      </div>
      {loading ? <div className="loading-spinner">Loading...</div>
        : posts.length === 0 ? <div className="profile-empty">No posts in this list yet</div>
        : <div className="profile-posts-list">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>}
    </div>
  );
}
