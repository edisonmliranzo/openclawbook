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

module.exports = { router, sendTokenEmail };
