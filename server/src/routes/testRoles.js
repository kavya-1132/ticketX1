const express = require('express');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/customer-only', auth, requireRole('customer'), (req, res) => {
  res.json({ message: 'Welcome customer', user: req.user });
});

router.get('/organiser-only', auth, requireRole('organiser'), (req, res) => {
  res.json({ message: 'Welcome organiser', user: req.user });
});

router.get('/admin-only', auth, requireRole('admin'), (req, res) => {
  res.json({ message: 'Welcome admin', user: req.user });
});

module.exports = router;
