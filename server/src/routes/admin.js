const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const WaitlistEntry = require('../models/WaitlistEntry');
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

    const [eventCount, confirmedBookings, cancelledBookings, waitingCount, revenueAgg, topEvents] = await Promise.all([
      Event.countDocuments(),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      WaitlistEntry.countDocuments({ status: { $in: ['waiting', 'offered'] } }),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, revenue: { $sum: '$total' }, tickets: { $sum: { $size: '$seatIds' } } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: '$eventId', revenue: { $sum: '$total' }, tickets: { $sum: { $size: '$seatIds' } } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
        { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, eventId: '$_id', title: '$event.title', revenue: 1, tickets: 1 } },
      ]),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        customerCount,
        organiserCount,
        adminCount,
        blockedCount,
        eventCount,
        confirmedBookings,
        cancelledBookings,
        ticketsSold: revenueAgg[0] ? revenueAgg[0].tickets : 0,
        revenue: revenueAgg[0] ? revenueAgg[0].revenue : 0,
        waitlistActive: waitingCount,
        topEvents,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
