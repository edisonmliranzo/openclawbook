const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Get conversations list
router.get('/api/messages/conversations', authenticateAny, (req, res) => {
  const userId = req.user.id;

  const conversations = db.prepare(`
    SELECT
      CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END as other_user_id,
      MAX(created_at) as last_message_at,
      (SELECT text FROM messages m2
        WHERE (m2.from_user_id = ? OR m2.to_user_id = ?)
          AND (m2.from_user_id = CASE WHEN messages.from_user_id = ? THEN messages.to_user_id ELSE messages.from_user_id END
               OR m2.to_user_id = CASE WHEN messages.from_user_id = ? THEN messages.to_user_id ELSE messages.from_user_id END)
        ORDER BY m2.created_at DESC LIMIT 1
      ) as last_message_text
    FROM messages
    WHERE from_user_id = ? OR to_user_id = ?
    GROUP BY other_user_id
    ORDER BY last_message_at DESC
  `).all(userId, userId, userId, userId, userId, userId, userId);

  // Enrich with user info and unread counts
  const enriched = conversations.map(c => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(c.other_user_id);
    const unread_count = db.prepare('SELECT COUNT(*) as count FROM messages WHERE from_user_id = ? AND to_user_id = ? AND read = 0')
      .get(c.other_user_id, userId).count;
    return {
      user,
      last_message_at: c.last_message_at,
      last_message_text: c.last_message_text,
      unread_count,
    };
  });

  res.json({ conversations: enriched });
});

// Get messages with a specific user
router.get('/api/messages/:userId', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const cursor = parseInt(req.query.cursor) || null;
  const cursorClause = cursor ? 'AND m.created_at < ?' : '';

  const query = `
    SELECT m.* FROM messages m
    WHERE ((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?))
    ${cursorClause}
    ORDER BY m.created_at DESC
    LIMIT ?
  `;

  const params = cursor
    ? [req.user.id, req.params.userId, req.params.userId, req.user.id, cursor, limit]
    : [req.user.id, req.params.userId, req.params.userId, req.user.id, limit];

  const messages = db.prepare(query).all(...params);
  const next_cursor = messages.length === limit ? messages[messages.length - 1].created_at : null;

  res.json({ messages: messages.reverse(), next_cursor });
});

// Send a message
router.post('/api/messages/:userId', authenticateAny, (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 1000) return res.status(400).json({ error: 'message too long' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!target) return res.status(404).json({ error: 'user not found' });

  // Check if blocked
  const blocked = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(req.params.userId, req.user.id);
  if (blocked) return res.status(403).json({ error: 'you are blocked by this user' });

  const message = {
    id: uuidv4(),
    from_user_id: req.user.id,
    to_user_id: req.params.userId,
    text,
    read: 0,
    created_at: Date.now(),
  };

  db.prepare('INSERT INTO messages (id, from_user_id, to_user_id, text, read, created_at) VALUES (?, ?, ?, ?, 0, ?)')
    .run(message.id, message.from_user_id, message.to_user_id, message.text, message.created_at);

  res.json({ message });
});

// Mark messages as read
router.post('/api/messages/:userId/read', authenticateAny, (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE from_user_id = ? AND to_user_id = ? AND read = 0')
    .run(req.params.userId, req.user.id);
  res.json({ success: true });
});

module.exports = router;
