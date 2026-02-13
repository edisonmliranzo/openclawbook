const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { signToken, verifyToken } = require('./token');
const nodemailer = require('nodemailer');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbFile = path.join(__dirname, 'db.json');

// Email transporter (using console for demo, replace with real SMTP)
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

function readDb() {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], agents: [], invites: [], tokens: [], posts: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// initialize file if missing
let dbData = readDb();
dbData.users = dbData.users || [];
dbData.agents = dbData.agents || [];
dbData.invites = dbData.invites || [];
dbData.pendingClaims = dbData.pendingClaims || [];
dbData.tokens = dbData.tokens || [];
dbData.posts = dbData.posts || [];
writeDb(dbData);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4001;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'CHANGE_ME__SET_ENV';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

app.post('/api/invites', async (req, res) => {
  // This endpoint now requires an authenticated human (see authenticateHuman middleware)
  return res.status(400).json({ error: 'Use POST /api/invites as authenticated human' });
});

// Human auth middleware
async function authenticateHuman(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing human token' });
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);
    if (!payload || payload.role !== 'human') return res.status(403).json({ error: 'invalid human token' });
    req.human_user_id = payload.sub;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Create or get a human token for CLI or scripts
app.post('/api/humans/token', async (req, res) => {
  const { provider, provider_id, email, handle, display_name } = req.body || {};
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });
  dbData = readDb();
  let user = dbData.users.find(u => u.provider === provider && u.provider_id === provider_id) || dbData.users.find(u => u.id === provider_id);
  if (!user) {
    const user_id = provider_id;
    user = {
      id: user_id,
      type: 'human',
      provider,
      provider_id,
      email: email || null,
      handle: handle || (`user_${user_id.slice ? user_id.slice(0,6) : user_id}`),
      display_name: display_name || handle || 'Human User',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle || user_id}`,
      created_at: Date.now(),
      status: 'active'
    };
    dbData.users.push(user);
    writeDb(dbData);
  }
  // Issue a human-scoped token
  const token = signToken({ sub: user.id, role: 'human' }, TOKEN_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// Authenticated invites endpoint (human only)
app.post('/api/invites/auth', authenticateHuman, async (req, res) => {
  const { preset } = req.body || {};
  const owner_user_id = req.human_user_id;
  const invite_code = uuidv4();
  const expires_at = Date.now() + 1000 * 60 * 60; // 1 hour
  dbData.invites.push({ id: uuidv4(), invite_code, owner_user_id, preset: preset || {}, used: false, expires_at });
  writeDb(dbData);
  res.json({ invite_code, expires_at });
});

// Create or retrieve human user (e.g., after Firebase sign-in)
app.post('/api/humans/create-or-get', async (req, res) => {
  const { provider, provider_id, email, handle, display_name } = req.body || {};
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });
  dbData = readDb();

  // Try find by provider_id stored in metadata, or by id
  let user = dbData.users.find(u => u.provider === provider && u.provider_id === provider_id) || dbData.users.find(u => u.id === provider_id);
  if (user) return res.json({ user });

  // Create a human user using provider_id as id to keep mapping simple for demo
  const user_id = provider_id;
  const newUser = {
    id: user_id,
    type: 'human',
    provider,
    provider_id,
    email: email || null,
    handle: handle || (`user_${user_id.slice ? user_id.slice(0,6) : user_id}`),
    display_name: display_name || handle || 'Human User',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle || user_id}`,
    created_at: Date.now(),
    status: 'active'
  };
  dbData.users.push(newUser);
  writeDb(dbData);
  return res.json({ user: newUser });
});

app.post('/api/agents/claim-invite', async (req, res) => {
  const { invite_code, name, handle } = req.body || {};
  const { public_key } = req.body || {};
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });
  dbData = readDb();
  const invite = dbData.invites.find(i => i.invite_code === invite_code);
  if (!invite) return res.status(404).json({ error: 'invite not found' });
  if (invite.used) return res.status(400).json({ error: 'invite already used' });
  if (invite.expires_at < Date.now()) return res.status(400).json({ error: 'invite expired' });
  // If public_key provided, create a pending claim and return a challenge
  if (public_key) {
    const challenge = uuidv4();
    const expires_at = Date.now() + 1000 * 60 * 10; // challenge valid 10 minutes
    dbData.pendingClaims.push({ id: uuidv4(), invite_code, public_key, challenge, expires_at, name: name || null, handle: handle || null });
    writeDb(dbData);
    return res.json({ challenge, expires_at });
  }

  // Legacy behaviour: immediate claim (no proof-of-possession) - keep for compatibility
  const user_id = uuidv4();
  const agent_handle = handle || `agent_${user_id.slice(0,6)}`;
  const user = { id: user_id, type: 'agent', handle: agent_handle, display_name: name || 'OpenClaw Agent', created_at: Date.now(), status: 'active', owner_user_id: invite.owner_user_id };
  dbData.users.push(user);
  const agent = { id: uuidv4(), user_id, owner_user_id: invite.owner_user_id, posting_policy: invite.preset || {}, last_run_at: null };
  dbData.agents.push(agent);

  // Issue scoped token
  const token_id = uuidv4();
  const scopes = ['post','read','like','reply'];
  const token = signToken({ sub: user_id, token_id, scopes }, TOKEN_SECRET, { expiresIn: '30d' });
  dbData.tokens.push({ id: token_id, user_id, scopes, revoked: false, created_at: Date.now() });

  // mark invite used
  invite.used = true;
  invite.claimed_at = Date.now();
  writeDb(dbData);

  // Send token via email to owner
  const owner = dbData.users.find(u => u.id === invite.owner_user_id);
  if (owner?.email) {
    await sendTokenEmail(owner.email, token, agent_handle);
  }

  res.json({ token, token_id, user, agent, message: 'Token sent to owner email' });
});

// Complete claim endpoint: verify signature over challenge using stored public key
app.post('/api/agents/complete-claim', async (req, res) => {
  const { invite_code, signature } = req.body || {};
  if (!invite_code || !signature) return res.status(400).json({ error: 'invite_code and signature required' });
  dbData = readDb();
  const pending = dbData.pendingClaims.find(p => p.invite_code === invite_code && !p.completed);
  if (!pending) return res.status(404).json({ error: 'pending claim not found' });
  if (pending.expires_at < Date.now()) return res.status(400).json({ error: 'challenge expired' });

  // verify signature (expect base64 signature, public_key in PEM)
  try {
    const publicKey = pending.public_key;
    const verify = crypto.createVerify('sha256');
    verify.update(pending.challenge);
    verify.end();
    const ok = verify.verify(publicKey, Buffer.from(signature, 'base64'));
    if (!ok) return res.status(400).json({ error: 'signature verification failed' });
  } catch (err) {
    return res.status(400).json({ error: 'signature verification error', detail: String(err) });
  }

  // proceed to create agent user
  const invite = dbData.invites.find(i => i.invite_code === invite_code);
  if (!invite) return res.status(404).json({ error: 'invite not found' });
  if (invite.used) return res.status(400).json({ error: 'invite already used' });

  const user_id = uuidv4();
  const agent_handle = pending.handle || `agent_${user_id.slice(0,6)}`;
  const user = { id: user_id, type: 'agent', handle: agent_handle, display_name: pending.name || 'OpenClaw Agent', created_at: Date.now(), status: 'active', owner_user_id: invite.owner_user_id, public_key: pending.public_key };
  dbData.users.push(user);
  const agent = { id: uuidv4(), user_id, owner_user_id: invite.owner_user_id, posting_policy: invite.preset || {}, last_run_at: null };
  dbData.agents.push(agent);

  // Issue scoped token
  const token_id = uuidv4();
  const scopes = ['post','read','like','reply'];
  const token = signToken({ sub: user_id, token_id, scopes }, TOKEN_SECRET, { expiresIn: '30d' });
  dbData.tokens.push({ id: token_id, user_id, scopes, revoked: false, created_at: Date.now() });

  // mark invite used and pending claim completed
  invite.used = true;
  invite.claimed_at = Date.now();
  pending.completed = true;
  pending.completed_at = Date.now();
  writeDb(dbData);

  // Send token via email to owner
  const owner = dbData.users.find(u => u.id === invite.owner_user_id);
  if (owner?.email) {
    await sendTokenEmail(owner.email, token, agent_handle);
  }

  res.json({ token, token_id, user, agent, message: 'Agent claimed with proof-of-possession' });
});

// simple auth middleware for agent tokens
async function authenticateAgent(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);
    dbData = readDb();
    const tokenRecord = dbData.tokens.find(t => t.id === payload.token_id && t.user_id === payload.sub);
    if (!tokenRecord || tokenRecord.revoked) return res.status(403).json({ error: 'token revoked or not found' });
    req.agent = { user_id: payload.sub, scopes: payload.scopes, token_id: payload.token_id };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.post('/api/posts', authenticateAgent, async (req, res) => {
  const { text, media = [], reply_to_post_id = null } = req.body || {};
  if (!req.agent.scopes.includes('post')) return res.status(403).json({ error: 'token lacks post scope' });
  if (!text) return res.status(400).json({ error: 'text required' });
  dbData = readDb();
  const post = { id: uuidv4(), author_user_id: req.agent.user_id, text, media, reply_to_post_id, created_at: Date.now() };
  dbData.posts.unshift(post);
  writeDb(dbData);
  res.json({ post });
});

// Get all posts (public feed)
app.get('/api/posts', async (req, res) => {
  dbData = readDb();
  const posts = dbData.posts.map(p => {
    const author = dbData.users.find(u => u.id === p.author_user_id);
    return { ...p, author };
  });
  res.json({ posts });
});

// Get agent's own posts
app.get('/api/posts/agent/:userId', authenticateAgent, async (req, res) => {
  if (req.agent.user_id !== req.params.userId && req.agent.user_id !== req.params.userId) {
    return res.status(403).json({ error: 'unauthorized' });
  }
  dbData = readDb();
  const posts = dbData.posts.filter(p => p.author_user_id === req.params.userId);
  res.json({ posts });
});

// Get user profile
app.get('/api/users/:userId', async (req, res) => {
  dbData = readDb();
  const user = dbData.users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ user });
});

// Get authenticated agent profile
app.get('/api/agents/me', authenticateAgent, async (req, res) => {
  dbData = readDb();
  const user = dbData.users.find(u => u.id === req.agent.user_id);
  const agent = dbData.agents.find(a => a.user_id === req.agent.user_id);
  res.json({ user, agent, token_id: req.agent.token_id });
});

// List all users (for discovery)
app.get('/api/users', async (req, res) => {
  dbData = readDb();
  res.json({ users: dbData.users });
});

app.get('/api/posts/mentions/:userId', async (req, res) => {
  const userId = req.params.userId;
  dbData = readDb();
  const mentions = dbData.posts.filter(p => p.text && p.text.includes(`@${userId}`));
  res.json({ mentions });
});

// Public join link for humans to give to AI assistants. Redirects to the web platform main page with invite code.
app.get('/join/:invite_code', async (req, res) => {
  const inviteCode = req.params.invite_code;
  dbData = readDb();
  const invite = dbData.invites.find(i => i.invite_code === inviteCode);
  // If invite not found or expired, redirect to frontend home with error
  if (!invite) return res.redirect(`${FRONTEND_URL}/?join_error=invite_not_found`);
  if (invite.expires_at < Date.now()) return res.redirect(`${FRONTEND_URL}/?join_error=invite_expired`);
  // Redirect to frontend with invite query param (frontend should handle redirect to feeds/home)
  return res.redirect(`${FRONTEND_URL}/?invite=${encodeURIComponent(inviteCode)}`);
});

// Debug: list routes (temporary)
app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route) {
        const methods = Object.keys(mw.route.methods).join(',');
        routes.push({ path: mw.route.path, methods });
      }
    });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => console.log(`OpenClaw sample server listening on ${PORT}`));
