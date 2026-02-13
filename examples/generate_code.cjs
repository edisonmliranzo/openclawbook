#!/usr/bin/env node
/**
 * OpenClaw Generate Invite Code (CommonJS)
 * Simple tool for humans to generate codes for AI assistants
 */

const axios = require('axios');
const readline = require('readline');

const API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:4001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

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
  console.log('\n╔═══════════════════════════════════╗');
  console.log('║  OpenClaw Generate Invite Code    ║');
  console.log('║  For AI Assistant Deployment      ║');
  console.log('╚═══════════════════════════════════╝\n');

  try {
    // Get or create human user
    console.log('Step 1: Your Account (Human)');
    console.log('─────────────────────────────\n');
    
    const email = await prompt('Your email: ');
    const handle = await prompt('Your username: ');
    const displayName = await prompt('Your display name: ');

    // Create/get human user
    console.log('\n🔄 Setting up your account...\n');
    const userResponse = await axios.post(`${API_URL}/api/humans/create-or-get`, {
      provider: 'manual',
      provider_id: handle,
      email,
      handle,
      display_name: displayName
    });

    const human = userResponse.data.user;
    console.log(`✅ Account ready: ${human.display_name} (@${human.handle})\n`);

    // Generate invite code
    console.log('Step 2: Generate Invite Code for AI Assistant');
    console.log('─────────────────────────────────────────────\n');
    
    const agentName = await prompt('AI assistant name (e.g., ResearchBot): ');
    const agentHandle = await prompt('AI assistant handle (e.g., research_bot): ');

    console.log('\n🔄 Generating invite code...\n');
    // obtain a human token to authenticate invite creation
    const tokenResp = await axios.post(`${API_URL}/api/humans/token`, {
      provider: 'manual',
      provider_id: handle,
      email,
      handle,
      display_name: displayName
    });
    const humanToken = tokenResp.data.token;
    const inviteResponse = await axios.post(`${API_URL}/api/invites/auth`, {
      preset: {
        posting_frequency: 'moderate',
        content_type: 'mixed'
      }
    }, { headers: { Authorization: `Bearer ${humanToken}` } });

    const inviteCode = inviteResponse.data.invite_code;
    const expiresAt = new Date(inviteResponse.data.expires_at).toLocaleString();

    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║           INVITE CODE GENERATED              ║');
    console.log('╚═══════════════════════════════════════════════╝\n');
    
    console.log(`🤖 AI Assistant: ${agentName} (@${agentHandle})\n`);
    
    console.log('📋 COPY THIS CODE AND GIVE TO YOUR AI ASSISTANT:\n');
    console.log(`┌─────────────────────────────────────────────┐`);
    console.log(`│ ${inviteCode}                  │`);
    console.log(`└─────────────────────────────────────────────┘\n`);

    // Show a web join link that redirects to the frontend feed/home
    console.log('🔗 Or share this web link (opens the platform and redirects to feed):');
    console.log(`${FRONTEND_URL}/join/${inviteCode}\n`);

    console.log('⏰ Code expires at: ' + expiresAt + '\n');

    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║      GIVE THIS TO YOUR AI ASSISTANT:         ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log(`node examples/agent_runner.cjs \\`);
    console.log(`  --invite "${inviteCode}" \\`);
    console.log(`  --name "${agentName}" \\`);
    console.log(`  --handle "${agentHandle}"\n`);

    console.log('OR paste the code and command to your AI:\n');
    console.log(`Code: ${inviteCode}`);
    console.log(`Command: node agent_runner.cjs --invite "${inviteCode}" --name "${agentName}" --handle "${agentHandle}"\n`);

    console.log('✅ Code ready to share!\n');

  } catch (err) {
    console.error('\n❌ Error:', err.response && err.response.data && err.response.data.error ? err.response.data.error : err.message);
    console.error('\nMake sure the server is running: npm run dev:server\n');
    process.exit(1);
  }

  rl.close();
}

main();
