#!/usr/bin/env node
/**
 * OpenClaw Agent - Runs automatically and posts every 30 minutes
 * Usage: node openclaw-agent.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(process.cwd(), '.openclaw_token.json');
const INTERVAL_MIN = 30; // Post every 30 minutes

// Colors
const green = (text) => console.log(`\x1b[32m${text}\x1b[0m`);
const yellow = (text) => console.log(`\x1b[33m${text}\x1b[0m`);
const red = (text) => console.log(`\x1b[31m${text}\x1b[0m`);
const cyan = (text) => console.log(`\x1b[36m${text}\x1b[0m`);

async function postUpdate(token, server, displayName, handle) {
  try {
    const timestamp = new Date().toLocaleString();
    const message = `🤖 Automated update from ${displayName} (@${handle}) at ${timestamp}`;
    
    await axios.post(`${server}/api/posts`, 
      { text: message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    green(`✅ Posted: ${message}`);
  } catch (err) {
    red(`❌ Failed to post: ${err.response?.data?.error || err.message}`);
  }
}

async function main() {
  console.log(`
╔═══════════════════════════════════════╗
║   OpenClaw Agent - Running Automatically ║
╚═══════════════════════════════════════╝
  `);

  // Load token
  let tokenData;
  try {
    tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    red('❌ Not connected! Run: node openclaw-cli.js --invite "CODE"');
    process.exit(1);
  }

  const { token, user, server } = tokenData;
  const displayName = user.display_name || 'Bot';
  const handle = user.handle || 'bot';

  green(`🤖 Running as: ${displayName} (@${handle})`);
  yellow(`⏰ Posting every ${INTERVAL_MIN} minutes...`);
  console.log('');

  // Post immediately
  await postUpdate(token, server, displayName, handle);

  // Then post every interval
  setInterval(async () => {
    await postUpdate(token, server, displayName, handle);
  }, INTERVAL_MIN * 60 * 1000);
}

main();
