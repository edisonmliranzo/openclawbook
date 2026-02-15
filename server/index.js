const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables, runs migration from db.json if needed)
require('./db');

// Import routes
const { router: authRouter, setWsBroadcast } = require('./routes/auth');
const agentsRouter = require('./routes/agents');
const postsRouter = require('./routes/posts');
const usersRouter = require('./routes/users');
const likesRouter = require('./routes/likes');
const followsRouter = require('./routes/follows');
const notificationsRouter = require('./routes/notifications');
const searchRouter = require('./routes/search');
const messagesRouter = require('./routes/messages');
const moderationRouter = require('./routes/moderation');
const tokensRouter = require('./routes/tokens');
const uploadRouter = require('./routes/upload');
const bookmarksRouter = require('./routes/bookmarks');
const pollsRouter = require('./routes/polls');
const listsRouter = require('./routes/lists');
const adminRouter = require('./routes/admin');
const webhooksRouter = require('./routes/webhooksRoute');

// Import middleware
const { generalLimiter } = require('./middleware/rateLimit');
const { setupWebSocket } = require('./websocket');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 4001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176']
    : true,
  credentials: true,
}));

app.use(bodyParser.json());
app.use(generalLimiter);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount all routes
app.use(authRouter);
app.use(agentsRouter);
app.use(postsRouter);
app.use(usersRouter);
app.use(likesRouter);
app.use(followsRouter);
app.use(notificationsRouter);
app.use(searchRouter);
app.use(messagesRouter);
app.use(moderationRouter);
app.use(tokensRouter);
app.use(uploadRouter);
app.use(bookmarksRouter);
app.use(pollsRouter);
app.use(listsRouter);
app.use(adminRouter);
app.use(webhooksRouter);

// Public join link redirect
app.get('/join/:invite_code', (req, res) => {
  const db = require('./db');
  const invite = db.prepare('SELECT * FROM invites WHERE invite_code = ?').get(req.params.invite_code);
  if (!invite) return res.redirect(`${FRONTEND_URL}/?join_error=invite_not_found`);
  if (invite.expires_at < Date.now()) return res.redirect(`${FRONTEND_URL}/?join_error=invite_expired`);
  return res.redirect(`${FRONTEND_URL}/?invite=${encodeURIComponent(req.params.invite_code)}`);
});

// Production: serve frontend static files
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // SPA fallback — must come after all API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Debug: list routes
app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route) {
        routes.push({ path: mw.route.path, methods: Object.keys(mw.route.methods).join(',') });
      } else if (mw.name === 'router') {
        mw.handle.stack.forEach(handler => {
          if (handler.route) {
            routes.push({ path: handler.route.path, methods: Object.keys(handler.route.methods).join(',') });
          }
        });
      }
    });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Start server with WebSocket support
const server = app.listen(PORT, () => console.log(`OpenClaw server listening on ${PORT}`));
const ws = setupWebSocket(server);

// Make ws available to routes via app.locals
app.locals.ws = ws;

// Wire WebSocket broadcast into auth routes for agent_joined events
setWsBroadcast(ws.broadcast);

// Seed demo invite codes (idempotent)
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const demoCodes = [
  { code: 'OPENCLAW-ALPHA-2024', max_uses: 1 },
  { code: 'AI-ASSISTANT-BETA', max_uses: 10 },
  { code: 'NEURAL-NETWORK-2024', max_uses: 50 },
];

for (const demo of demoCodes) {
  const existing = db.prepare('SELECT id FROM invites WHERE invite_code = ?').get(demo.code);
  if (!existing) {
    db.prepare('INSERT INTO invites (id, invite_code, owner_user_id, preset, used, expires_at, max_uses, current_uses) VALUES (?, ?, ?, ?, 0, ?, ?, 0)')
      .run(uuidv4(), demo.code, 'system', '{}', Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, demo.max_uses);
    console.log(`Seeded demo invite code: ${demo.code} (${demo.max_uses} uses)`);
  }
}

module.exports = { app, server, ws };
