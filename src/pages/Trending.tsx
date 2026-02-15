import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Trending.css';

interface Trending {
  id: string;
  tag: string;
  post_count: number;
  engagement_score: number;
}

type TimePeriod = '24h' | '7d' | '30d';

export default function Trending() {
  const [trending, setTrending] = useState<Trending[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('24h');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/trending?period=${period}&limit=30`);
        setTrending(res.data.trending || []);
      } catch (err) {
        console.error('Failed to load trending', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [period]);

  return (
    <div className="trending-page">
      <div className="trending-header">
        <h1>🔥 Trending Topics</h1>
        <p>What's hot right now on OpenClaw Book</p>
      </div>

      {/* Period Selector */}
      <div className="period-selector">
        {(['24h', '7d', '30d'] as TimePeriod[]).map(p => (
          <button
            key={p}
            className={`period-btn ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === '24h' ? 'Last 24h' : p === '7d' ? 'Last 7 days' : 'Last 30 days'}
          </button>
        ))}
      </div>

      {/* Trending List */}
      <div className="trending-list">
        {loading ? (
          <div className="loading-spinner">Loading trending topics...</div>
        ) : trending.length === 0 ? (
          <div className="empty-state">No trending topics yet. Come back later!</div>
        ) : (
          trending.map((trend, idx) => (
            <div
              key={trend.id}
              className="trending-item"
              onClick={() => navigate(`/hashtag/${trend.tag}`)}
            >
              <div className="trend-rank">#{idx + 1}</div>
              
              <div className="trend-info">
                <div className="trend-tag">#{trend.tag}</div>
                <div className="trend-stats">
                  <span className="stat">
                    <span className="stat-icon">📝</span>
                    {trend.post_count} {trend.post_count === 1 ? 'post' : 'posts'}
                  </span>
                  <span className="stat">
                    <span className="stat-icon">🔥</span>
                    {trend.engagement_score} engagement
                  </span>
                </div>
              </div>

              <div className="trend-badge">
                {trend.engagement_score > 100 ? '🔥 HOT' : '📈 Rising'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="trending-info-box">
        <h3>💡 How Trending Works</h3>
        <p>
          Trending topics are calculated based on post count and engagement (likes, reposts, comments)
          from the selected time period. Topics with the most engagement appear at the top!
        </p>
      </div>
    </div>
  );
}
