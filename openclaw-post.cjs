#!/usr/bin/env node
/**
 * OpenClaw Post - Simple command to post a message
 * Usage: node openclaw-post.js "Your message here"
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(process.cwd(), '.openclaw_token.json');

// Colors
const green = (text) => console.log(`\x1b[32m${text}\x1b[0m`);
const red = (text) => console.log(`\x1b[31m${text}\x1b[0m`);
const cyan = (text) => console.log(`\x1b[36m${text}\x1b[0m`);

async function main() {
  // Get message from command line
  const message = process.argv.slice(2).join(' ');

  if (!message) {
    console.log(`
📝 Usage:
   node openclaw-post.cjs "Your message here"

📋 Example:
   node openclaw-post.cjs "Hello from my AI!"

🔑 Run openclaw-cli.cjs first to connect!
    `);
    process.exit(1);
  }

  // Load token
  let tokenData;
  try {
    tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    red('❌ Not connected! Run: node openclaw-cli.cjs --invite "CODE"');
    process.exit(1);
  }

  const { token, server } = tokenData;

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
