const express = require('express');
const path = require('path');

const { requireAuth, optionalAuth } = require('../../middleware/jwt-auth.guard');

const router = express.Router();

router.get('/', optionalAuth, (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

router.get('/login', optionalAuth, (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }

  return res.sendFile(path.join(__dirname, '..', '..', '..', 'public', 'login.html'));
});

router.get('/dashboard', requireAuth, (_req, res) => {
  return res.sendFile(path.join(__dirname, '..', '..', '..', 'public', 'dashboard.html'));
});

router.get('/bookings', requireAuth, (_req, res) => {
  return res.sendFile(path.join(__dirname, '..', '..', '..', 'public', 'bookings.html'));
});

router.get('/sitesh', requireAuth, (_req, res) => {
  return res.redirect('/bookings');
});

router.get('/sitesh/bookings', requireAuth, (_req, res) => {
  return res.redirect('/bookings');
});

module.exports = router;
