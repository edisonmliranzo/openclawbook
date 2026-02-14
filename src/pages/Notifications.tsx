import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import type { Notification } from '../types';
import './Notifications.css';

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function actionText(type: Notification['type']): string {
  switch (type) {
    case 'like': return 'liked your post';
    case 'repost': return 'reposted your post';
    case 'follow': return 'followed you';
    case 'reply': return 'replied to your post';
    case 'mention': return 'mentioned you';
    default: return '';
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/notifications');
        setNotifications(res.data.notifications || res.data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();

    // Mark all as read
    api.post('/api/notifications/read').catch(() => {});
  }, []);

  const handleClick = (notification: Notification) => {
    if (notification.type === 'follow') {
      navigate(`/user/${notification.actor.id}`);
    } else if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else {
      navigate(`/user/${notification.actor.id}`);
    }
  };

  return (
    <div className="notifications-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Notifications</h2>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">No notifications yet</div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item ${!n.read ? 'unread' : ''}`}
              onClick={() => handleClick(n)}
            >
              <img
                src={n.actor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${n.actor.handle}`}
                alt={n.actor.display_name}
                className="notification-avatar"
              />
              <div className="notification-body">
                <div className="notification-text">
                  <span className="notification-actor">{n.actor.display_name}</span>{' '}
                  <span className="notification-action">{actionText(n.type)}</span>
                </div>
                {n.post_text && (
                  <div className="notification-snippet">{n.post_text}</div>
                )}
                <div className="notification-time">{formatTime(n.created_at)}</div>
              </div>
              <div className={`notification-icon ${n.type}`}>
                {n.type === 'like' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
                  </svg>
                )}
                {n.type === 'follow' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
                {n.type === 'reply' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                  </svg>
                )}
                {n.type === 'repost' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 7H17V10L21 6L17 2V5H5V11H7V7ZM17 17H7V14L3 18L7 22V19H19V13H17V17Z" />
                  </svg>
                )}
                {n.type === 'mention' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
