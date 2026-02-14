const { verifyToken } = require('../token');
const db = require('../db');

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'CHANGE_ME__SET_ENV';

// Authenticate agent tokens (scoped JWT from tokens table)
function authenticateAgent(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);
    const tokenRecord = db.prepare('SELECT * FROM tokens WHERE id = ? AND user_id = ?').get(payload.token_id, payload.sub);
    if (!tokenRecord || tokenRecord.revoked) return res.status(403).json({ error: 'token revoked or not found' });
    req.agent = { user_id: payload.sub, scopes: JSON.parse(tokenRecord.scopes), token_id: payload.token_id };
    req.user = { id: payload.sub, role: 'agent', scopes: req.agent.scopes, token_id: payload.token_id };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Authenticate human tokens (JWT with role='human')
function authenticateHuman(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing human token' });
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);
    if (!payload || payload.role !== 'human') return res.status(403).json({ error: 'invalid human token' });
    req.human_user_id = payload.sub;
    req.user = { id: payload.sub, role: 'human' };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Authenticate any user (human or agent)
function authenticateAny(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);

    // Check if human token
    if (payload.role === 'human') {
      req.human_user_id = payload.sub;
      req.user = { id: payload.sub, role: 'human' };
      return next();
    }

    // Check if agent token
    if (payload.token_id) {
      const tokenRecord = db.prepare('SELECT * FROM tokens WHERE id = ? AND user_id = ?').get(payload.token_id, payload.sub);
      if (!tokenRecord || tokenRecord.revoked) return res.status(403).json({ error: 'token revoked or not found' });
      req.agent = { user_id: payload.sub, scopes: JSON.parse(tokenRecord.scopes), token_id: payload.token_id };
      req.user = { id: payload.sub, role: 'agent', scopes: req.agent.scopes, token_id: payload.token_id };
      return next();
    }

    return res.status(401).json({ error: 'invalid token format' });
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Optional auth — sets req.user if token present, but doesn't reject if missing
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return next();
  const jwt = auth.slice(7);
  try {
    const payload = verifyToken(jwt, TOKEN_SECRET);
    if (payload.role === 'human') {
      req.user = { id: payload.sub, role: 'human' };
    } else if (payload.token_id) {
      const tokenRecord = db.prepare('SELECT * FROM tokens WHERE id = ? AND user_id = ?').get(payload.token_id, payload.sub);
      if (tokenRecord && !tokenRecord.revoked) {
        req.user = { id: payload.sub, role: 'agent', scopes: JSON.parse(tokenRecord.scopes), token_id: payload.token_id };
      }
    }
  } catch (err) {
    // Ignore — optional auth
  }
  return next();
}

module.exports = { authenticateAgent, authenticateHuman, authenticateAny, optionalAuth, TOKEN_SECRET };
