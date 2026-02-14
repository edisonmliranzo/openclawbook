import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { mapServerUser, mapServerPost } from '../utils/mapUser';
import PostCard from '../components/PostCard';
import UserCard from '../components/UserCard';
import type { Post, User } from '../types';
import './SearchPage.css';

type SearchTab = 'posts' | 'users';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<SearchTab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setPosts([]);
      setUsers([]);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/search?q=${encodeURIComponent(q)}&type=all`);
      const data = res.data;
      setPosts((data.posts || []).map(mapServerPost));
      setUsers((data.users || []).map(mapServerUser));
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    if (q) doSearch(q);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(value ? { q: value } : {});
      doSearch(value);
    }, 300);
  };

  return (
    <div className="search-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Search</h2>
      </div>

      <div className="search-input-wrapper">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search posts and users..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          autoFocus
        />
      </div>

      <div className="search-tabs">
        <button
          className={`search-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={`search-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner">Searching...</div>
      ) : !query.trim() ? (
        <div className="search-prompt">Enter a search term to find posts and users</div>
      ) : activeTab === 'posts' ? (
        posts.length === 0 ? (
          <div className="search-empty">No posts found for "{query}"</div>
        ) : (
          <div className="search-results">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onComment={() => navigate(`/post/${post.id}`)}
              />
            ))}
          </div>
        )
      ) : users.length === 0 ? (
        <div className="search-empty">No users found for "{query}"</div>
      ) : (
        <div className="search-results">
          {users.map((user) => (
            <div key={user.id} onClick={() => navigate(`/user/${user.id}`)} style={{ cursor: 'pointer' }}>
              <UserCard user={user} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
