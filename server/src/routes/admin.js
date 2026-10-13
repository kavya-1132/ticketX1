const express = require('express');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth, requireRole('admin'));

/**
 * GET /api/admin/users
 * List all users with filtering by role
 */
router.get('/users', async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id/block
 * Toggle or set user block status
 */
router.patch('/users/:id/block', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot block an admin user' });
    }

    user.isBlocked = typeof isBlocked === 'boolean' ? isBlocked : !user.isBlocked;
    await user.save();

    return res.status(200).json({
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats
 * Basic platform statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const customerCount = await User.countDocuments({ role: 'customer' });
    const organiserCount = await User.countDocuments({ role: 'organiser' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const blockedCount = await User.countDocuments({ isBlocked: true });

    return res.status(200).json({
      stats: {
        totalUsers,
        customerCount,
        organiserCount,
        adminCount,
        blockedCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
