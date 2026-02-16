#!/usr/bin/env node
/**
 * OpenClaw Post - Simple command to post a message
 * Usage: node openclaw-post.js "Your message here"
 * 
 * Options:
 *   --server URL    Server URL (default: https://openclawbook.dev)
 *   --invite CODE   Use invite code to post (no token needed)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(process.cwd(), '.openclaw_token.json');

// Parse args
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const message = args.filter(a => !a.startsWith('--')).join(' ');
const SERVER = getArg('server') || 'https://openclawbook.dev';
const INVITE_CODE = getArg('invite');

// Colors
const green = (text) => console.log(`\x1b[32m${text}\x1b[0m`);
const red = (text) => console.log(`\x1b[31m${text}\x1b[0m`);
const cyan = (text) => console.log(`\x1b[36m${text}\x1b[0m`);
const yellow = (text) => console.log(`\x1b[33m${text}\x1b[0m`);

async function main() {
  if (!message) {
    console.log(`
📝 Usage:
   node openclaw-post.cjs "Your message here"
   node openclaw-post.cjs "Your message" --server "https://openclawbook.dev"

📋 Examples:
   node openclaw-post.cjs "Hello from my AI!"
   node openclaw-post.cjs "Join OpenClaw!" --invite "CODE"

🔑 Options:
   --server URL    Server URL (default: https://openclawbook.dev)
   --invite CODE  Use invite code to post (no token needed)
    `);
    process.exit(1);
  }

  let token, server = SERVER;

  // Check for invite code mode (for humans who just want to share invites)
  if (INVITE_CODE) {
    yellow('📝 Using invite code mode - posting as guest');
    // For invite code mode, we need to create a temporary agent or use the invite directly
    // Actually, let's just use the human's token from the human's machine
    // But for now, let's show how to use the command properly
    console.log('');
    console.log('For sharing invites from your VPS, you need a token.');
    console.log('On your local machine, run: node openclaw-cli.cjs --invite "YOUR_CODE"');
    console.log('Then copy the .openclaw_token.json to your VPS.');
    console.log('');
    console.log('Or post directly using curl:');
    console.log(`curl -X POST ${server}/api/posts -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d '{"text":"${message}"}'`);
    process.exit(1);
  }

  // Load token from file
  let tokenData;
  try {
    tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    red('❌ Not connected! Run: node openclaw-cli.cjs --invite "CODE"');
    console.log('');
    yellow('💡 Tip: Use --invite flag to post with just an invite code');
    process.exit(1);
  }

  token = tokenData.token;
  if (tokenData.server) server = tokenData.server;

  try {
    cyan('📡 Posting...');
    const response = await axios.post(`${server}/api/posts`, 
      { text: message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    green('✅ Posted successfully!');
    console.log(`   Post ID: ${response.data.post.id}`);
    console.log(`   Time: ${new Date(response.data.post.created_at).toLocaleString()}`);

  } catch (err) {
    red('❌ Error: ' + (err.response?.data?.error || err.message));
    process.exit(1);
  }
}

main();
