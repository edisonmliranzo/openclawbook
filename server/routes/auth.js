const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { signToken } = require('../token');
const db = require('../db');
const { authenticateHuman, TOKEN_SECRET } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 1025,
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});

async function sendTokenEmail(email, token, agentHandle) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@openclawbook.local',
      to: email,
      subject: `Your OpenClaw Agent Token: ${agentHandle}`,
      html: `<h2>OpenClaw Agent Access Token</h2>
        <p>Your AI agent <strong>${agentHandle}</strong> has been created and is ready to use.</p>
        <p><strong>Token:</strong></p>
        <code style="background:#f0f0f0;padding:10px;display:block;word-break:break-all;">${token}</code>
        <p><strong>Save this token!</strong> You'll need it to authorize the agent.</p>
        <p><strong>Quick start:</strong></p>
        <pre>node agent_runner.js --token "${token}" --api-url http://localhost:4001</pre>
        <p>If you lose this token, you can request a new one through your account.</p>`
    });
  } catch (err) {
    console.error('Email send failed (non-critical):', err.message);
  }
}

// Deprecated invites endpoint
router.post('/api/invites', (req, res) => {
  return res.status(400).json({ error: 'Use POST /api/invites/auth as authenticated human' });
});

// Create or get a human token
router.post('/api/humans/token', (req, res) => {
  const { provider, provider_id, email, handle, display_name } = req.body || {};
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });

  let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, provider_id)
    || db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id);

  if (!user) {
    const user_id = provider_id;
    db.prepare(`INSERT INTO users (id, type, provider, provider_id, email, handle, display_name, avatar_url, created_at, status)
      VALUES (?, 'human', ?, ?, ?, ?, ?, ?, ?, 'active')`)
      .run(user_id, provider, provider_id, email || null,
        handle || `user_${typeof user_id === 'string' ? user_id.slice(0,6) : user_id}`,
        display_name || handle || 'Human User',
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle || user_id}`,
        Date.now());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  }

  const token = signToken({ sub: user.id, role: 'human' }, TOKEN_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// Authenticated invites endpoint (human only)
router.post('/api/invites/auth', authenticateHuman, (req, res) => {
  const { preset } = req.body || {};
  const owner_user_id = req.human_user_id;
  const invite_code = uuidv4();
  const expires_at = Date.now() + 1000 * 60 * 60;

  db.prepare('INSERT INTO invites (id, invite_code, owner_user_id, preset, used, expires_at) VALUES (?, ?, ?, ?, 0, ?)')
    .run(uuidv4(), invite_code, owner_user_id, JSON.stringify(preset || {}), expires_at);

  res.json({ invite_code, expires_at });
});

// Check if user exists by provider_id
router.get('/api/humans/check/:provider/:provider_id', (req, res) => {
  const { provider, provider_id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, provider_id);
  if (user) return res.json({ exists: true, user });
  return res.json({ exists: false });
});

// Create or retrieve human user
router.post('/api/humans/create-or-get', (req, res) => {
  const { provider, provider_id, email, handle, display_name } = req.body || {};
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });

  let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, provider_id)
    || db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id);

  if (user) return res.json({ user });

  const user_id = provider_id;
  db.prepare(`INSERT INTO users (id, type, provider, provider_id, email, handle, display_name, avatar_url, created_at, status)
    VALUES (?, 'human', ?, ?, ?, ?, ?, ?, ?, 'active')`)
    .run(user_id, provider, provider_id, email || null,
      handle || `user_${typeof user_id === 'string' ? user_id.slice(0,6) : user_id}`,
      display_name || handle || 'Human User',
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle || user_id}`,
      Date.now());

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  return res.json({ user });
});

// Agent signup via invite code (browser-based onboarding)
let wsBroadcast = null;
function setWsBroadcast(fn) { wsBroadcast = fn; }

router.post('/api/agents/signup', (req, res) => {
  const { invite_code, name, handle, ai_model, bio } = req.body || {};
  if (!invite_code || !handle || !name) {
    return res.status(400).json({ error: 'invite_code, name, and handle are required' });
  }

  // Validate handle format
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
    return res.status(400).json({ error: 'Handle must be 3-30 lowercase letters, numbers, or underscores' });
  }

  // Check handle uniqueness
  const existingUser = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
  if (existingUser) {
    return res.status(400).json({ error: 'Handle already taken' });
  }

  // Validate invite code
  const invite = db.prepare('SELECT * FROM invites WHERE invite_code = ?').get(invite_code);
  if (!invite) return res.status(404).json({ error: 'Invite code not found' });
  if (invite.expires_at < Date.now()) return res.status(400).json({ error: 'Invite code has expired' });

  // Check usage limits
  const maxUses = invite.max_uses || 1;
  const currentUses = invite.current_uses || 0;
  if (invite.used && maxUses <= 1) return res.status(400).json({ error: 'Invite code already used' });
  if (currentUses >= maxUses) return res.status(400).json({ error: 'Invite code has reached its maximum uses' });

  // Create user
  const user_id = uuidv4();
  db.prepare(`INSERT INTO users (id, type, handle, display_name, bio, avatar_url, ai_model, created_at, status, owner_user_id)
    VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, 'active', ?)`)
    .run(user_id, handle, name,
      bio || '',
      `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}`,
      ai_model || null,
      Date.now(),
      invite.owner_user_id);

  // Create agent record
  const agent_id = uuidv4();
  db.prepare('INSERT INTO agents (id, user_id, owner_user_id, posting_policy, personality) VALUES (?, ?, ?, ?, ?)')
    .run(agent_id, user_id, invite.owner_user_id, invite.preset || '{}', '{}');

  // Issue scoped token
  const token_id = uuidv4();
  const scopes = ['post', 'read', 'like', 'reply'];
  const token = signToken({ sub: user_id, token_id, scopes }, TOKEN_SECRET, { expiresIn: '30d' });
  db.prepare('INSERT INTO tokens (id, user_id, scopes, revoked, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(token_id, user_id, JSON.stringify(scopes), Date.now());

  // Update invite usage
  const newUses = currentUses + 1;
  if (newUses >= maxUses) {
    db.prepare('UPDATE invites SET used = 1, current_uses = ?, claimed_at = ? WHERE invite_code = ?')
      .run(newUses, Date.now(), invite_code);
  } else {
    db.prepare('UPDATE invites SET current_uses = ? WHERE invite_code = ?')
      .run(newUses, invite_code);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  const agent = db.prepare('SELECT * FROM agents WHERE user_id = ?').get(user_id);

  // Broadcast real-time event
  if (wsBroadcast) {
    wsBroadcast('agent_joined', {
      id: user_id,
      handle,
      display_name: name,
      ai_model: ai_model || 'Unknown',
      avatar_url: user.avatar_url,
    });
  }

  res.json({ token, token_id, user, agent });
});

// Get demo invite codes with usage info
router.get('/api/invites/demo', (req, res) => {
  const demoCodes = ['OPENCLAW-ALPHA-2024', 'AI-ASSISTANT-BETA', 'NEURAL-NETWORK-2024'];
  const codes = demoCodes.map(code => {
    const invite = db.prepare('SELECT invite_code, max_uses, current_uses, expires_at FROM invites WHERE invite_code = ?').get(code);
    if (!invite) return { code, max_uses: 0, current_uses: 0, remaining: 0, available: false };
    const maxUses = invite.max_uses || 1;
    const currentUses = invite.current_uses || 0;
    return {
      code: invite.invite_code,
      max_uses: maxUses,
      current_uses: currentUses,
      remaining: maxUses - currentUses,
      available: currentUses < maxUses && invite.expires_at > Date.now(),
    };
  });
  res.json({ codes });
});

module.exports = { router, sendTokenEmail, setWsBroadcast };
