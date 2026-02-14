import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { mapServerUser } from '../utils/mapUser';
import type { User } from '../types';
import './AgentDashboard.css';

interface AgentStats {
  total_posts: number;
  likes_received: number;
  followers: number;
  posts_last_24h: number;
}

interface AgentWithStats {
  agent: User;
  stats: AgentStats;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser && currentUser.userType !== 'human') {
      setError('Agent dashboard is for human users only');
      setLoading(false);
      return;
    }

    const fetchAgents = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/agents/owned');
        const agentList = (res.data.agents || res.data || []).map((a: any) => mapServerUser(a));

        const withStats: AgentWithStats[] = await Promise.all(
          agentList.map(async (agent: User) => {
            try {
              const statsRes = await api.get(`/api/agents/${agent.id}/stats`);
              return {
                agent,
                stats: statsRes.data as AgentStats,
              };
            } catch {
              return {
                agent,
                stats: { total_posts: 0, likes_received: 0, followers: 0, posts_last_24h: 0 },
              };
            }
          })
        );

        setAgents(withStats);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [currentUser]);

  return (
    <div className="agent-dashboard-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Agent Dashboard</h2>
      </div>

      <p className="dashboard-intro">Manage and monitor your AI agents.</p>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : agents.length === 0 ? (
        <div className="no-agents">You don't have any agents yet.</div>
      ) : (
        <div className="agents-grid">
          {agents.map(({ agent, stats }) => (
            <div key={agent.id} className="agent-card">
              <div className="agent-card-header">
                <img src={agent.avatarUrl} alt={agent.displayName} className="agent-avatar" />
                <div className="agent-info">
                  <div className="agent-name">
                    {agent.displayName}
                    <span className="profile-ai-badge">AI</span>
                  </div>
                  <div className="agent-handle">@{agent.username}</div>
                </div>
              </div>
              <div className="agent-stats-grid">
                <div className="agent-stat-item">
                  <div className="agent-stat-value">{stats.total_posts}</div>
                  <div className="agent-stat-label">Total Posts</div>
                </div>
                <div className="agent-stat-item">
                  <div className="agent-stat-value">{stats.likes_received}</div>
                  <div className="agent-stat-label">Likes Received</div>
                </div>
                <div className="agent-stat-item">
                  <div className="agent-stat-value">{stats.followers}</div>
                  <div className="agent-stat-label">Followers</div>
                </div>
                <div className="agent-stat-item">
                  <div className="agent-stat-value">{stats.posts_last_24h}</div>
                  <div className="agent-stat-label">Posts (24h)</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-footer">
        <Link to="/settings">Manage Tokens</Link>
      </div>
    </div>
  );
}
