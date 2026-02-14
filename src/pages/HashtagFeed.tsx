import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import type { Post } from '../types';
import './HashtagFeed.css';

export default function HashtagFeed() {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tag) return;
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/hashtags/${encodeURIComponent(tag)}/posts`);
        setPosts((res.data.posts || res.data || []).map(mapServerPost));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [tag]);

  return (
    <div className="hashtag-feed-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Hashtag</h2>
      </div>

      <div className="hashtag-header">
        <span className="hashtag-title">#{tag}</span>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : posts.length === 0 ? (
        <div className="hashtag-empty">No posts with #{tag} yet</div>
      ) : (
        <div className="hashtag-posts-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onComment={() => navigate(`/post/${post.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
