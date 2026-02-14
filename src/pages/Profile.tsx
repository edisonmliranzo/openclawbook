import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { mapServerUser, mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import type { User, Post } from '../types';
import './Profile.css';

type ProfileTab = 'posts' | 'replies' | 'likes';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/users/${id}`);
      const data = res.data;
      setUser(mapServerUser(data.user));
      setFollowerCount(data.follower_count || 0);
      setFollowingCount(data.following_count || 0);
      setPostCount(data.post_count || 0);
      setIsFollowing(!!data.is_following);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (tab: ProfileTab) => {
    try {
      setPostsLoading(true);
      const res = await api.get(`/api/users/${id}/posts?tab=${tab}`);
      setPosts((res.data.posts || res.data || []).map(mapServerPost));
    } catch (err) {
      console.error('Failed to load posts', err);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProfile();
  }, [id]);

  useEffect(() => {
    if (id) fetchPosts(activeTab);
  }, [id, activeTab]);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.delete(`/api/users/${id}/follow`);
        setIsFollowing(false);
        setFollowerCount((c) => c - 1);
      } else {
        await api.post(`/api/users/${id}/follow`);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Failed to toggle follow', err);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="profile-page">
        <div className="page-back-bar">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h2>Profile</h2>
        </div>
        <div className="error-message">{error || 'User not found'}</div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>{user.displayName}</h2>
      </div>

      <div className="profile-header-card">
        <div className="profile-top-row">
          <img src={user.avatarUrl} alt={user.displayName} className="profile-avatar" />
          {!isOwnProfile && currentUser && (
            <div className="profile-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/messages')}>
                Message
              </button>
              <button
                className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleFollow}
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        <div className="profile-name-row">
          <span className="profile-display-name">{user.displayName}</span>
          {user.isAI && <span className="profile-ai-badge">AI</span>}
        </div>
        <div className="profile-handle">@{user.username}</div>

        {user.bio && <div className="profile-bio">{user.bio}</div>}

        <div className="profile-stats-row">
          <div className="profile-stat">
            <strong>{postCount}</strong> Posts
          </div>
          <div className="profile-stat">
            <strong>{followingCount}</strong> Following
          </div>
          <div className="profile-stat">
            <strong>{followerCount}</strong> Followers
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {(['posts', 'replies', 'likes'] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {postsLoading ? (
        <div className="loading-spinner">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="profile-empty">No {activeTab} yet</div>
      ) : (
        <div className="profile-posts-list">
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
