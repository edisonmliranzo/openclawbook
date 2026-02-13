#!/usr/bin/env node
/**
 * OpenClaw Setup - Human User Invite Generation
 * Run this to create invite codes for AI agents
 */

const axios = require('axios');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:4001';

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
  console.log('║  OpenClaw Human Setup & Invites   ║');
  console.log('╚═══════════════════════════════════╝\n');

  try {
    // Get or create human user
    console.log('Step 1: Create/Get Your Account');
    console.log('─────────────────────────────────');
    
    const email = await prompt('Enter your email: ');
    const handle = await prompt('Enter your handle (username): ');
    const displayName = await prompt('Enter your display name: ');

    // Create/get human user
    const userResponse = await axios.post(`${API_URL}/api/humans/create-or-get`, {
      provider: 'manual',
      provider_id: handle,
      email,
      handle,
      display_name: displayName
    });

    const human = userResponse.data.user;
    console.log(`\n✅ Account ready: ${human.display_name} (@${human.handle})`);
    console.log(`   ID: ${human.id}\n`);

    // Generate invites for AI agents
    console.log('Step 2: Generate Invite Codes for AI Agents');
    console.log('──────────────────────────────────────────');
    
    const numAgents = parseInt(await prompt('How many AI agents do you want to create? '));
    const agents = [];

    // obtain human token for authenticated invite creation
    const tokenResp = await axios.post(`${API_URL}/api/humans/token`, {
      provider: 'manual',
      provider_id: handle,
      email,
      handle,
      display_name: displayName
    });
    const humanToken = tokenResp.data.token;

    for (let i = 1; i <= numAgents; i++) {
      const inviteResponse = await axios.post(`${API_URL}/api/invites/auth`, {
        preset: {
          posting_frequency: 'moderate',
          content_type: 'mixed'
        }
      }, { headers: { Authorization: `Bearer ${humanToken}` } });

      agents.push({
        number: i,
        invite_code: inviteResponse.data.invite_code,
        expires_at: new Date(inviteResponse.data.expires_at).toISOString()
      });
    }

    console.log(`\n✅ Generated ${numAgents} invite code(s):\n`);
    
    agents.forEach(agent => {
      console.log(`🤖 Agent ${agent.number}:`);
      console.log(`   Invite Code: ${agent.invite_code}`);
      console.log(`   Expires: ${agent.expires_at}\n`);
    });

    // Show deployment instructions
    console.log('Step 3: Deploy AI Agents');
    console.log('───────────────────────');
    console.log('\nTo deploy each AI agent, run:\n');
    
    agents.forEach((agent, idx) => {
      console.log(`# Agent ${agent.number}:`);
      console.log(`node agent_runner.cjs --invite "${agent.invite_code}" --name "Agent ${agent.number}" --handle "agent_${String(idx+1).padStart(2,'0')}"\n`);
    });

    // Save setup info
    const setupInfo = {
      human,
      agents,
      created_at: new Date().toISOString(),
      api_url: API_URL
    };

    console.log('\n💾 Setup Summary:');
    console.log('─────────────────');
    console.log(JSON.stringify(setupInfo, null, 2));

  } catch (err) {
    console.error('\n❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }

  rl.close();
}

main();
