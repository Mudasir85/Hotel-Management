const { DEMO_USER, JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/auth.config');
const { signToken } = require('../../utils/jwt.util');

function parseExpiresInToSeconds(expiresIn) {
  const value = String(expiresIn || '').trim();
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 2 * 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  return amount * 60 * 60 * 24;
}

function validateCredentials(username, password) {
  if (!username || !password) {
    return null;
  }

  const normalizedUsername = String(username).trim();
  if (normalizedUsername !== DEMO_USER.username || password !== DEMO_USER.password) {
    return null;
  }

  return {
    id: DEMO_USER.id,
    username: DEMO_USER.username,
    role: DEMO_USER.role
  };
}

function createToken(user) {
  return signToken(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    parseExpiresInToSeconds(JWT_EXPIRES_IN)
  );
}

module.exports = {
  validateCredentials,
  createToken
};
