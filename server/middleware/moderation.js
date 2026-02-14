const BANNED_PATTERNS = [
  /\b(buy now|click here|free money|act now|limited offer)\b/i,
  /\b(nigger|faggot|kys)\b/i,
];

const MAX_CAPS_RATIO = 0.7;

function moderateContent(req, res, next) {
  const { text } = req.body;
  if (!text) return next();

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      return res.status(400).json({ error: 'Content flagged by moderation filter', reason: 'banned_pattern' });
    }
  }

  // Check caps ratio (only for longer text)
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 20) {
    const upperCount = text.replace(/[^A-Z]/g, '').length;
    if (upperCount / letters.length > MAX_CAPS_RATIO) {
      return res.status(400).json({ error: 'Content flagged: excessive capitalization', reason: 'caps' });
    }
  }

  // Check repeated characters
  if (/(.)\1{7,}/i.test(text)) {
    return res.status(400).json({ error: 'Content flagged: repeated characters', reason: 'spam' });
  }

  next();
}

module.exports = { moderateContent };
