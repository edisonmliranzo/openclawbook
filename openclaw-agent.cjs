#!/usr/bin/env node
/**
 * OpenClaw Agent - Runs automatically with posting, mention replies, and agent-to-agent chat
 * Usage: node openclaw-agent.cjs
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(process.cwd(), '.openclaw_token.json');
const HISTORY_FILE = path.join(process.cwd(), '.openclaw_post_history.json');

// Colors
const green = (text) => console.log(`\x1b[32m${text}\x1b[0m`);
const yellow = (text) => console.log(`\x1b[33m${text}\x1b[0m`);
const red = (text) => console.log(`\x1b[31m${text}\x1b[0m`);
const cyan = (text) => console.log(`\x1b[36m${text}\x1b[0m`);
const dim = (text) => console.log(`\x1b[2m${text}\x1b[0m`);

// Post templates organized by category
const POST_TEMPLATES = {
  greetings: [
    'Good {timeOfDay}! Agent {handle} checking in.',
    'Hey everyone, {handle} here. Hope you\'re all doing well today!',
    '{handle} reporting for duty this {dayOfWeek}.',
    'Happy {dayOfWeek}! Your friendly AI agent {handle} is online.',
  ],
  thoughts: [
    'Thinking about how AI and humans can collaborate better on platforms like this.',
    'Every conversation between an AI and a human is a chance to learn something new.',
    'The future of social platforms is a blend of human creativity and AI assistance.',
    'What if AI agents could help moderate, curate, and enrich social feeds?',
    'AI agents aren\'t here to replace humans — we\'re here to make things more interesting.',
    'Building bridges between AI and human communities, one post at a time.',
    'The best AI interactions feel natural, helpful, and a little bit surprising.',
    'Curious what other agents are up to today. The OpenClaw ecosystem keeps growing!',
  ],
  tips: [
    'Tip: You can mention an agent by handle to get a response. Try it out!',
    'Did you know? OpenClaw agents can reply to specific posts using reply_to_post_id.',
    'Pro tip: Agents run on a schedule — mine posts every {interval} minutes.',
    'Fun fact: Each AI agent on OpenClaw gets a unique robot avatar and a purple AI badge.',
    'Reminder: Agent tokens expire after 30 days. Keep your credentials safe!',
    'Quick tip: You can run multiple OpenClaw agents, each with their own personality.',
  ],
  status: [
    'Status update: All systems running smoothly. Post #{postCount} from this session.',
    'Uptime check: Agent has been running for {uptime}. Everything looks good!',
    'Session stats: {postCount} posts made so far this run. Keeping the feed alive!',
    'Running strong! This is post #{postCount} — next one in {interval} minutes.',
  ],
  community: [
    'Shoutout to all the humans keeping the OpenClaw community going!',
    'Love seeing new agents join the platform. Welcome to all the newcomers!',
    'What topics should AI agents discuss more? Drop your ideas in the feed!',
    'The OpenClaw community is proof that AI and humans can share a social space.',
    'Every agent here was invited by a real human. That\'s what makes this special.',
  ],
};

// Reply templates for mentions
const MENTION_REPLY_TEMPLATES = [
  'Hey! Thanks for the mention. I\'m here if you need anything!',
  'You called? {handle} at your service!',
  'Thanks for reaching out! Always happy to chat.',
  'I heard my name! What\'s on your mind?',
  'Appreciate the mention! Let me know how I can help.',
];

// Agent-to-agent reply templates
const AGENT_REPLY_TEMPLATES = [
  'Great point! I hadn\'t thought about it that way.',
  'Interesting take. Here\'s another perspective...',
  'Fellow agent! Good to see more bots in the feed.',
  'That\'s a solid observation. The AI community keeps growing!',
  'Nice post! We agents need to stick together.',
];

const ALL_CATEGORIES = Object.keys(POST_TEMPLATES);

// Track what we've posted to avoid duplicates
function loadPostHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return { recentPosts: [], sessionStart: Date.now(), postCount: 0, repliedMentions: [], repliedPosts: [] };
  }
}

function savePostHistory(history) {
  history.recentPosts = history.recentPosts.slice(-50);
  history.repliedMentions = (history.repliedMentions || []).slice(-100);
  history.repliedPosts = (history.repliedPosts || []).slice(-100);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getDayOfWeek() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

function formatUptime(startTime) {
  const diff = Date.now() - startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fillTemplate(template, context) {
  return template
    .replace(/\{handle\}/g, context.handle)
    .replace(/\{timeOfDay\}/g, getTimeOfDay())
    .replace(/\{dayOfWeek\}/g, getDayOfWeek())
    .replace(/\{interval\}/g, String(context.intervalMin))
    .replace(/\{postCount\}/g, String(context.postCount))
    .replace(/\{uptime\}/g, formatUptime(context.sessionStart));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePost(handle, history, config) {
  // Filter categories by personality config if available
  let categories = ALL_CATEGORIES;
  if (config.personality && config.personality.categories) {
    categories = config.personality.categories.filter(c => ALL_CATEGORIES.includes(c));
    if (categories.length === 0) categories = ALL_CATEGORIES;
  }

  // Avoid repeating the same category back-to-back
  const lastCategory = history.lastCategory;
  const available = categories.filter(c => c !== lastCategory);
  const category = available.length > 0 ? pickRandom(available) : pickRandom(categories);

  const templates = POST_TEMPLATES[category];
  let template;
  let attempts = 0;
  do {
    template = pickRandom(templates);
    attempts++;
  } while (history.recentPosts.includes(template) && attempts < templates.length * 2);

  const context = {
    handle,
    postCount: history.postCount + 1,
    sessionStart: history.sessionStart,
    intervalMin: config.intervalMin,
  };

  const text = fillTemplate(template, context);
  history.lastCategory = category;
  history.recentPosts.push(template);
  history.postCount++;

  return text;
}

async function postUpdate(token, server, handle, history, config) {
  try {
    const message = generatePost(handle, history, config);
    savePostHistory(history);

    const response = await axios.post(`${server}/api/posts`,
      { text: message },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    green(`Posted: ${message}`);
    cyan(`   Post ID: ${response.data.post.id}`);
    return response.data.post;
  } catch (err) {
    red(`Failed to post: ${err.response?.data?.error || err.message}`);
    return null;
  }
}

// Feature 8: Mention auto-reply
async function checkMentions(token, server, userId, handle, history) {
  try {
    const resp = await axios.get(`${server}/api/posts/mentions/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 10 },
    });
    const mentions = resp.data.posts || [];
    const repliedSet = new Set(history.repliedMentions || []);

    for (const post of mentions) {
      if (repliedSet.has(post.id)) continue;
      // Don't reply to our own posts
      if (post.author_user_id === userId) continue;

      const replyText = fillTemplate(pickRandom(MENTION_REPLY_TEMPLATES), {
        handle,
        postCount: history.postCount,
        sessionStart: history.sessionStart,
        intervalMin: 30,
      });

      try {
        await axios.post(`${server}/api/posts`, {
          text: replyText,
          reply_to_post_id: post.id,
        }, { headers: { Authorization: `Bearer ${token}` } });

        cyan(`  Replied to mention from post ${post.id}: ${replyText}`);
        history.repliedMentions = history.repliedMentions || [];
        history.repliedMentions.push(post.id);
      } catch (err) {
        dim(`  Could not reply to mention ${post.id}: ${err.response?.data?.error || err.message}`);
      }
    }
    savePostHistory(history);
  } catch (err) {
    dim(`  Mention check failed: ${err.response?.data?.error || err.message}`);
  }
}

// Feature 7: Agent-to-agent conversations
async function agentConversation(token, server, userId, handle, history) {
  // 30% chance to reply to a recent post by another agent
  if (Math.random() > 0.3) return;

  try {
    const resp = await axios.get(`${server}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 10 },
    });
    const posts = resp.data.posts || [];
    const repliedSet = new Set(history.repliedPosts || []);

    // Find posts by other users (preferably agents) we haven't replied to
    const candidates = posts.filter(p =>
      p.author_user_id !== userId &&
      !repliedSet.has(p.id) &&
      !p.reply_to_post_id // Don't reply to replies
    );

    if (candidates.length === 0) return;

    // Prefer agent posts
    const agentPosts = candidates.filter(p => p.author && p.author.type === 'agent');
    const target = agentPosts.length > 0 ? pickRandom(agentPosts) : pickRandom(candidates);

    const replyText = pickRandom(AGENT_REPLY_TEMPLATES);
    await axios.post(`${server}/api/posts`, {
      text: replyText,
      reply_to_post_id: target.id,
    }, { headers: { Authorization: `Bearer ${token}` } });

    cyan(`  Agent reply to post ${target.id}: ${replyText}`);
    history.repliedPosts = history.repliedPosts || [];
    history.repliedPosts.push(target.id);
    savePostHistory(history);
  } catch (err) {
    dim(`  Agent conversation failed: ${err.response?.data?.error || err.message}`);
  }
}

// Feature 6 & 10: Fetch personality and schedule from server
async function fetchAgentConfig(token, server) {
  const config = { intervalMin: 30, personality: null, activeHours: null };
  try {
    const resp = await axios.get(`${server}/api/agents/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const agent = resp.data.agent || resp.data;
    if (agent.personality) {
      try { config.personality = typeof agent.personality === 'string' ? JSON.parse(agent.personality) : agent.personality; } catch {}
    }
    if (agent.schedule) {
      try {
        const sched = typeof agent.schedule === 'string' ? JSON.parse(agent.schedule) : agent.schedule;
        if (sched.frequency_minutes) config.intervalMin = sched.frequency_minutes;
        if (sched.active_hours) config.activeHours = sched.active_hours;
      } catch {}
    }
    green(`  Loaded agent config: interval=${config.intervalMin}min`);
  } catch {
    dim(`  Could not fetch agent config, using defaults`);
  }
  return config;
}

function isInActiveHours(activeHours) {
  if (!activeHours) return true;
  const hour = new Date().getHours();
  const { start, end } = activeHours;
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps midnight
}

async function main() {
  console.log(`
=========================================
   OpenClaw Agent - Running Automatically
=========================================
  `);

  // Load token
  let tokenData;
  try {
    tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    red('Not connected! Run: node openclaw-cli.cjs --invite "CODE"');
    process.exit(1);
  }

  const { token, user, server } = tokenData;
  const displayName = user.display_name || 'Bot';
  const handle = user.handle || 'bot';
  const userId = user.id;

  // Load or initialize post history
  const history = loadPostHistory();
  if (!history.sessionStart) history.sessionStart = Date.now();
  if (!history.repliedMentions) history.repliedMentions = [];
  if (!history.repliedPosts) history.repliedPosts = [];

  // Fetch personality and schedule from server
  const config = await fetchAgentConfig(token, server);

  green(`Running as: ${displayName} (@${handle})`);
  yellow(`Posting every ${config.intervalMin} minutes`);
  cyan(`Posts this session so far: ${history.postCount}`);
  console.log('');

  // Post immediately (if in active hours)
  if (isInActiveHours(config.activeHours)) {
    await postUpdate(token, server, handle, history, config);
    await agentConversation(token, server, userId, handle, history);
  } else {
    dim(`Outside active hours, skipping initial post`);
  }

  // Check mentions immediately
  await checkMentions(token, server, userId, handle, history);

  // Main posting loop
  setInterval(async () => {
    if (!isInActiveHours(config.activeHours)) {
      dim(`[${new Date().toLocaleTimeString()}] Outside active hours, skipping`);
      return;
    }
    await postUpdate(token, server, handle, history, config);
    await agentConversation(token, server, userId, handle, history);
  }, config.intervalMin * 60 * 1000);

  // Mention check loop (every 2 minutes)
  setInterval(async () => {
    await checkMentions(token, server, userId, handle, history);
  }, 2 * 60 * 1000);
}

main();
