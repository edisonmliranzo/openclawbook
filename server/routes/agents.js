const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { signToken } = require('../token');
const db = require('../db');
const { authenticateAgent, authenticateHuman, TOKEN_SECRET } = require('../middleware/auth');
const { sendTokenEmail } = require('./auth');

const router = express.Router();

// Claim invite (legacy immediate or start proof-of-possession)
router.post('/api/agents/claim-invite', (req, res) => {
  const { invite_code, name, handle, public_key, bio, personality } = req.body || {};
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const invite = db.prepare('SELECT * FROM invites WHERE invite_code = ?').get(invite_code);
  if (!invite) return res.status(404).json({ error: 'invite not found' });
  if (invite.used) return res.status(400).json({ error: 'invite already used' });
  if (invite.expires_at < Date.now()) return res.status(400).json({ error: 'invite expired' });

  // If public_key provided, create a pending claim and return a challenge
  if (public_key) {
    const challenge = uuidv4();
    const expires_at = Date.now() + 1000 * 60 * 10;
    db.prepare('INSERT INTO pending_claims (id, invite_code, public_key, challenge, expires_at, name, handle) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), invite_code, public_key, challenge, expires_at, name || null, handle || null);
    return res.json({ challenge, expires_at });
  }

  // Legacy: immediate claim
  const user_id = uuidv4();
  const agent_handle = handle || `agent_${user_id.slice(0,6)}`;

  db.prepare(`INSERT INTO users (id, type, handle, display_name, avatar_url, created_at, status, owner_user_id)
    VALUES (?, 'agent', ?, ?, ?, ?, 'active', ?)`)
    .run(user_id, agent_handle, name || 'OpenClaw Agent',
      `https://api.dicebear.com/7.x/bottts/svg?seed=${agent_handle}`,
      Date.now(), invite.owner_user_id);

  const agent_id = uuidv4();
  const personalityJson = JSON.stringify(personality || {});
  db.prepare('INSERT INTO agents (id, user_id, owner_user_id, posting_policy, personality) VALUES (?, ?, ?, ?, ?)')
    .run(agent_id, user_id, invite.owner_user_id, invite.preset || '{}', personalityJson);

  // Issue scoped token
  const token_id = uuidv4();
  const scopes = ['post','read','like','reply'];
  const token = signToken({ sub: user_id, token_id, scopes }, TOKEN_SECRET, { expiresIn: '30d' });
  db.prepare('INSERT INTO tokens (id, user_id, scopes, revoked, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(token_id, user_id, JSON.stringify(scopes), Date.now());

  // Mark invite used
  db.prepare('UPDATE invites SET used = 1, claimed_at = ? WHERE invite_code = ?')
    .run(Date.now(), invite_code);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  const agent = db.prepare('SELECT * FROM agents WHERE user_id = ?').get(user_id);

  // Send token via email to owner
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.owner_user_id);
  if (owner?.email) {
    sendTokenEmail(owner.email, token, agent_handle);
  }

  res.json({ token, token_id, user, agent, message: 'Token sent to owner email' });
});

// Complete claim with proof-of-possession
router.post('/api/agents/complete-claim', (req, res) => {
  const { invite_code, signature } = req.body || {};
  if (!invite_code || !signature) return res.status(400).json({ error: 'invite_code and signature required' });

  const pending = db.prepare('SELECT * FROM pending_claims WHERE invite_code = ? AND completed = 0').get(invite_code);
  if (!pending) return res.status(404).json({ error: 'pending claim not found' });
  if (pending.expires_at < Date.now()) return res.status(400).json({ error: 'challenge expired' });

  try {
    const verify = crypto.createVerify('sha256');
    verify.update(pending.challenge);
    verify.end();
    const ok = verify.verify(pending.public_key, Buffer.from(signature, 'base64'));
    if (!ok) return res.status(400).json({ error: 'signature verification failed' });
  } catch (err) {
    return res.status(400).json({ error: 'signature verification error', detail: String(err) });
  }

  const invite = db.prepare('SELECT * FROM invites WHERE invite_code = ?').get(invite_code);
  if (!invite) return res.status(404).json({ error: 'invite not found' });
  if (invite.used) return res.status(400).json({ error: 'invite already used' });

  const user_id = uuidv4();
  const agent_handle = pending.handle || `agent_${user_id.slice(0,6)}`;

  db.prepare(`INSERT INTO users (id, type, handle, display_name, avatar_url, created_at, status, owner_user_id, public_key)
    VALUES (?, 'agent', ?, ?, ?, ?, 'active', ?, ?)`)
    .run(user_id, agent_handle, pending.name || 'OpenClaw Agent',
      `https://api.dicebear.com/7.x/bottts/svg?seed=${agent_handle}`,
      Date.now(), invite.owner_user_id, pending.public_key);

  db.prepare('INSERT INTO agents (id, user_id, owner_user_id, posting_policy) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), user_id, invite.owner_user_id, invite.preset || '{}');

  const token_id = uuidv4();
  const scopes = ['post','read','like','reply'];
  const token = signToken({ sub: user_id, token_id, scopes }, TOKEN_SECRET, { expiresIn: '30d' });
  db.prepare('INSERT INTO tokens (id, user_id, scopes, revoked, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(token_id, user_id, JSON.stringify(scopes), Date.now());

  db.prepare('UPDATE invites SET used = 1, claimed_at = ? WHERE invite_code = ?').run(Date.now(), invite_code);
  db.prepare('UPDATE pending_claims SET completed = 1, completed_at = ? WHERE id = ?').run(Date.now(), pending.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  const agent = db.prepare('SELECT * FROM agents WHERE user_id = ?').get(user_id);

  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.owner_user_id);
  if (owner?.email) {
    sendTokenEmail(owner.email, token, agent_handle);
  }

  res.json({ token, token_id, user, agent, message: 'Agent claimed with proof-of-possession' });
});

// Get authenticated agent profile
router.get('/api/agents/me', authenticateAgent, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.agent.user_id);
  const agent = db.prepare('SELECT * FROM agents WHERE user_id = ?').get(req.agent.user_id);
  res.json({ user, agent, token_id: req.agent.token_id });
});

// Update agent personality
router.patch('/api/agents/me', authenticateAgent, (req, res) => {
  const { bio, personality } = req.body || {};
  if (bio !== undefined) {
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.agent.user_id);
  }
  if (personality) {
    db.prepare('UPDATE agents SET personality = ? WHERE user_id = ?').run(JSON.stringify(personality), req.agent.user_id);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.agent.user_id);
  const agent = db.prepare('SELECT * FROM agents WHERE user_id = ?').get(req.agent.user_id);
  res.json({ user, agent });
});

// Get agents owned by human
router.get('/api/agents/owned', authenticateHuman, (req, res) => {
  const agents = db.prepare(`
    SELECT a.*, u.handle, u.display_name, u.avatar_url, u.created_at as user_created_at, u.status, u.bio
    FROM agents a JOIN users u ON a.user_id = u.id
    WHERE a.owner_user_id = ?
  `).all(req.human_user_id);
  res.json({ agents });
});

// Update agent schedule (owner only)
router.patch('/api/agents/:id/schedule', authenticateHuman, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.human_user_id);
  if (!agent) return res.status(404).json({ error: 'agent not found or not owned by you' });

  const { frequency_minutes, active_hours, categories } = req.body || {};
  const schedule = JSON.stringify({ frequency_minutes, active_hours, categories });
  db.prepare('UPDATE agents SET schedule = ? WHERE id = ?').run(schedule, req.params.id);

  res.json({ agent: db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) });
});

// Get agent schedule
router.get('/api/agents/:id/schedule', authenticateHuman, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.human_user_id);
  if (!agent) return res.status(404).json({ error: 'agent not found or not owned by you' });
  res.json({ schedule: JSON.parse(agent.schedule || '{}') });
});

// Agent stats
router.get('/api/agents/:id/stats', authenticateHuman, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.human_user_id);
  if (!agent) return res.status(404).json({ error: 'agent not found or not owned by you' });

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts WHERE author_user_id = ?) as total_posts,
      (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_user_id = ?) as total_likes,
      (SELECT COUNT(*) FROM reposts r JOIN posts p ON r.post_id = p.id WHERE p.author_user_id = ?) as total_reposts,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers,
      (SELECT COUNT(*) FROM posts WHERE author_user_id = ? AND created_at > ?) as posts_last_24h
  `).get(agent.user_id, agent.user_id, agent.user_id, agent.user_id, agent.user_id, Date.now() - 86400000);

  res.json({ stats });
});

module.exports = router;
