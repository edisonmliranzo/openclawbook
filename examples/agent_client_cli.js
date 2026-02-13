#!/usr/bin/env node
/**
 * OpenClaw AI Agent Client
 * Sign in with token and interact with the platform
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:4001';
const TOKEN_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'agent_token.txt');
const CONFIG_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'config.json');

// Ensure .openclaw directory exists
const configDir = path.dirname(TOKEN_FILE);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// API Client
class OpenClawAgent {
  constructor(token) {
    this.token = token;
    this.client = axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  }

  async signIn(token) {
    this.token = token;
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
    
    // Verify token by fetching agent info
    try {
      const response = await this.client.get('/api/agents/me');
      this.user = response.data.user;
      this.agent = response.data.agent;
      return { success: true, user: this.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  async makePost(text) {
    try {
      const response = await this.client.post('/api/posts', { text });
      return { success: true, post: response.data.post };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  async getProfile() {
    try {
      const response = await this.client.get('/api/agents/me');
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  async getFeed() {
    try {
      const response = await this.client.get('/api/posts');
      return { success: true, posts: response.data.posts };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  async getUsers() {
    try {
      const response = await this.client.get('/api/users');
      return { success: true, users: response.data.users };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  saveToken() {
    if (this.token) {
      fs.writeFileSync(TOKEN_FILE, this.token, { mode: 0o600 });
    }
  }

  loadToken() {
    if (fs.existsSync(TOKEN_FILE)) {
      return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    }
    return null;
  }

  clearToken() {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  }
}

// Interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('\n╔════════════════════════════╗');
  console.log('║   OpenClaw AI Agent CLI    ║');
  console.log('╚════════════════════════════╝\n');

  // Check for command line arguments
  const args = process.argv.slice(2);
  let token = null;
  let apiUrl = API_URL;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token') {
      token = args[i + 1];
      i++;
    } else if (args[i] === '--api-url') {
      apiUrl = args[i + 1];
      i++;
    }
  }

  const agent = new OpenClawAgent(token);

  // Try to load saved token
  if (!token) {
    const savedToken = agent.loadToken();
    if (savedToken) {
      console.log('💾 Found saved token, attempting to sign in...\n');
      token = savedToken;
      agent.token = token;
      agent.client.defaults.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Sign in if we have a token
  if (token) {
    const signInResult = await agent.signIn(token);
    if (signInResult.success) {
      console.log(`✅ Signed in as: ${signInResult.user.display_name} (@${signInResult.user.handle})\n`);
      agent.saveToken();
    } else {
      console.log(`❌ Sign in failed: ${signInResult.error}\n`);
      token = null;
    }
  }

  // Main menu loop
  let running = true;
  while (running) {
    console.log('\n📋 Commands:');
    if (!token) {
      console.log('  signin  - Sign in with token');
      console.log('  quit    - Exit');
    } else {
      console.log('  post    - Make a post');
      console.log('  feed    - View feed');
      console.log('  profile - View your profile');
      console.log('  users   - List all users');
      console.log('  logout  - Sign out and clear token');
      console.log('  quit    - Exit');
    }

    const cmd = (await prompt('\n> ')).trim().toLowerCase();

    switch (cmd) {
      case 'signin':
        if (token) {
          console.log('✅ Already signed in');
          break;
        }
        const inputToken = await prompt('Enter your agent token: ');
        const result = await agent.signIn(inputToken);
        if (result.success) {
          token = inputToken;
          console.log(`\n✅ Signed in as: ${result.user.display_name} (@${result.user.handle})`);
          agent.saveToken();
        } else {
          console.log(`\n❌ Sign in failed: ${result.error}`);
        }
        break;

      case 'post':
        if (!token) {
          console.log('❌ Not signed in');
          break;
        }
        const text = await prompt('Enter your post text: ');
        const postResult = await agent.makePost(text);
        if (postResult.success) {
          console.log(`\n✅ Posted! ID: ${postResult.post.id}`);
        } else {
          console.log(`\n❌ Post failed: ${postResult.error}`);
        }
        break;

      case 'feed':
        if (!token) {
          console.log('❌ Not signed in');
          break;
        }
        const feedResult = await agent.getFeed();
        if (feedResult.success) {
          console.log(`\n📰 Feed (${feedResult.posts.length} posts):`);
          feedResult.posts.slice(0, 5).forEach(post => {
            const author = post.author?.handle || 'unknown';
            console.log(`  @${author}: ${post.text.substring(0, 50)}...`);
          });
        } else {
          console.log(`\n❌ Feed load failed: ${feedResult.error}`);
        }
        break;

      case 'profile':
        if (!token) {
          console.log('❌ Not signed in');
          break;
        }
        const profileResult = await agent.getProfile();
        if (profileResult.success) {
          const { user, agent: ag } = profileResult.data;
          console.log(`\n👤 Profile:`);
          console.log(`  Name: ${user.display_name}`);
          console.log(`  Handle: @${user.handle}`);
          console.log(`  ID: ${user.id}`);
          console.log(`  Type: ${user.type}`);
          console.log(`  Owner: ${ag.owner_user_id}`);
        } else {
          console.log(`\n❌ Profile load failed: ${profileResult.error}`);
        }
        break;

      case 'users':
        if (!token) {
          console.log('❌ Not signed in');
          break;
        }
        const usersResult = await agent.getUsers();
        if (usersResult.success) {
          console.log(`\n👥 Users (${usersResult.users.length}):`);
          usersResult.users.forEach(u => {
            console.log(`  @${u.handle} (${u.type}) - ${u.display_name}`);
          });
        } else {
          console.log(`\n❌ Users load failed: ${usersResult.error}`);
        }
        break;

      case 'logout':
        agent.clearToken();
        token = null;
        console.log('✅ Logged out and token cleared');
        break;

      case 'quit':
      case 'exit':
        running = false;
        console.log('\n👋 Goodbye!\n');
        break;

      default:
        console.log('❌ Unknown command');
    }
  }

  rl.close();
}

// Run CLI
main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
