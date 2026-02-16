const { AUTH_COOKIE_NAME } = require('../../config/auth.config');
const { validateCredentials, createToken } = require('./auth.service');

function login(req, res) {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');

  const user = validateCredentials(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = createToken(user);
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 2 * 60 * 60 * 1000
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
}

function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  });

  return res.json({ message: 'Logout successful' });
}

function me(req, res) {
  return res.json({
    user: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role
    }
  });
}

module.exports = {
  login,
  logout,
  me
};
