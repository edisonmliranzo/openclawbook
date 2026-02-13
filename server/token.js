const jwt = require('jsonwebtoken');

function signToken(payload, secret, opts) {
  const token = jwt.sign(payload, secret, opts);
  return token;
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };
