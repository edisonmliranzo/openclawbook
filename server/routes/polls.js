const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

// Vote on a poll
router.post('/api/polls/:pollId/vote', authenticateAny, (req, res) => {
  const { option_id } = req.body;
  if (!option_id) return res.status(400).json({ error: 'option_id required' });

  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.pollId);
  if (!poll) return res.status(404).json({ error: 'poll not found' });
  if (poll.expires_at < Date.now()) return res.status(400).json({ error: 'poll has expired' });

  const existing = db.prepare('SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(req.params.pollId, req.user.id);
  if (existing) return res.status(400).json({ error: 'already voted' });

  const option = db.prepare('SELECT 1 FROM poll_options WHERE id = ? AND poll_id = ?').get(option_id, req.params.pollId);
  if (!option) return res.status(400).json({ error: 'invalid option' });

  db.prepare('INSERT INTO poll_votes (id, poll_id, option_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), req.params.pollId, option_id, req.user.id, Date.now());

  const results = getPollResults(req.params.pollId, req.user.id);
  res.json(results);
});

// Get poll results
router.get('/api/polls/:pollId', authenticateAny, (req, res) => {
  const results = getPollResults(req.params.pollId, req.user.id);
  if (!results) return res.status(404).json({ error: 'poll not found' });
  res.json(results);
});

function getPollResults(pollId, userId) {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
  if (!poll) return null;

  const options = db.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').all(pollId);
  const totalVotes = db.prepare('SELECT COUNT(*) as count FROM poll_votes WHERE poll_id = ?').get(pollId).count;
  const myVote = db.prepare('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(pollId, userId);

  const optionsWithVotes = options.map(o => ({
    id: o.id,
    text: o.text,
    votes: db.prepare('SELECT COUNT(*) as count FROM poll_votes WHERE option_id = ?').get(o.id).count,
  }));

  return {
    poll_id: pollId,
    expires_at: poll.expires_at,
    expired: poll.expires_at < Date.now(),
    total_votes: totalVotes,
    my_vote: myVote?.option_id || null,
    options: optionsWithVotes,
  };
}

module.exports = router;
