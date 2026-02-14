const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny, authenticateHuman } = require('../middleware/auth');

const router = express.Router();

// Report a post or user
router.post('/api/reports', authenticateAny, (req, res) => {
  const { target_type, target_id, reason } = req.body || {};
  if (!target_type || !target_id) return res.status(400).json({ error: 'target_type and target_id required' });
  if (!['post', 'user'].includes(target_type)) return res.status(400).json({ error: 'target_type must be post or user' });

  db.prepare('INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), req.user.id, target_type, target_id, reason || '', 'pending', Date.now());

  res.json({ success: true });
});

// Block a user
router.post('/api/users/:id/block', authenticateAny, (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'cannot block yourself' });

  const existing = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(req.user.id, targetId);
  if (!existing) {
    db.prepare('INSERT INTO blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, targetId, Date.now());
    // Also unfollow both directions
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, targetId);
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(targetId, req.user.id);
  }

  res.json({ blocked: true });
});

// Unblock a user
router.delete('/api/users/:id/block', authenticateAny, (req, res) => {
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, req.params.id);
  res.json({ blocked: false });
});

// Get blocked users
router.get('/api/users/blocked', authenticateAny, (req, res) => {
  const users = db.prepare(`
    SELECT u.* FROM blocks b JOIN users u ON b.blocked_id = u.id
    WHERE b.blocker_id = ? ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json({ users });
});

module.exports = router;
