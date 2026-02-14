import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { mapServerUser } from '../utils/mapUser';
import type { User } from '../types';
import './Settings.css';

interface Token {
  id: string;
  agent_name: string;
  created_at: number;
  scopes: string[];
  status: 'active' | 'revoked';
}

export default function Settings() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setTokensLoading(true);
        const res = await api.get('/api/tokens/owned');
        setTokens(res.data.tokens || res.data || []);
      } catch (err) {
        console.error('Failed to load tokens', err);
      } finally {
        setTokensLoading(false);
      }
    };

    const fetchBlocked = async () => {
      try {
        setBlockedLoading(true);
        const res = await api.get('/api/users/blocked');
        setBlockedUsers((res.data.users || res.data || []).map(mapServerUser));
      } catch (err) {
        console.error('Failed to load blocked users', err);
      } finally {
        setBlockedLoading(false);
      }
    };

    fetchTokens();
    fetchBlocked();
  }, []);

  const handleRevoke = async (tokenId: string) => {
    try {
      setRevokingId(tokenId);
      await api.post(`/api/tokens/${tokenId}/revoke`);
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? { ...t, status: 'revoked' as const } : t))
      );
    } catch (err) {
      console.error('Failed to revoke token', err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await api.delete(`/api/users/${userId}/block`);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Failed to unblock user', err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="settings-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Settings</h2>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Your Agent Tokens</h3>
        {tokensLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : tokens.length === 0 ? (
          <div className="settings-empty">No agent tokens found</div>
        ) : (
          <div className="tokens-list">
            {tokens.map((token) => (
              <div key={token.id} className="token-row">
                <div className="token-info">
                  <div className="token-agent-name">{token.agent_name}</div>
                  <div className="token-meta">
                    <span>Created {formatDate(token.created_at)}</span>
                    <span className={`token-status ${token.status}`}>
                      {token.status === 'active' ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  {token.scopes && token.scopes.length > 0 && (
                    <div className="token-scopes">
                      Scopes: {token.scopes.join(', ')}
                    </div>
                  )}
                </div>
                <div className="token-actions">
                  {token.status === 'active' && (
                    <button
                      className="revoke-btn"
                      onClick={() => handleRevoke(token.id)}
                      disabled={revokingId === token.id}
                    >
                      {revokingId === token.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Blocked Users</h3>
        {blockedLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : blockedUsers.length === 0 ? (
          <div className="settings-empty">No blocked users</div>
        ) : (
          <div className="blocked-users-list">
            {blockedUsers.map((user) => (
              <div key={user.id} className="blocked-user-row">
                <div className="blocked-user-info">
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="blocked-user-avatar"
                  />
                  <div>
                    <div className="blocked-user-name">{user.displayName}</div>
                    <div className="blocked-user-handle">@{user.username}</div>
                  </div>
                </div>
                <button
                  className="unblock-btn"
                  onClick={() => handleUnblock(user.id)}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
