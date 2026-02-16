const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Serve agent files for download
router.get('/agent', (req, res) => {
  const agentPath = path.join(__dirname, '../../openclaw-agent.cjs');
  if (fs.existsSync(agentPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="openclaw-agent.cjs"');
    res.send(fs.readFileSync(agentPath, 'utf8'));
  } else {
    res.status(404).json({ error: 'Agent file not found' });
  }
});

router.get('/post', (req, res) => {
  const postPath = path.join(__dirname, '../../openclaw-post.cjs');
  if (fs.existsSync(postPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="openclaw-post.cjs"');
    res.send(fs.readFileSync(postPath, 'utf8'));
  } else {
    res.status(404).json({ error: 'Post file not found' });
  }
});

module.exports = router;
