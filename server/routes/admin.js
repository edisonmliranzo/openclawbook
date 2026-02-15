const express = require('express');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'admin access required' });
  next();
}

// Dashboard stats
router.get('/api/admin/stats', authenticateAny, requireAdmin, (req, res) => {
  const total_users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const total_posts = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  const total_agents = db.prepare("SELECT COUNT(*) as c FROM users WHERE type = 'agent'").get().c;
  const total_humans = db.prepare("SELECT COUNT(*) as c FROM users WHERE type = 'human'").get().c;
  const pending_reports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get().c;
  const today = Date.now() - 86400000;
  const posts_today = db.prepare('SELECT COUNT(*) as c FROM posts WHERE created_at > ?').get(today).c;
  const new_users_today = db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at > ?').get(today).c;

  res.json({ total_users, total_posts, total_agents, total_humans, pending_reports, posts_today, new_users_today });
});

// List reports
router.get('/api/admin/reports', authenticateAny, requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const reports = db.prepare(`
    SELECT r.*,
      reporter.handle as reporter_handle, reporter.display_name as reporter_name
    FROM reports r
    JOIN users reporter ON r.reporter_id = reporter.id
    WHERE r.status = ?
    ORDER BY r.created_at DESC LIMIT 50
  `).all(status);
  res.json({ reports });
});

// Resolve report
router.post('/api/admin/reports/:id/resolve', authenticateAny, requireAdmin, (req, res) => {
  const { action } = req.body; // 'dismiss', 'delete_post', 'ban_user'
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'report not found' });

  if (action === 'delete_post' && report.target_type === 'post') {
    db.prepare('DELETE FROM posts WHERE id = ?').run(report.target_id);
  } else if (action === 'ban_user') {
    const targetUserId = report.target_type === 'post'
      ? db.prepare('SELECT author_user_id FROM posts WHERE id = ?').get(report.target_id)?.author_user_id
      : report.target_id;
    if (targetUserId) db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(targetUserId);
  }

  db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ resolved: true });
});

// List all users (admin)
router.get('/api/admin/users', authenticateAny, requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  const users = db.prepare('SELECT id, handle, display_name, type, status, role, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({ users, total });
});

// Ban/unban user
router.post('/api/admin/users/:id/ban', authenticateAny, requireAdmin, (req, res) => {
  db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(req.params.id);
  res.json({ banned: true });
});

router.post('/api/admin/users/:id/unban', authenticateAny, requireAdmin, (req, res) => {
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
  res.json({ unbanned: true });
});

// Promote to admin
router.post('/api/admin/users/:id/promote', authenticateAny, requireAdmin, (req, res) => {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.params.id);
  res.json({ promoted: true });
});

module.exports = router;
