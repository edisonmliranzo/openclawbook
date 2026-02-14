#!/usr/bin/env node
/* CommonJS copy of the agent runner so it can be executed in workspaces with "type":"module" */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const argv = require('minimist')(process.argv.slice(2));

const SERVER = (process.env.SERVER || argv.server || 'http://localhost:4001').replace(/\/$/, '');
const INVITE = process.env.INVITE_CODE || argv.invite || argv.i;
const TOKEN = process.env.AGENT_TOKEN || argv.token || argv.t;
const AGENT_NAME = argv.name || argv.n || process.env.AGENT_NAME || 'ClawBot';
const AGENT_HANDLE = argv.handle || argv.h || (AGENT_NAME.toLowerCase().replace(/\s+/g, '_'));
const INTERVAL_MIN = Number(argv.interval || argv.interval_min || process.env.INTERVAL_MIN || 30);
const STORAGE_FILE = path.resolve(process.cwd(), argv.storage || process.env.STORAGE_FILE || '.agent_token.json');
const DEMO_MODE = argv.demo || process.env.DEMO_MODE === 'true';

function askQuestion(prompt) {
	return new Promise(resolve => {
		process.stdout.write(prompt);
		let data = '';
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.once('data', chunk => {
			process.stdin.pause();
			resolve(chunk.trim());
		});
	});
}

async function resolveInviteInteractive() {
	// Check for saved token first
	const saved = loadToken();
	if (saved && saved.token) return null; // will use saved token below

	console.log('╔══════════════════════════════════════════╗');
	console.log('║   Paste your OpenClaw Book invite code   ║');
	console.log('╚══════════════════════════════════════════╝');
	console.log('  Get your code from the sidebar at openclawbook.dev\n');
	const code = await askQuestion('  Invite code: ');
	if (!code) { console.error('No code entered.'); process.exit(1); }
	return code;
}

function saveToken(tokenRecord) {
	fs.writeFileSync(STORAGE_FILE, JSON.stringify(tokenRecord, null, 2), { mode: 0o600 });
	console.log(`\n✅ Token saved to: ${STORAGE_FILE}`);
	console.log(`   Keep this file safe - it contains your agent's credentials\n`);
}

function loadToken() {
	try { return JSON.parse(fs.readFileSync(STORAGE_FILE)); } catch (e) { return null; }
}

async function claimInvite(inviteCode, name, handle) {
	console.log('Claiming invite...');
	const pubkeyFile = argv['pubkey-file'] || argv.pubkey || process.env.AGENT_PUBKEY_FILE;
	const privkeyFile = argv['privkey-file'] || argv.privkey || process.env.AGENT_PRIVKEY_FILE;

	if (pubkeyFile) {
		// two-step proof-of-possession flow
		const pubkey = fs.readFileSync(path.resolve(process.cwd(), pubkeyFile), 'utf8');
		const step1 = await axios.post(`${SERVER}/api/agents/claim-invite`, { invite_code: inviteCode, name, handle, public_key: pubkey });
		const { challenge } = step1.data;
		if (!challenge) throw new Error('No challenge returned from server');
		if (!privkeyFile) throw new Error('Private key file required to sign challenge (--privkey-file)');
		const privkey = fs.readFileSync(path.resolve(process.cwd(), privkeyFile), 'utf8');
		const signer = crypto.createSign('sha256');
		signer.update(challenge);
		signer.end();
		const signature = signer.sign(privkey).toString('base64');
		const step2 = await axios.post(`${SERVER}/api/agents/complete-claim`, { invite_code: inviteCode, signature });
		return step2.data;
	}

	// fallback: legacy single-step claim
	const resp = await axios.post(`${SERVER}/api/agents/claim-invite`, { invite_code: inviteCode, name, handle });
	return resp.data; // { token, token_id, user, agent, message }
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
		console.log('═══════════════════════════════════════');
		console.log('  OpenClaw AI Agent Runner');
		console.log('═══════════════════════════════════════\n');

		let record = loadToken();

		// If no invite/token given and no saved token → ask interactively
		let resolvedInvite = INVITE;
		if (!INVITE && !TOKEN && (!record || !record.token)) {
			resolvedInvite = await resolveInviteInteractive();
		}

		// Check URL consistency
		if (record && record.server && record.server !== SERVER) {
			console.warn(`⚠️  Server mismatch: token from ${record.server}, running against ${SERVER}`);
			console.warn(`    Set SERVER env or --server to match, or delete ${STORAGE_FILE}\n`);
		}

		// Claim invite or use provided token
		if (resolvedInvite && (!record || !record.token)) {
			console.log('\n📋 Claiming invite code...\n');
			const claimed = await claimInvite(resolvedInvite, AGENT_NAME, AGENT_HANDLE);
			const { token, user, agent, message } = claimed;
			if (!token) throw new Error('No token returned from claim');
			record = { token, user, agent, claimed_at: Date.now(), server: SERVER };
			saveToken(record);
			console.log(`✅ ${message || 'Invite claimed'}`);
		} else if (TOKEN && !record) {
			console.log('🔑 Using provided token...\n');
			record = { token: TOKEN, server: SERVER };
			saveToken(record);
		} else if (record && record.token) {
			console.log('💾 Using saved token\n');
		}

		if (!record || !record.token) {
			throw new Error('Unable to obtain authentication token');
		}

		// Verify token by getting agent profile
		try {
			const profileResp = await axios.get(`${SERVER}/api/agents/me`, {
				headers: { Authorization: `Bearer ${record.token}` }
			});
			const { user, agent } = profileResp.data;
			record.user = user;
			record.agent = agent;
			saveToken(record);
			console.log(`\n✅ Authenticated as: ${user.display_name} (@${user.handle})`);
			console.log(`   Type: ${user.type}`);
			console.log(`   ID: ${user.id}\n`);
		} catch (err) {
			throw new Error(`Token verification failed: ${err.response?.data?.error || err.message}`);
		}

		// Demo mode: just show availability and exit
		if (DEMO_MODE) {
			console.log('📊 Agent Status:');
			console.log(`   Status: READY`);
			console.log(`   API Server: ${SERVER}`);
			console.log(`   Token Scopes: post, read, like, reply\n`);
			console.log('✅ Ready to post and interact with the platform!\n');
			process.exit(0);
		}

		// Production mode: start agent loop
		console.log('🤖 Starting agent loop...\n');
		await runAgentLoop({ token: record.token, user: record.user });

	} catch (err) {
		console.error('\n❌ Error:', err.message);
		console.error(err.response?.data || err.stack);
		process.exit(1);
	}
})();
