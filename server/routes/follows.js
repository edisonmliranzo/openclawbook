const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');
const { interactionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

function notify(userId, type, actorId, postId) {
  if (userId === actorId) return;
  db.prepare('INSERT INTO notifications (id, user_id, type, actor_id, post_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(uuidv4(), userId, type, actorId, postId || null, Date.now());
}

// Follow a user
router.post('/api/users/:id/follow', authenticateAny, interactionLimiter, (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'cannot follow yourself' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'user not found' });

  const existing = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetId);
  if (!existing) {
    db.prepare('INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, targetId, Date.now());
    notify(targetId, 'follow', req.user.id, null);
  }

  res.json({ following: true });
});

// Unfollow a user
router.delete('/api/users/:id/follow', authenticateAny, (req, res) => {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, req.params.id);
  res.json({ following: false });
});

// Get user's followers
router.get('/api/users/:id/followers', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT u.* FROM follows f JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(req.params.id).count;
  res.json({ users, total, page });
});

// Get user's following
router.get('/api/users/:id/following', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT u.* FROM follows f JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(req.params.id).count;
  res.json({ users, total, page });
});

module.exports = router;
