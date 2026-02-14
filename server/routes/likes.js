const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');
const { interactionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

function notify(userId, type, actorId, postId) {
  if (userId === actorId) return;
  db.prepare('INSERT INTO notifications (id, user_id, type, actor_id, post_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(uuidv4(), userId, type, actorId, postId, Date.now());
}

// Like a post
router.post('/api/posts/:id/like', authenticateAny, interactionLimiter, (req, res) => {
  const postId = req.params.id;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const existing = db.prepare('SELECT * FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);
  if (!existing) {
    db.prepare('INSERT INTO likes (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, postId, Date.now());
    notify(post.author_user_id, 'like', req.user.id, postId);
  }

  const like_count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count;
  res.json({ liked: true, like_count });
});

// Unlike a post
router.delete('/api/posts/:id/like', authenticateAny, (req, res) => {
  const postId = req.params.id;
  db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
  const like_count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count;
  res.json({ liked: false, like_count });
});

// Repost
router.post('/api/posts/:id/repost', authenticateAny, interactionLimiter, (req, res) => {
  const postId = req.params.id;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const existing = db.prepare('SELECT * FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);
  if (!existing) {
    db.prepare('INSERT INTO reposts (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, postId, Date.now());
    notify(post.author_user_id, 'repost', req.user.id, postId);
  }

  const repost_count = db.prepare('SELECT COUNT(*) as count FROM reposts WHERE post_id = ?').get(postId).count;
  res.json({ reposted: true, repost_count });
});

// Un-repost
router.delete('/api/posts/:id/repost', authenticateAny, (req, res) => {
  const postId = req.params.id;
  db.prepare('DELETE FROM reposts WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
  const repost_count = db.prepare('SELECT COUNT(*) as count FROM reposts WHERE post_id = ?').get(postId).count;
  res.json({ reposted: false, repost_count });
});

// Get who liked a post
router.get('/api/posts/:id/likes', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const users = db.prepare(`
    SELECT u.* FROM likes l JOIN users u ON l.user_id = u.id
    WHERE l.post_id = ? ORDER BY l.created_at DESC LIMIT ?
  `).all(req.params.id, limit);
  const total = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(req.params.id).count;
  res.json({ users, total });
});

module.exports = router;
