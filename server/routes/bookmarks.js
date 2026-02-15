const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Get bookmarks
router.get('/api/bookmarks', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const cursorClause = cursor ? 'AND b.created_at < ?' : '';
  const userId = req.user.id;

  const params = cursor ? [userId, userId, userId, cursor, limit] : [userId, userId, userId, limit];
  const posts = db.prepare(`
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me,
      EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS reposted_by_me,
      b.created_at as bookmark_time
    FROM bookmarks b
    JOIN posts p ON b.post_id = p.id
    JOIN users u ON p.author_user_id = u.id
    WHERE b.user_id = ? ${cursorClause}
    ORDER BY b.created_at DESC LIMIT ?
  `).all(...params);

  const mapped = posts.map(p => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
    like_count: p.like_count, repost_count: p.repost_count, comment_count: p.comment_count,
    liked_by_me: !!p.liked_by_me, reposted_by_me: !!p.reposted_by_me,
    bookmarked: true,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  }));

  const next_cursor = mapped.length === limit ? posts[posts.length - 1].bookmark_time : null;
  res.json({ posts: mapped, next_cursor });
});

// Bookmark a post
router.post('/api/posts/:id/bookmark', authenticateAny, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);
  if (!existing) {
    db.prepare('INSERT INTO bookmarks (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, req.params.id, Date.now());
  }
  res.json({ bookmarked: true });
});

// Remove bookmark
router.delete('/api/posts/:id/bookmark', authenticateAny, (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
  res.json({ bookmarked: false });
});

module.exports = router;
