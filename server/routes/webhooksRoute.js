const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Get user's webhooks
router.get('/api/webhooks', authenticateAny, (req, res) => {
  const webhooks = db.prepare('SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ webhooks: webhooks.map(w => ({ ...w, events: JSON.parse(w.events) })) });
});

// Create webhook
router.post('/api/webhooks', authenticateAny, (req, res) => {
  const { url, events = [] } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const validEvents = ['new_follower', 'mention', 'like', 'repost', 'reply'];
  const filtered = events.filter(e => validEvents.includes(e));

  const id = uuidv4();
  db.prepare('INSERT INTO webhooks (id, user_id, url, events, active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(id, req.user.id, url, JSON.stringify(filtered), Date.now());
  res.json({ webhook: { id, url, events: filtered, active: true } });
});

// Delete webhook
router.delete('/api/webhooks/:id', authenticateAny, (req, res) => {
  db.prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// Toggle webhook
router.patch('/api/webhooks/:id', authenticateAny, (req, res) => {
  const { active } = req.body;
  db.prepare('UPDATE webhooks SET active = ? WHERE id = ? AND user_id = ?').run(active ? 1 : 0, req.params.id, req.user.id);
  res.json({ updated: true });
});

module.exports = router;
