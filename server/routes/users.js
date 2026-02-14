const express = require('express');
const db = require('../db');
const { authenticateAny, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// List all users with pagination
router.get('/api/users', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const users = db.prepare('SELECT * FROM users WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all('active', limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('active').count;

  res.json({ users, total, page });
});

// Suggested users (not followed by current user)
router.get('/api/users/suggested', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const userId = req.user.id;

  const users = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
    FROM users u
    WHERE u.id != ?
      AND u.status = 'active'
      AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
    ORDER BY follower_count DESC
    LIMIT ?
  `).all(userId, userId, limit);

  res.json({ users });
});

// Get user profile
router.get('/api/users/:userId', optionalAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const follower_count = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(req.params.userId).count;
  const following_count = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(req.params.userId).count;
  const post_count = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_user_id = ?').get(req.params.userId).count;

  let is_following = false;
  if (req.user) {
    is_following = !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, req.params.userId);
  }

  res.json({ user, follower_count, following_count, post_count, is_following });
});

// Get user's posts
router.get('/api/users/:userId/posts', optionalAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const tab = req.query.tab || 'posts'; // 'posts', 'replies', 'likes'
  const userId = req.user?.id;

  let query, params;

  if (tab === 'replies') {
    const cursorClause = cursor ? 'AND p.created_at < ?' : '';
    query = `
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      FROM posts p JOIN users u ON p.author_user_id = u.id
      WHERE p.author_user_id = ? AND p.reply_to_post_id IS NOT NULL ${cursorClause}
      ORDER BY p.created_at DESC LIMIT ?
    `;
    params = cursor ? [req.params.userId, cursor, limit] : [req.params.userId, limit];
  } else if (tab === 'likes') {
    const cursorClause = cursor ? 'AND l.created_at < ?' : '';
    query = `
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count,
        l.created_at as sort_time
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      JOIN users u ON p.author_user_id = u.id
      WHERE l.user_id = ? ${cursorClause}
      ORDER BY l.created_at DESC LIMIT ?
    `;
    params = cursor ? [req.params.userId, cursor, limit] : [req.params.userId, limit];
  } else {
    const cursorClause = cursor ? 'AND p.created_at < ?' : '';
    query = `
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      FROM posts p JOIN users u ON p.author_user_id = u.id
      WHERE p.author_user_id = ? AND p.reply_to_post_id IS NULL ${cursorClause}
      ORDER BY p.created_at DESC LIMIT ?
    `;
    params = cursor ? [req.params.userId, cursor, limit] : [req.params.userId, limit];
  }

  const posts = db.prepare(query).all(...params);

  const mapped = posts.map(p => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
    like_count: p.like_count || 0, repost_count: p.repost_count || 0, comment_count: p.comment_count || 0,
    liked_by_me: false, reposted_by_me: false,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  }));

  const next_cursor = mapped.length === limit ? (mapped[mapped.length - 1].sort_time || mapped[mapped.length - 1].created_at) : null;
  res.json({ posts: mapped, next_cursor });
});

// Update user profile
router.patch('/api/users/:id', authenticateAny, (req, res) => {
  if (req.user.id !== req.params.id) return res.status(403).json({ error: 'unauthorized' });
  const { bio, display_name, avatar_url } = req.body || {};

  if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.params.id);
  if (display_name !== undefined) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, req.params.id);
  if (avatar_url !== undefined) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ user });
});

module.exports = router;
