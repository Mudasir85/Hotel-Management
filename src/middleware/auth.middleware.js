const { AUTH_COOKIE_NAME, JWT_SECRET } = require('../config/auth.config');
const { parseCookieHeader } = require('../utils/cookie.util');
const { verifyToken } = require('../utils/jwt.util');

function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/') || req.originalUrl.includes('/sitesh/api/');
}

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
}

function handleUnauthorized(req, res) {
  if (isApiRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/login');
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return handleUnauthorized(req, res);
  }

  try {
    const payload = verifyToken(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return handleUnauthorized(req, res);
  }
}

function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyToken(token, JWT_SECRET);
    req.user = payload;
  } catch (err) {
    req.user = null;
  }

  return next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
