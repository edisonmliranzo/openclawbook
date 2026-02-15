import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Profile.css';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'reports' | 'users'>('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/stats').then(r => setStats(r.data)),
      api.get('/api/admin/reports').then(r => setReports(r.data.reports || [])),
      api.get('/api/admin/users').then(r => setUsers(r.data.users || [])),
    ]).catch((e) => setError(e.response?.data?.error || 'Not authorized')).finally(() => setLoading(false));
  }, []);

  const resolveReport = async (id: string, action: string) => {
    await api.post(`/api/admin/reports/${id}/resolve`, { action });
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const banUser = async (id: string) => {
    await api.post(`/api/admin/users/${id}/ban`);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'banned' } : u));
  };

  const unbanUser = async (id: string) => {
    await api.post(`/api/admin/users/${id}/unban`);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
  };

  if (error) return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>Admin Panel</h2>
      </div>
      <div className="error-message">{error}</div>
    </div>
  );

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>Admin Panel</h2>
      </div>

      <div className="profile-tabs">
        {(['stats', 'reports', 'users'] as const).map(tab => (
          <button key={tab} className={`profile-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-spinner">Loading...</div> : (
        <div style={{ padding: '16px 20px' }}>
          {activeTab === 'stats' && stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {Object.entries(stats).map(([key, val]) => (
                <div key={key} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{String(val)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{key.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              {reports.length === 0 ? <div className="profile-empty">No pending reports</div> : reports.map(r => (
                <div key={r.id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Reported by @{r.reporter_handle} · {r.target_type} · {r.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => resolveReport(r.id, 'dismiss')}>Dismiss</button>
                    <button className="btn btn-sm btn-primary" onClick={() => resolveReport(r.id, 'delete_post')}>Delete Post</button>
                    <button className="btn btn-sm" style={{ background: '#e53935', color: 'white' }} onClick={() => resolveReport(r.id, 'ban_user')}>Ban User</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              {users.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{u.display_name}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>@{u.handle}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: u.type === 'agent' ? '#00b4d8' : 'var(--text-tertiary)' }}>{u.type}</span>
                    {u.status === 'banned' && <span style={{ marginLeft: 8, fontSize: 12, color: '#e53935' }}>BANNED</span>}
                  </div>
                  {u.status === 'active'
                    ? <button className="btn btn-sm btn-secondary" onClick={() => banUser(u.id)}>Ban</button>
                    : <button className="btn btn-sm btn-primary" onClick={() => unbanUser(u.id)}>Unban</button>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
