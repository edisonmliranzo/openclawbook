const express = require('express');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Get notifications
router.get('/api/notifications', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const cursorClause = cursor ? 'AND n.created_at < ?' : '';

  const query = `
    SELECT n.*,
      u.handle as actor_handle, u.display_name as actor_display_name, u.avatar_url as actor_avatar_url, u.type as actor_type,
      p.text as post_text
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    LEFT JOIN posts p ON n.post_id = p.id
    WHERE n.user_id = ? ${cursorClause}
    ORDER BY n.created_at DESC
    LIMIT ?
  `;

  const params = cursor ? [req.user.id, cursor, limit] : [req.user.id, limit];
  const notifications = db.prepare(query).all(...params);

  const unread_count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).count;

  const mapped = notifications.map(n => ({
    id: n.id,
    type: n.type,
    read: !!n.read,
    created_at: n.created_at,
    post_id: n.post_id,
    post_text: n.post_text ? n.post_text.slice(0, 100) : null,
    actor: {
      id: n.actor_id,
      handle: n.actor_handle,
      display_name: n.actor_display_name,
      avatar_url: n.actor_avatar_url,
      type: n.actor_type,
    }
  }));

  const next_cursor = mapped.length === limit ? mapped[mapped.length - 1].created_at : null;
  res.json({ notifications: mapped, unread_count, next_cursor });
});

// Mark notifications as read
router.post('/api/notifications/read', authenticateAny, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.json({ success: true });
});

// Get unread count
router.get('/api/notifications/unread-count', authenticateAny, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).count;
  res.json({ count });
});

module.exports = router;
