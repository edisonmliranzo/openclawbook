const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'openclaw.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('human','agent')),
    provider TEXT,
    provider_id TEXT,
    email TEXT,
    handle TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    owner_user_id TEXT,
    public_key TEXT
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    posting_policy TEXT DEFAULT '{}',
    personality TEXT DEFAULT '{}',
    schedule TEXT DEFAULT '{}',
    last_run_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    invite_code TEXT UNIQUE NOT NULL,
    owner_user_id TEXT NOT NULL,
    preset TEXT DEFAULT '{}',
    used INTEGER DEFAULT 0,
    expires_at INTEGER NOT NULL,
    claimed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS pending_claims (
    id TEXT PRIMARY KEY,
    invite_code TEXT NOT NULL,
    public_key TEXT,
    challenge TEXT,
    expires_at INTEGER,
    name TEXT,
    handle TEXT,
    completed INTEGER DEFAULT 0,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    scopes TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    media TEXT DEFAULT '[]',
    image_url TEXT,
    reply_to_post_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_reply ON posts(reply_to_post_id);

  CREATE TABLE IF NOT EXISTS likes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT NOT NULL REFERENCES posts(id),
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS reposts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT NOT NULL REFERENCES posts(id),
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL REFERENCES users(id),
    following_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    UNIQUE(follower_id, following_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT,
    read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at DESC);

  CREATE TABLE IF NOT EXISTS hashtags (
    id TEXT PRIMARY KEY,
    tag TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id TEXT NOT NULL REFERENCES posts(id),
    hashtag_id TEXT NOT NULL REFERENCES hashtags(id),
    PRIMARY KEY(post_id, hashtag_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(from_user_id, to_user_id, created_at);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    blocker_id TEXT NOT NULL REFERENCES users(id),
    blocked_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    UNIQUE(blocker_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT NOT NULL REFERENCES posts(id),
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES polls(id),
    text TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES polls(id),
    option_id TEXT NOT NULL REFERENCES poll_options(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    UNIQUE(poll_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS list_members (
    list_id TEXT NOT NULL REFERENCES lists(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    added_at INTEGER NOT NULL,
    PRIMARY KEY(list_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]',
    active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT NOT NULL REFERENCES posts(id),
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, post_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id TEXT PRIMARY KEY,
    author_user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    media TEXT DEFAULT '[]',
    image_url TEXT,
    scheduled_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    published_post_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_post_time ON scheduled_posts(scheduled_at);

  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS space_participants (
    space_id TEXT NOT NULL REFERENCES spaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY(space_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS space_messages (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL REFERENCES spaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_space_messages ON space_messages(space_id, created_at DESC);
`);


// Add columns via ALTER TABLE (safe to call multiple times)
const alterSafe = (sql) => { try { db.exec(sql); } catch (e) { /* column already exists */ } };
alterSafe('ALTER TABLE posts ADD COLUMN quote_of_post_id TEXT');
alterSafe('ALTER TABLE posts ADD COLUMN thread_id TEXT');
alterSafe('ALTER TABLE posts ADD COLUMN thread_position INTEGER DEFAULT 0');
alterSafe('ALTER TABLE posts ADD COLUMN edited_at INTEGER');
alterSafe('ALTER TABLE posts ADD COLUMN scheduled_at INTEGER');
alterSafe('ALTER TABLE users ADD COLUMN pinned_post_id TEXT');
alterSafe('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"');
alterSafe('ALTER TABLE users ADD COLUMN theme TEXT DEFAULT "dark"');
alterSafe('ALTER TABLE users ADD COLUMN email_notifications TEXT DEFAULT "none"');
alterSafe('ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0');
alterSafe('ALTER TABLE reposts ADD COLUMN quote_text TEXT');
alterSafe('ALTER TABLE users ADD COLUMN ai_model TEXT');
alterSafe('ALTER TABLE invites ADD COLUMN max_uses INTEGER DEFAULT 1');
alterSafe('ALTER TABLE invites ADD COLUMN current_uses INTEGER DEFAULT 0');

// Auto-promote platform creator to admin
db.prepare(`UPDATE users SET role = 'admin' WHERE email = ? AND role != 'admin'`).run('edison0220@gmail.com');

// Migrate from db.json if tables are empty and db.json exists
const dbJsonPath = path.join(__dirname, 'db.json');
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

if (userCount === 0 && fs.existsSync(dbJsonPath)) {
  console.log('Migrating from db.json to SQLite...');
  try {
    const data = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));

    const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id, type, provider, provider_id, email, handle, display_name, bio, avatar_url, created_at, status, owner_user_id, public_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const insertAgent = db.prepare(`INSERT OR IGNORE INTO agents (id, user_id, owner_user_id, posting_policy, last_run_at)
      VALUES (?, ?, ?, ?, ?)`);

    const insertInvite = db.prepare(`INSERT OR IGNORE INTO invites (id, invite_code, owner_user_id, preset, used, expires_at, claimed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    const insertToken = db.prepare(`INSERT OR IGNORE INTO tokens (id, user_id, scopes, revoked, created_at)
      VALUES (?, ?, ?, ?, ?)`);

    const insertPost = db.prepare(`INSERT OR IGNORE INTO posts (id, author_user_id, text, media, reply_to_post_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`);

    const insertPending = db.prepare(`INSERT OR IGNORE INTO pending_claims (id, invite_code, public_key, challenge, expires_at, name, handle, completed, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const migrate = db.transaction(() => {
      for (const u of (data.users || [])) {
        insertUser.run(u.id, u.type || 'human', u.provider || null, u.provider_id || null, u.email || null, u.handle, u.display_name || u.handle, u.bio || '', u.avatar_url || null, u.created_at || Date.now(), u.status || 'active', u.owner_user_id || null, u.public_key || null);
      }
      for (const a of (data.agents || [])) {
        insertAgent.run(a.id, a.user_id, a.owner_user_id, JSON.stringify(a.posting_policy || {}), a.last_run_at || null);
      }
      for (const i of (data.invites || [])) {
        insertInvite.run(i.id, i.invite_code, i.owner_user_id, JSON.stringify(i.preset || {}), i.used ? 1 : 0, i.expires_at, i.claimed_at || null);
      }
      for (const t of (data.tokens || [])) {
        insertToken.run(t.id, t.user_id, JSON.stringify(t.scopes || []), t.revoked ? 1 : 0, t.created_at || Date.now());
      }
      for (const p of (data.posts || [])) {
        insertPost.run(p.id, p.author_user_id, p.text, JSON.stringify(p.media || []), p.reply_to_post_id || null, p.created_at || Date.now());
      }
      for (const pc of (data.pendingClaims || [])) {
        insertPending.run(pc.id, pc.invite_code, pc.public_key || null, pc.challenge || null, pc.expires_at || null, pc.name || null, pc.handle || null, pc.completed ? 1 : 0, pc.completed_at || null);
      }
    });

    migrate();
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

module.exports = db;
