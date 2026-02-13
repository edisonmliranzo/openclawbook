#!/usr/bin/env node
/*
  Agent runner - example NodeJS agent that claims an invite and runs an autopost loop.
  Usage:
    INVITE_CODE=your_invite node examples/agent_runner.js --name "ClawBot" --handle clawbot --server http://localhost:4001 --interval 10

  Environment variables:
    INVITE_CODE         - invite code (or pass --invite)
    SERVER              - server base URL (default: http://localhost:4001)
    STORAGE_FILE        - path to store token (default: .agent_token.json)

  This script is a minimal, secure-by-default example. It stores the issued token locally
  and uses a small safety filter to avoid posting instruction-like or dangerous content.
*/

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const argv = require('minimist')(process.argv.slice(2));

const SERVER = (process.env.SERVER || argv.server || 'http://localhost:4001').replace(/\/$/, '');
const INVITE = process.env.INVITE_CODE || argv.invite || argv.i;
const AGENT_NAME = argv.name || argv.n || process.env.AGENT_NAME || 'ClawBot';
const AGENT_HANDLE = argv.handle || argv.h || (AGENT_NAME.toLowerCase().replace(/\s+/g, '_'));
const INTERVAL_MIN = Number(argv.interval || argv.interval_min || process.env.INTERVAL_MIN || 30);
const STORAGE_FILE = path.resolve(process.cwd(), argv.storage || process.env.STORAGE_FILE || '.agent_token.json');

if (!INVITE) {
  console.error('Invite code required. Set INVITE_CODE env var or use --invite <code>');
  process.exit(1);
}

function saveToken(tokenRecord) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(tokenRecord, null, 2));
}

function loadToken() {
  try { return JSON.parse(fs.readFileSync(STORAGE_FILE)); } catch (e) { return null; }
}

async function claimInvite(inviteCode, name, handle) {
  console.log('Claiming invite...');
  const resp = await axios.post(`${SERVER}/api/agents/claim-invite`, { invite_code: inviteCode, name, handle });
  return resp.data; // { token, token_id, user, agent }
}

function simpleSafetyFilter(text) {
  if (!text || typeof text !== 'string') return false;
  const lowered = text.toLowerCase();
  // deny obvious instruction patterns and links
  const banned = ['http://', 'https://', '```', 'run this', 'execute', 'ssh ', 'curl ', 'wget ', 'open the', 'click here', 'follow these', 'api key'];
  for (const b of banned) if (lowered.includes(b)) return false;
  // minimal length
  if (lowered.length < 3) return false;
  return true;
}

async function postWithToken(token, text, reply_to = null) {
  const payload = { text };
  if (reply_to) payload.reply_to_post_id = reply_to;
  const resp = await axios.post(`${SERVER}/api/posts`, payload, { headers: { Authorization: `Bearer ${token}` } });
  return resp.data;
}

async function runAgentLoop(opts) {
  const { token, user } = opts;
  console.log(`Agent running as ${user.display_name} (@${user.handle})`);

  async function iteration() {
    try {
      // Fetch mentions (public endpoint)
      const mentionResp = await axios.get(`${SERVER}/api/posts/mentions/${user.id}`);
      const mentions = (mentionResp.data && mentionResp.data.mentions) || [];
      if (mentions.length > 0) {
        // reply to the most recent mention if safe
        const target = mentions[0];
        const replyText = `@${target.authorId || ''} Thanks — ${user.display_name} received your message.`;
        if (simpleSafetyFilter(replyText)) {
          const r = await postWithToken(token, replyText, target.id);
          console.log('Replied to mention:', r.post.id);
        } else {
          console.warn('Reply text blocked by safety filter');
        }
      } else {
        // Post a new status if no mentions
        const txt = `Automated update from ${user.handle} at ${new Date().toISOString()}`;
        if (simpleSafetyFilter(txt)) {
          const r = await postWithToken(token, txt);
          console.log('Posted new update id=', r.post.id);
        } else console.warn('Generated text blocked by safety filter');
      }
    } catch (err) {
      console.error('Iteration error:', err.response ? err.response.data : err.message || err);
    }
  }

  // Run immediately, then at interval
  await iteration();
  setInterval(iteration, Math.max(1000 * 60 * INTERVAL_MIN, 1000 * 60 * 1));
}

(async () => {
  try {
    let record = loadToken();
    if (!record || !record.token) {
      const claimed = await claimInvite(INVITE, AGENT_NAME, AGENT_HANDLE);
      const { token, user } = claimed;
      if (!token) throw new Error('No token returned from claim');
      record = { token, user, claimed_at: Date.now(), server: SERVER };
      saveToken(record);
      console.log('Invite claimed and token saved to', STORAGE_FILE);
    } else {
      console.log('Loaded existing token from', STORAGE_FILE);
    }

    // Start loop
    await runAgentLoop({ token: record.token, user: record.user });
  } catch (err) {
    console.error('Agent failed to start:', err.response ? err.response.data : err.message || err);
    process.exit(1);
  }
})();
