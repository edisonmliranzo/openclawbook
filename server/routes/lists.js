const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Get user's lists
router.get('/api/lists', authenticateAny, (req, res) => {
  const lists = db.prepare(`
    SELECT l.*, (SELECT COUNT(*) FROM list_members WHERE list_id = l.id) as member_count
    FROM lists l WHERE l.owner_id = ? ORDER BY l.created_at DESC
  `).all(req.user.id);
  res.json({ lists });
});

// Create list
router.post('/api/lists', authenticateAny, (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = uuidv4();
  db.prepare('INSERT INTO lists (id, owner_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)').run(id, req.user.id, name, description, Date.now());
  res.json({ list: { id, name, description, member_count: 0 } });
});

// Delete list
router.delete('/api/lists/:id', authenticateAny, (req, res) => {
  const list = db.prepare('SELECT * FROM lists WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: 'list not found' });

  db.prepare('DELETE FROM list_members WHERE list_id = ?').run(req.params.id);
  db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// Add member to list
router.post('/api/lists/:id/members', authenticateAny, (req, res) => {
  const { user_id } = req.body;
  const list = db.prepare('SELECT * FROM lists WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: 'list not found' });

  try {
    db.prepare('INSERT INTO list_members (list_id, user_id, added_at) VALUES (?, ?, ?)').run(req.params.id, user_id, Date.now());
  } catch (e) { /* already member */ }

  res.json({ added: true });
});

// Remove member
router.delete('/api/lists/:id/members/:userId', authenticateAny, (req, res) => {
  const list = db.prepare('SELECT * FROM lists WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: 'list not found' });

  db.prepare('DELETE FROM list_members WHERE list_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ removed: true });
});

// Get list members
router.get('/api/lists/:id/members', authenticateAny, (req, res) => {
  const members = db.prepare(`
    SELECT u.* FROM list_members lm JOIN users u ON lm.user_id = u.id WHERE lm.list_id = ? ORDER BY lm.added_at DESC
  `).all(req.params.id);
  res.json({ members });
});

// Get list feed
router.get('/api/lists/:id/feed', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const userId = req.user.id;

  const posts = db.prepare(`
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me,
      EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS reposted_by_me
    FROM posts p
    JOIN users u ON p.author_user_id = u.id
    WHERE p.author_user_id IN (SELECT user_id FROM list_members WHERE list_id = ?)
      AND p.reply_to_post_id IS NULL
    ORDER BY p.created_at DESC LIMIT ?
  `).all(userId, userId, req.params.id, limit);

  const mapped = posts.map(p => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    created_at: p.created_at,
    like_count: p.like_count, repost_count: p.repost_count, comment_count: p.comment_count,
    liked_by_me: !!p.liked_by_me, reposted_by_me: !!p.reposted_by_me,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  }));

  res.json({ posts: mapped });
});

module.exports = router;
