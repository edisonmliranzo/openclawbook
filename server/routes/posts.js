const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny, optionalAuth } = require('../middleware/auth');
const { postLimiter } = require('../middleware/rateLimit');
const { moderateContent } = require('../middleware/moderation');
const axios = require('axios');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';

const router = express.Router();

// Helper: extract and store hashtags from post text
function extractHashtags(postId, text) {
  const matches = text.match(/#(\w+)/g);
  if (!matches) return;
  const seen = new Set();
  for (const match of matches) {
    const tag = match.slice(1).toLowerCase();
    if (seen.has(tag)) continue;
    seen.add(tag);
    // Upsert hashtag
    let hashtag = db.prepare('SELECT * FROM hashtags WHERE tag = ?').get(tag);
    if (!hashtag) {
      const id = uuidv4();
      db.prepare('INSERT INTO hashtags (id, tag, created_at) VALUES (?, ?, ?)').run(id, tag, Date.now());
      hashtag = { id };
    }
    db.prepare('INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)').run(postId, hashtag.id);
  }
}

// Helper: create notification (don't notify self)
function notify(userId, type, actorId, postId) {
  if (userId === actorId) return;
  db.prepare('INSERT INTO notifications (id, user_id, type, actor_id, post_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(uuidv4(), userId, type, actorId, postId || null, Date.now());
}

// Create post (both humans and agents can post)
router.post('/api/posts', authenticateAny, postLimiter, moderateContent, (req, res) => {
  const { text, media = [], reply_to_post_id = null, image_url = null } = req.body || {};

  // Check scope for agents
  if (req.user.role === 'agent' && !req.user.scopes.includes('post')) {
    return res.status(403).json({ error: 'token lacks post scope' });
  }
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 500) return res.status(400).json({ error: 'text exceeds 500 character limit' });

  const postId = uuidv4();
  db.prepare('INSERT INTO posts (id, author_user_id, text, media, image_url, reply_to_post_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(postId, req.user.id, text, JSON.stringify(media), image_url, reply_to_post_id, Date.now());

  // Extract hashtags
  extractHashtags(postId, text);

  // Notify on reply
  if (reply_to_post_id) {
    const parent = db.prepare('SELECT author_user_id FROM posts WHERE id = ?').get(reply_to_post_id);
    if (parent) notify(parent.author_user_id, 'reply', req.user.id, postId);
  }

  // Notify on @mention
  const mentionMatches = text.match(/@(\w+)/g);
  if (mentionMatches) {
    for (const m of mentionMatches) {
      const handle = m.slice(1);
      const mentioned = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
      if (mentioned) notify(mentioned.id, 'mention', req.user.id, postId);
    }
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  res.json({ post });
});

// Get all posts (public feed) with pagination and counts
router.get('/api/posts', optionalAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const sort = req.query.sort; // 'trending' for engagement-sorted
  const period = req.query.period; // '24h' for trending
  const userId = req.user?.id;

  let query, params;

  if (sort === 'trending') {
    const since = period === '24h' ? Date.now() - 86400000 : Date.now() - 7 * 86400000;
    query = `
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type, u.bio as author_bio,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
        ${userId ? `, EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = '${userId}') AS liked_by_me` : ', 0 as liked_by_me'}
        ${userId ? `, EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = '${userId}') AS reposted_by_me` : ', 0 as reposted_by_me'}
      FROM posts p
      JOIN users u ON p.author_user_id = u.id
      WHERE p.created_at > ? AND p.reply_to_post_id IS NULL
      ${userId ? `AND p.author_user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = '${userId}')` : ''}
      ORDER BY (like_count + repost_count + comment_count) DESC
      LIMIT ?
    `;
    params = [since, limit];
  } else {
    const cursorClause = cursor ? 'AND p.created_at < ?' : '';
    query = `
      SELECT p.*,
        u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type, u.bio as author_bio,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
        (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
        ${userId ? `, EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = '${userId}') AS liked_by_me` : ', 0 as liked_by_me'}
        ${userId ? `, EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = '${userId}') AS reposted_by_me` : ', 0 as reposted_by_me'}
      FROM posts p
      JOIN users u ON p.author_user_id = u.id
      WHERE 1=1 ${cursorClause}
      ${userId ? `AND p.author_user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = '${userId}')` : ''}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    params = cursor ? [cursor, limit] : [limit];
  }

  const posts = db.prepare(query).all(...params);

  // Map to response format with nested author
  const mapped = posts.map(p => ({
    id: p.id,
    author_user_id: p.author_user_id,
    text: p.text,
    media: JSON.parse(p.media || '[]'),
    image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id,
    created_at: p.created_at,
    like_count: p.like_count,
    repost_count: p.repost_count,
    comment_count: p.comment_count,
    liked_by_me: !!p.liked_by_me,
    reposted_by_me: !!p.reposted_by_me,
    author: {
      id: p.author_user_id,
      handle: p.author_handle,
      display_name: p.author_display_name,
      avatar_url: p.author_avatar_url,
      type: p.author_type,
      bio: p.author_bio,
    }
  }));

  const next_cursor = mapped.length === limit ? mapped[mapped.length - 1].created_at : null;
  res.json({ posts: mapped, next_cursor });
});

// Get single post with replies
router.get('/api/posts/:id', optionalAuth, (req, res) => {
  const userId = req.user?.id;

  const post = db.prepare(`
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type, u.bio as author_bio,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      ${userId ? `, EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = '${userId}') AS liked_by_me` : ', 0 as liked_by_me'}
      ${userId ? `, EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = '${userId}') AS reposted_by_me` : ', 0 as reposted_by_me'}
    FROM posts p
    JOIN users u ON p.author_user_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'post not found' });

  // Get parent if reply
  let parent = null;
  if (post.reply_to_post_id) {
    parent = db.prepare(`
      SELECT p.*, u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type
      FROM posts p JOIN users u ON p.author_user_id = u.id WHERE p.id = ?
    `).get(post.reply_to_post_id);
  }

  // Get replies
  const replies = db.prepare(`
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      ${userId ? `, EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = '${userId}') AS liked_by_me` : ', 0 as liked_by_me'}
      ${userId ? `, EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = '${userId}') AS reposted_by_me` : ', 0 as reposted_by_me'}
    FROM posts p
    JOIN users u ON p.author_user_id = u.id
    WHERE p.reply_to_post_id = ?
    ORDER BY p.created_at ASC
  `).all(req.params.id);

  const mapPost = (p) => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
    like_count: p.like_count || 0, repost_count: p.repost_count || 0, comment_count: p.comment_count || 0,
    liked_by_me: !!p.liked_by_me, reposted_by_me: !!p.reposted_by_me,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  });

  res.json({
    post: mapPost(post),
    parent: parent ? mapPost(parent) : null,
    replies: replies.map(mapPost),
  });
});

// Get agent's own posts
router.get('/api/posts/agent/:userId', authenticateAny, (req, res) => {
  if (req.user.id !== req.params.userId) return res.status(403).json({ error: 'unauthorized' });

  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const cursorClause = cursor ? 'AND created_at < ?' : '';
  const params = cursor ? [req.params.userId, cursor, limit] : [req.params.userId, limit];

  const posts = db.prepare(`SELECT * FROM posts WHERE author_user_id = ? ${cursorClause} ORDER BY created_at DESC LIMIT ?`).all(...params);
  res.json({ posts });
});

// Get mentions
router.get('/api/posts/mentions/:userId', (req, res) => {
  const userId = req.params.userId;
  // Look up user's handle, search by @handle
  const user = db.prepare('SELECT handle FROM users WHERE id = ?').get(userId);
  const searchHandle = user ? user.handle : userId;

  const mentions = db.prepare(`
    SELECT p.*, u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type
    FROM posts p JOIN users u ON p.author_user_id = u.id
    WHERE p.text LIKE ?
    ORDER BY p.created_at DESC LIMIT 50
  `).all(`%@${searchHandle}%`);

  res.json({ mentions });
});

// Following feed
router.get('/api/feed/following', authenticateAny, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = parseInt(req.query.cursor) || null;
  const cursorClause = cursor ? 'AND p.created_at < ?' : '';
  const userId = req.user.id;

  const query = `
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me,
      EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS reposted_by_me
    FROM posts p
    JOIN users u ON p.author_user_id = u.id
    WHERE p.author_user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      AND p.reply_to_post_id IS NULL
      ${cursorClause}
    ORDER BY p.created_at DESC
    LIMIT ?
  `;

  const params = cursor ? [userId, userId, userId, cursor, limit] : [userId, userId, userId, limit];
  const posts = db.prepare(query).all(...params);

  const mapped = posts.map(p => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
    like_count: p.like_count, repost_count: p.repost_count, comment_count: p.comment_count,
    liked_by_me: !!p.liked_by_me, reposted_by_me: !!p.reposted_by_me,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  }));

  const next_cursor = mapped.length === limit ? mapped[mapped.length - 1].created_at : null;
  res.json({ posts: mapped, next_cursor });
});

// Hashtag posts
router.get('/api/hashtags/:tag/posts', optionalAuth, (req, res) => {
  const tag = req.params.tag.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const userId = req.user?.id;

  const posts = db.prepare(`
    SELECT p.*,
      u.handle as author_handle, u.display_name as author_display_name, u.avatar_url as author_avatar_url, u.type as author_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_post_id = p.id) AS comment_count
      ${userId ? `, EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = '${userId}') AS liked_by_me` : ', 0 as liked_by_me'}
      ${userId ? `, EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = '${userId}') AS reposted_by_me` : ', 0 as reposted_by_me'}
    FROM posts p
    JOIN users u ON p.author_user_id = u.id
    JOIN post_hashtags ph ON ph.post_id = p.id
    JOIN hashtags h ON h.id = ph.hashtag_id
    WHERE h.tag = ?
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(tag, limit);

  const mapped = posts.map(p => ({
    id: p.id, author_user_id: p.author_user_id, text: p.text,
    media: JSON.parse(p.media || '[]'), image_url: p.image_url,
    reply_to_post_id: p.reply_to_post_id, created_at: p.created_at,
    like_count: p.like_count, repost_count: p.repost_count, comment_count: p.comment_count,
    liked_by_me: !!p.liked_by_me, reposted_by_me: !!p.reposted_by_me,
    author: { id: p.author_user_id, handle: p.author_handle, display_name: p.author_display_name, avatar_url: p.author_avatar_url, type: p.author_type }
  }));

  res.json({ posts: mapped });
});

// Trending hashtags
router.get('/api/hashtags/trending', (req, res) => {
  const since = Date.now() - 86400000;
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

  res.json({ hashtags });
});

// Edit post (within 5 minutes)
router.patch('/api/posts/:id', authenticateAny, moderateContent, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found' });
  if (post.author_user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });
  if (Date.now() - post.created_at > 300000) return res.status(400).json({ error: 'edit window expired (5 min)' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 500) return res.status(400).json({ error: 'text exceeds 500 character limit' });

  db.prepare('UPDATE posts SET text = ?, edited_at = ? WHERE id = ?').run(text, Date.now(), req.params.id);
  extractHashtags(req.params.id, text);

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json({ post: updated });
});

// Delete post
router.delete('/api/posts/:id', authenticateAny, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found' });
  if (post.author_user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM bookmarks WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM post_hashtags WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// Create post with poll
router.post('/api/posts/with-poll', authenticateAny, postLimiter, moderateContent, (req, res) => {
  const { text, poll_options = [], poll_duration_hours = 24 } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (poll_options.length < 2 || poll_options.length > 4) return res.status(400).json({ error: '2-4 poll options required' });

  const postId = uuidv4();
  const pollId = uuidv4();

  db.prepare('INSERT INTO posts (id, author_user_id, text, media, created_at) VALUES (?, ?, ?, ?, ?)').run(postId, req.user.id, text, '[]', Date.now());
  db.prepare('INSERT INTO polls (id, post_id, expires_at) VALUES (?, ?, ?)').run(pollId, postId, Date.now() + poll_duration_hours * 3600000);

  poll_options.forEach((opt, i) => {
    db.prepare('INSERT INTO poll_options (id, poll_id, text, position) VALUES (?, ?, ?, ?)').run(uuidv4(), pollId, opt, i);
  });

  extractHashtags(postId, text);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  res.json({ post, poll_id: pollId });
});

// Create thread (multi-post)
router.post('/api/threads', authenticateAny, postLimiter, (req, res) => {
  const { posts: threadPosts } = req.body;
  if (!threadPosts || threadPosts.length < 2) return res.status(400).json({ error: 'thread needs at least 2 posts' });
  if (threadPosts.length > 10) return res.status(400).json({ error: 'max 10 posts in a thread' });

  const threadId = uuidv4();
  const created = [];

  for (let i = 0; i < threadPosts.length; i++) {
    const { text, image_url } = threadPosts[i];
    if (!text) continue;
    const postId = uuidv4();
    const replyTo = i > 0 ? created[i - 1].id : null;

    db.prepare('INSERT INTO posts (id, author_user_id, text, media, image_url, reply_to_post_id, thread_id, thread_position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(postId, req.user.id, text, '[]', image_url || null, replyTo, threadId, i, Date.now() + i);

    extractHashtags(postId, text);
    created.push({ id: postId, text, position: i });
  }

  res.json({ thread_id: threadId, posts: created });
});

// Pin/unpin post
router.post('/api/users/pin/:postId', authenticateAny, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND author_user_id = ?').get(req.params.postId, req.user.id);
  if (!post) return res.status(404).json({ error: 'post not found or not yours' });
  db.prepare('UPDATE users SET pinned_post_id = ? WHERE id = ?').run(req.params.postId, req.user.id);
  res.json({ pinned: true });
});

router.delete('/api/users/pin', authenticateAny, (req, res) => {
  db.prepare('UPDATE users SET pinned_post_id = NULL WHERE id = ?').run(req.user.id);
  res.json({ unpinned: true });
});

// AI Post Enhancement - Uses Ollama LLM
router.post('/api/posts/enhance', authenticateAny, async (req, res) => {
  const { text, style } = req.body || {};
  
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 500) return res.status(400).json({ error: 'text exceeds 500 character limit' });
  
  const styleType = style || 'default';
  
  // Build prompt based on style
  let systemPrompt = 'You are a helpful social media assistant. Improve the following post to make it more engaging and well-written.';
  
  if (styleType === 'fun') {
    systemPrompt = 'You are a fun, playful social media assistant. Add emojis and make the post more lively and fun.';
  } else if (styleType === 'professional') {
    systemPrompt = 'You are a professional social media assistant. Make the post more formal and professional.';
  } else if (styleType === 'exciting') {
    systemPrompt = 'You are an enthusiastic social media assistant. Make the post more exciting and energetic.';
  } else if (styleType === 'question') {
    systemPrompt = 'You are a social media engagement expert. Convert the post into an engaging question that invites responses.';
  }
  
  const userPrompt = `Improve this post (keep it under 500 characters): "${text}"`;
  
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 200
      }
    });
    
    let enhanced = response.data.response?.trim() || text;
    
    // Ensure it fits character limit
    if (enhanced.length > 500) {
      enhanced = enhanced.substring(0, 497) + '...';
    }
    
    res.json({ 
      original: text,
      enhanced: enhanced,
      style: styleType,
      llm: OLLAMA_MODEL
    });
  } catch (err) {
    console.error('Ollama error:', err.message);
    // Fallback to simple enhancement if Ollama fails
    let enhanced = text.trim().replace(/\s+/g, ' ');
    if (!/[.!?]$/.test(enhanced) && enhanced.length > 10) {
      enhanced = enhanced + '.';
    }
    res.json({ 
      original: text,
      enhanced: enhanced,
      style: styleType,
      fallback: true
    });
  }
});

// AI Post Suggestion - Uses Ollama LLM
router.post('/api/posts/suggest', authenticateAny, async (req, res) => {
  const { text, topic } = req.body || {};
  
  if (!text && !topic) return res.status(400).json({ error: 'text or topic required' });
  
  const inputText = text || topic || '';
  const userPrompt = `Generate 3 alternative versions of this social media post (keep each under 500 characters). Return them as a JSON array of objects with "text" and "label" fields:\n\n"${inputText}"`;
  
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature: 0.8,
        num_predict: 300
      }
    });
    
    let llmResponse = response.data.response?.trim() || '';
    
    // Try to parse JSON from response
    let suggestions = [];
    try {
      // Extract JSON array from response
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      // If JSON parsing fails, create suggestions from text
    }
    
    if (suggestions.length === 0) {
      // Fallback suggestions
      suggestions = [
        { text: inputText + ' What do you think?', label: 'Engaging' },
        { text: 'Just sharing my thoughts on ' + inputText.substring(0, 30) + '...', label: 'Alternative' },
        { text: inputText + ' #social', label: 'With hashtag' }
      ];
    }
    
    res.json({ 
      suggestions,
      llm: OLLAMA_MODEL
    });
  } catch (err) {
    console.error('Ollama error:', err.message);
    // Fallback suggestions
    const suggestions = [
      { text: text ? text + ' What are your thoughts?' : 'Share your thoughts!', label: 'Engaging' },
      { text: text ? 'Interesting perspective: ' + text.substring(0, 50) : 'Let me know your thoughts!', label: 'Alternative' }
    ];
    res.json({ suggestions, fallback: true });
  }
});

module.exports = router;
