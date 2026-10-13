const express = require('express');
const mongoose = require('mongoose');
const { param } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Event = require('../models/Event');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const WaitlistEntry = require('../models/WaitlistEntry');

const router = express.Router();

router.use(auth, requireRole('organiser', 'admin'));

// Admins see every event; organisers only their own
function ownershipFilter(user) {
  return user.role === 'admin' ? {} : { organiserId: user._id };
}

/**
 * GET /api/organiser/events
 * My events with sales numbers: seats sold, held, revenue, waitlist length
 */
router.get('/events', async (req, res, next) => {
  try {
    const events = await Event.find(ownershipFilter(req.user))
      .populate('venueId', 'name city')
      .sort({ startsAt: 1 });

    const eventIds = events.map((e) => e._id);

    const [seatStats, revenueStats, waitlistStats] = await Promise.all([
      Seat.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: { eventId: '$eventId', status: '$status' }, count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { eventId: { $in: eventIds }, status: 'confirmed' } },
        {
          $group: {
            _id: '$eventId',
            revenue: { $sum: '$total' },
            bookings: { $sum: 1 },
            checkedIn: { $sum: { $cond: [{ $ne: ['$checkedInAt', null] }, 1, 0] } },
          },
        },
      ]),
      WaitlistEntry.aggregate([
        { $match: { eventId: { $in: eventIds }, status: { $in: ['waiting', 'offered'] } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } },
      ]),
    ]);

    const result = events.map((ev) => {
      const id = ev._id.toString();
      const seats = { available: 0, held: 0, booked: 0 };
      seatStats
        .filter((s) => s._id.eventId.toString() === id)
        .forEach((s) => {
          seats[s._id.status] = s.count;
        });
      const rev = revenueStats.find((r) => r._id.toString() === id);
      const wl = waitlistStats.find((w) => w._id.toString() === id);
      const totalSeats = seats.available + seats.held + seats.booked;

      return {
        ...ev.toJSON(),
        stats: {
          totalSeats,
          booked: seats.booked,
          held: seats.held,
          available: seats.available,
          occupancy: totalSeats ? Math.round((seats.booked / totalSeats) * 100) : 0,
          revenue: rev ? rev.revenue : 0,
          bookings: rev ? rev.bookings : 0,
          checkedIn: rev ? rev.checkedIn : 0,
          waitlist: wl ? wl.count : 0,
        },
      };
    });

    return res.status(200).json({ events: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/organiser/events/:id/bookings
 * Every booking for one of my events (newest first)
 */
router.get(
  '/events/:id/bookings',
  validate([param('id').isMongoId().withMessage('Valid event id is required')]),
  async (req, res, next) => {
    try {
      const event = await Event.findOne({ _id: req.params.id, ...ownershipFilter(req.user) });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      const bookings = await Booking.find({ eventId: new mongoose.Types.ObjectId(req.params.id) })
        .populate('userId', 'name email')
        .populate('seatIds', 'row number section price')
        .sort({ createdAt: -1 });

      return res.status(200).json({ event: event.toJSON(), bookings });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
