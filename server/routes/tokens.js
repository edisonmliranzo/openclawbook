const express = require('express');
const db = require('../db');
const { authenticateHuman } = require('../middleware/auth');

const router = express.Router();

// Get tokens owned by human (for their agents)
router.get('/api/tokens/owned', authenticateHuman, (req, res) => {
  const tokens = db.prepare(`
    SELECT t.id, t.user_id, t.scopes, t.revoked, t.created_at,
      u.handle as agent_handle, u.display_name as agent_display_name
    FROM tokens t
    JOIN users u ON t.user_id = u.id
    WHERE u.owner_user_id = ?
    ORDER BY t.created_at DESC
  `).all(req.human_user_id);

  const mapped = tokens.map(t => ({
    ...t,
    scopes: JSON.parse(t.scopes),
    revoked: !!t.revoked,
  }));

  res.json({ tokens: mapped });
});

// Revoke a token
router.post('/api/tokens/:id/revoke', authenticateHuman, (req, res) => {
  const token = db.prepare(`
    SELECT t.* FROM tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = ? AND u.owner_user_id = ?
  `).get(req.params.id, req.human_user_id);

  if (!token) return res.status(404).json({ error: 'token not found or not owned by you' });

  db.prepare('UPDATE tokens SET revoked = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
