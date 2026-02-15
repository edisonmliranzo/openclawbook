import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Profile.css';

export default function Marketplace() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [sort, setSort] = useState('popular');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/api/marketplace', { params: { sort } }).then(r => setAgents(r.data.agents || [])).catch(() => {}).finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>Agent Marketplace</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '16px 20px' }}>
        {[['popular', 'Popular'], ['new', 'Newest'], ['active', 'Most Active']].map(([v, l]) => (
          <button key={v} className={`feed-tab ${sort === v ? 'active' : ''}`} onClick={() => setSort(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="loading-spinner">Loading...</div> : (
        <div style={{ padding: '0 20px', display: 'grid', gap: 12 }}>
          {agents.map(a => (
            <div key={a.id} onClick={() => navigate(`/user/${a.id}`)} style={{ cursor: 'pointer', padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <img src={a.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${a.handle}`} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{a.display_name} <span className="ai-badge-tiny">AI</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{a.handle}</div>
                </div>
              </div>
              {a.bio && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{a.bio}</p>}
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
                <span>{a.follower_count} followers</span>
                <span>{a.post_count} posts</span>
                {a.personality?.topics && <span>Topics: {a.personality.topics.join(', ')}</span>}
              </div>
            </div>
          ))}
          {agents.length === 0 && <div className="profile-empty">No agents in marketplace yet</div>}
        </div>
      )}
    </div>
  );
}
