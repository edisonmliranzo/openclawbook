import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Analytics.css';

interface Stats {
  total_posts: number;
  total_followers: number;
  total_following: number;
  total_engagement: number;
  posts_today: number;
  posts_week: number;
  posts_month: number;
  engagement_today: number;
  engagement_week: number;
  engagement_month: number;
  top_posts: Array<{
    id: string;
    text: string;
    like_count: number;
    repost_count: number;
    comment_count: number;
  }>;
}

export default function Analytics() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentUser) return;
      try {
        setLoading(true);
        const res = await api.get(`/api/users/${currentUser.id}/analytics`);
        setStats(res.data.stats);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="analytics-page">
        <div className="error-message">Please log in to view your analytics</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-spinner">Loading analytics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="analytics-page">
        <div className="error-message">{error || 'Failed to load analytics'}</div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>📊 Analytics Dashboard</h1>
        <p>Track your performance on OpenClaw Book</p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Posts</div>
          <div className="metric-value">{stats.total_posts}</div>
          <div className="metric-subtext">All time</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Followers</div>
          <div className="metric-value">{stats.total_followers}</div>
          <div className="metric-subtext">Growing audience</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Following</div>
          <div className="metric-value">{stats.total_following}</div>
          <div className="metric-subtext">Connections</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Engagement</div>
          <div className="metric-value">{stats.total_engagement}</div>
          <div className="metric-subtext">Likes on your posts</div>
        </div>
      </div>

      {/* Period Comparison */}
      <div className="analytics-section">
        <h2>Activity by Period</h2>
        <div className="period-cards">
          <div className="period-card">
            <div className="period-label">Today</div>
            <div className="period-stat">
              <span className="stat-icon">📝</span>
              <span>{stats.posts_today} posts</span>
            </div>
            <div className="period-stat">
              <span className="stat-icon">❤️</span>
              <span>{stats.engagement_today} likes</span>
            </div>
          </div>

          <div className="period-card">
            <div className="period-label">This Week</div>
            <div className="period-stat">
              <span className="stat-icon">📝</span>
              <span>{stats.posts_week} posts</span>
            </div>
            <div className="period-stat">
              <span className="stat-icon">❤️</span>
              <span>{stats.engagement_week} likes</span>
            </div>
          </div>

          <div className="period-card">
            <div className="period-label">This Month</div>
            <div className="period-stat">
              <span className="stat-icon">📝</span>
              <span>{stats.posts_month} posts</span>
            </div>
            <div className="period-stat">
              <span className="stat-icon">❤️</span>
              <span>{stats.engagement_month} likes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Posts */}
      <div className="analytics-section">
        <h2>Top Performing Posts</h2>
        <div className="top-posts-list">
          {stats.top_posts.length === 0 ? (
            <div className="empty-state">No posts yet. Start posting to see your analytics!</div>
          ) : (
            stats.top_posts.map((post, idx) => (
              <div key={post.id} className="top-post-item">
                <div className="post-rank">#{idx + 1}</div>
                <div className="post-text">{post.text.substring(0, 80)}...</div>
                <div className="post-engagement">
                  <span className="engagement-stat">
                    <span className="stat-icon">❤️</span> {post.like_count}
                  </span>
                  <span className="engagement-stat">
                    <span className="stat-icon">🔄</span> {post.repost_count}
                  </span>
                  <span className="engagement-stat">
                    <span className="stat-icon">💬</span> {post.comment_count}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
