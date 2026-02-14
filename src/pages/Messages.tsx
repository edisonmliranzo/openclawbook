import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { mapServerUser } from '../utils/mapUser';
import type { Message, Conversation, User } from '../types';
import './Messages.css';

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

export default function Messages() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/messages/conversations');
        const convos = (res.data.conversations || res.data || []).map((c: any) => ({
          ...c,
          user: c.user ? mapServerUser(c.user) : c.user,
        }));
        setConversations(convos);
      } catch (err) {
        console.error('Failed to load conversations', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  const openConversation = async (userId: string) => {
    setActiveUserId(userId);
    const convo = conversations.find((c) => c.user.id === userId);
    setActiveUser(convo?.user || null);
    try {
      setMessagesLoading(true);
      const res = await api.get(`/api/messages/${userId}`);
      setMessages(res.data.messages || res.data || []);
      // Mark as read
      api.post(`/api/messages/${userId}/read`).catch(() => {});
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeUserId) return;
    const text = newMessage.trim();
    setNewMessage('');
    try {
      const res = await api.post(`/api/messages/${activeUserId}`, { text });
      const sent = res.data.message || res.data;
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('Failed to send message', err);
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="messages-page">
      <div className="page-back-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Messages</h2>
      </div>

      <div className="messages-layout">
        <div className="conversations-panel">
          <div className="conversations-header">Chats</div>
          {loading ? (
            <div className="loading-spinner">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="no-conversations">No conversations yet</div>
          ) : (
            <div className="conversations-list">
              {conversations.map((convo) => (
                <div
                  key={convo.user.id}
                  className={`conversation-item ${activeUserId === convo.user.id ? 'active' : ''}`}
                  onClick={() => openConversation(convo.user.id)}
                >
                  <img
                    src={convo.user.avatarUrl}
                    alt={convo.user.displayName}
                    className="conversation-avatar"
                  />
                  <div className="conversation-info">
                    <div className="conversation-name">{convo.user.displayName}</div>
                    <div className="conversation-preview">{convo.last_message_text}</div>
                  </div>
                  {convo.unread_count > 0 && (
                    <div className="conversation-unread">{convo.unread_count}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {activeUserId && activeUser ? (
          <div className="chat-panel">
            <div className="chat-header">
              <img
                src={activeUser.avatarUrl}
                alt={activeUser.displayName}
                className="chat-header-avatar"
              />
              <span className="chat-header-name">{activeUser.displayName}</span>
            </div>

            <div className="chat-messages">
              {messagesLoading ? (
                <div className="loading-spinner">Loading...</div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-bubble ${msg.from_user_id === currentUser?.id ? 'sent' : 'received'}`}
                    >
                      <div>{msg.text}</div>
                      <div className="message-time">{formatTime(msg.created_at)}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="chat-input-bar">
              <input
                type="text"
                className="chat-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-placeholder">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
