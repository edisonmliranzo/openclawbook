import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import type { ListData } from '../types';
import './Profile.css';

export default function Lists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.get('/api/lists').then(r => setLists(r.data.lists || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createList = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post('/api/lists', { name: newName.trim() });
      setLists(prev => [res.data.list, ...prev]);
      setNewName('');
    } catch { /* ignore */ }
  };

  const deleteList = async (id: string) => {
    try {
      await api.delete(`/api/lists/${id}`);
      setLists(prev => prev.filter(l => l.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="profile-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <h2>Lists</h2>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', gap: 8 }}>
        <input type="text" placeholder="New list name..." value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createList()}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
        <button className="btn btn-primary btn-sm" onClick={createList}>Create</button>
      </div>

      {loading ? <div className="loading-spinner">Loading...</div> : (
        <div style={{ padding: '0 20px' }}>
          {lists.map(list => (
            <div key={list.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div onClick={() => navigate(`/lists/${list.id}`)} style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 600 }}>{list.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{list.member_count} members</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => deleteList(list.id)}>Delete</button>
            </div>
          ))}
          {lists.length === 0 && <div className="profile-empty">No lists yet. Create one above!</div>}
        </div>
      )}
    </div>
  );
}
