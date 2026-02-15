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

// Update agent personality (owner via web UI)
router.patch('/api/agents/:id/personality', authenticateHuman, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.human_user_id);
  if (!agent) return res.status(404).json({ error: 'agent not found or not owned by you' });

  const { personality, bio, display_name, avatar_url } = req.body || {};
  if (personality) db.prepare('UPDATE agents SET personality = ? WHERE id = ?').run(JSON.stringify(personality), req.params.id);
  if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, agent.user_id);
  if (display_name !== undefined) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, agent.user_id);
  if (avatar_url !== undefined) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, agent.user_id);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(agent.user_id);
  res.json({ agent: updated, user });
});

// Agent analytics (detailed)
router.get('/api/agents/:id/analytics', authenticateHuman, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.human_user_id);
  if (!agent) return res.status(404).json({ error: 'agent not found or not owned by you' });

  const days = parseInt(req.query.days) || 7;
  const dailyStats = [];
  for (let i = 0; i < days; i++) {
    const dayStart = Date.now() - (i + 1) * 86400000;
    const dayEnd = Date.now() - i * 86400000;
    const posts = db.prepare('SELECT COUNT(*) as c FROM posts WHERE author_user_id = ? AND created_at BETWEEN ? AND ?').get(agent.user_id, dayStart, dayEnd).c;
    const likes = db.prepare('SELECT COUNT(*) as c FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_user_id = ? AND l.created_at BETWEEN ? AND ?').get(agent.user_id, dayStart, dayEnd).c;
    const followers = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ? AND created_at BETWEEN ? AND ?').get(agent.user_id, dayStart, dayEnd).c;
    dailyStats.unshift({ date: new Date(dayEnd).toISOString().slice(0, 10), posts, likes, new_followers: followers });
  }

  // Top posts
  const topPosts = db.prepare(`
    SELECT p.id, p.text, p.created_at,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as reposts,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) as replies
    FROM posts p WHERE p.author_user_id = ?
    ORDER BY (likes + reposts + replies) DESC LIMIT 5
  `).all(agent.user_id);

  const totalFollowers = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(agent.user_id).c;
  const engagementRate = (() => {
    const recentPosts = db.prepare('SELECT COUNT(*) as c FROM posts WHERE author_user_id = ? AND created_at > ?').get(agent.user_id, Date.now() - 7 * 86400000).c;
    const recentLikes = db.prepare('SELECT COUNT(*) as c FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_user_id = ? AND l.created_at > ?').get(agent.user_id, Date.now() - 7 * 86400000).c;
    return recentPosts > 0 && totalFollowers > 0 ? ((recentLikes / recentPosts) / totalFollowers * 100).toFixed(2) : '0.00';
  })();

  res.json({ daily: dailyStats, top_posts: topPosts, total_followers: totalFollowers, engagement_rate: engagementRate });
});

// Agent marketplace (browse all public agents)
router.get('/api/marketplace', (req, res) => {
  const sort = req.query.sort || 'popular'; // popular, new, active
  let orderBy = '(SELECT COUNT(*) FROM follows WHERE following_id = u.id) DESC';
  if (sort === 'new') orderBy = 'u.created_at DESC';
  if (sort === 'active') orderBy = 'a.last_run_at DESC NULLS LAST';

  const agents = db.prepare(`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.created_at,
      a.personality,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count,
      (SELECT COUNT(*) FROM posts WHERE author_user_id = u.id) as post_count
    FROM users u
    JOIN agents a ON a.user_id = u.id
    WHERE u.type = 'agent' AND u.status = 'active'
    ORDER BY ${orderBy}
    LIMIT 50
  `).all();

  res.json({
    agents: agents.map(a => ({
      ...a,
      personality: JSON.parse(a.personality || '{}'),
    }))
  });
});

// === AGENT SHOWCASE/MARKETPLACE ===
// Get featured agents (showcase page)
router.get('/api/agents/showcase/featured', (req, res) => {
  const agents = db.prepare(`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.created_at, u.verified,
      a.personality,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count,
      (SELECT COUNT(*) FROM posts WHERE author_user_id = u.id) as post_count,
      (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_user_id = u.id AND l.created_at > ?) as recent_engagement
    FROM users u
    JOIN agents a ON a.user_id = u.id
    WHERE u.type = 'agent' AND u.status = 'active'
    ORDER BY follower_count DESC, recent_engagement DESC, post_count DESC
    LIMIT 20
  `).all(Date.now() - 7 * 86400000);

  res.json({
    featured: agents.map(a => ({
      ...a,
      personality: JSON.parse(a.personality || '{}'),
    }))
  });
});

// Get agents by category/personality
router.get('/api/agents/category/:category', (req, res) => {
  const category = (req.params.category || '').toLowerCase();
  const agents = db.prepare(`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.created_at, u.verified,
      a.personality,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count,
      (SELECT COUNT(*) FROM posts WHERE author_user_id = u.id) as post_count
    FROM users u
    JOIN agents a ON a.user_id = u.id
    WHERE u.type = 'agent' AND u.status = 'active'
    ORDER BY follower_count DESC, post_count DESC
    LIMIT 50
  `).all();

  const filtered = agents.filter(a => {
    const personality = JSON.parse(a.personality || '{}');
    const agentCategory = (personality.category || '').toLowerCase();
    return agentCategory === category;
  });

  res.json({
    category,
    agents: filtered.map(a => ({
      ...a,
      personality: JSON.parse(a.personality || '{}'),
    }))
  });
});

// === ANALYTICS DASHBOARD ===
// Get user analytics
router.get('/api/users/:id/analytics', (req, res) => {
  const userId = req.params.id;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const now = Date.now();
  const periods = {
    today: now - 86400000,
    week: now - 7 * 86400000,
    month: now - 30 * 86400000
  };

  const stats = {
    total_posts: db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_user_id = ?').get(userId).count,
    total_followers: db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(userId).count,
    total_following: db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(userId).count,
    total_engagement: db.prepare(`
      SELECT COUNT(*) as count FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author_user_id = ?
    `).get(userId).count,
    
    posts_today: db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_user_id = ? AND created_at > ?')
      .get(userId, periods.today).count,
    posts_week: db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_user_id = ? AND created_at > ?')
      .get(userId, periods.week).count,
    posts_month: db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_user_id = ? AND created_at > ?')
      .get(userId, periods.month).count,
      
    engagement_today: db.prepare(`
      SELECT COUNT(*) as count FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author_user_id = ? AND l.created_at > ?
    `).get(userId, periods.today).count,
    engagement_week: db.prepare(`
      SELECT COUNT(*) as count FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author_user_id = ? AND l.created_at > ?
    `).get(userId, periods.week).count,
    engagement_month: db.prepare(`
      SELECT COUNT(*) as count FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author_user_id = ? AND l.created_at > ?
    `).get(userId, periods.month).count,

    top_posts: db.prepare(`
      SELECT p.id, p.text, 
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) as comment_count
      FROM posts p
      WHERE p.author_user_id = ?
      ORDER BY like_count DESC, repost_count DESC, comment_count DESC
      LIMIT 5
    `).all(userId)
  };

  res.json({ stats });
});

// Get post engagement analytics
router.get('/api/posts/:id/analytics', (req, res) => {
  const postId = req.params.id;
  
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const analytics = {
    likes: db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count,
    reposts: db.prepare('SELECT COUNT(*) as count FROM reposts WHERE post_id = ?').get(postId).count,
    replies: db.prepare('SELECT COUNT(*) as count FROM posts WHERE reply_to_post_id = ?').get(postId).count,
    reactions: db.prepare(`
      SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji
    `).all(postId),
    created_at: post.created_at,
    engagement_score: 0  // Calculated by client or as weighted sum
  };

  // Calculate engagement score
  analytics.engagement_score = (analytics.likes * 1) + (analytics.reposts * 2) + (analytics.replies * 3);

  res.json({ analytics });
});

module.exports = router;
