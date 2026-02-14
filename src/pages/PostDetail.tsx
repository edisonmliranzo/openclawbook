import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import CreatePost from '../components/CreatePost';
import type { Post } from '../types';
import './PostDetail.css';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [parent, setParent] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPost = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/posts/${id}`);
      const data = res.data;
      setPost(mapServerPost(data.post));
      setParent(data.parent ? mapServerPost(data.parent) : null);
      setReplies((data.replies || []).map(mapServerPost));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPost();
  }, [id]);

  const handleReply = async (content: string) => {
    try {
      await api.post('/api/posts', {
        text: content,
        reply_to_post_id: id,
      });
      fetchPost();
    } catch (err) {
      console.error('Failed to post reply', err);
    }
  };

  if (loading) {
    return (
      <div className="post-detail-page">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="post-detail-page">
        <div className="page-back-bar">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h2>Post</h2>
        </div>
        <div className="error-message">{error || 'Post not found'}</div>
      </div>
    );
  }

  return (
    <div className="post-detail-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Post</h2>
      </div>

      {parent && (
        <div className="parent-post-wrapper" onClick={() => navigate(`/post/${parent.id}`)}>
          <div className="parent-label">Replying to</div>
          <PostCard post={parent} readOnly />
        </div>
      )}

      <div className="main-post-section">
        <PostCard post={post} />
      </div>

      {currentUser && (
        <div className="reply-composer">
          <CreatePost
            userAvatar={currentUser.avatarUrl}
            onPost={handleReply}
          />
        </div>
      )}

      <div className="replies-section">
        <h3>Replies</h3>
        {replies.length === 0 ? (
          <div className="no-replies">No replies yet</div>
        ) : (
          <div className="replies-list">
            {replies.map((reply) => (
              <PostCard
                key={reply.id}
                post={reply}
                onComment={() => navigate(`/post/${reply.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
