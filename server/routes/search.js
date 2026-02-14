const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Search posts and users
router.get('/api/search', optionalAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  const type = req.query.type || 'all'; // 'posts', 'users', 'all'
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  if (!q) return res.json({ posts: [], users: [] });

  let posts = [];
  let users = [];

  if (type === 'all' || type === 'posts') {
    posts = db.prepare(`
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      FROM posts p
      JOIN users u ON p.author_user_id = u.id
      WHERE p.text LIKE ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(`%${q}%`, limit);

    posts = posts.map(p => ({
      id: p.id, author_user_id: p.author_user_id, text: p.text,
      media: JSON.parse(p.media || '[]'), image_url: p.image_url,
      reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
      like_count: p.like_count, repost_count: p.repost_count, comment_count: p.comment_count,
      liked_by_me: false, reposted_by_me: false,
      author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
    }));
  }

  if (type === 'all' || type === 'users') {
    users = db.prepare(`
      SELECT * FROM users
      WHERE (handle LIKE ? OR display_name LIKE ?) AND status = 'active'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(`%${q}%`, `%${q}%`, limit);
  }

  res.json({ posts, users });
});

// Trending topics
let trendingCache = null;
let trendingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/api/trending', (req, res) => {
  if (trendingCache && Date.now() - trendingCacheTime < CACHE_TTL) {
    return res.json(trendingCache);
  }

  const since = Date.now() - 86400000; // 24 hours

  // Get trending hashtags
  const hashtags = db.prepare(`
    SELECT h.tag, COUNT(ph.post_id) as post_count
    FROM hashtags h
    JOIN post_hashtags ph ON h.id = ph.hashtag_id
    JOIN posts p ON ph.post_id = p.id
    WHERE p.created_at > ?
    GROUP BY h.id
    ORDER BY post_count DESC
    LIMIT 10
  `).all(since);

  // Simple word frequency from recent posts
  const recentPosts = db.prepare('SELECT text FROM posts WHERE created_at > ? LIMIT 200').all(since);
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','that','this','what','which','who','whom','these','those','i','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their','am','about','up','like']);

  const wordCounts = {};
  for (const post of recentPosts) {
    const words = post.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    for (const word of words) {
      if (word.length < 3 || stopWords.has(word)) continue;
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }

  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, post_count]) => ({ label, post_count, category: 'topic' }));

  const topics = [
    ...hashtags.map(h => ({ label: `#${h.tag}`, post_count: h.post_count, category: 'hashtag' })),
    ...topWords,
  ];

  trendingCache = { topics };
  trendingCacheTime = Date.now();

  res.json({ topics });
});

module.exports = router;
