const { containsRegex } = require('../utils/regex');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Seat = require('../models/Seat');
const { generateSeatsForEvent } = require('../services/seatGenerator');

/**
 * Create a new event and automatically generate seats from the venue layout
 * POST /api/events
 */
async function createEvent(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { title, type, venueId, startsAt, priceBySection, description, bannerUrl } = req.body;

    const venue = await Venue.findById(venueId).session(session);
    if (!venue) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Venue not found' });
    }

    const [event] = await Event.create(
      [
        {
          title: title.trim(),
          type,
          venueId: venue._id,
          organiserId: req.user._id,
          startsAt: new Date(startsAt),
          priceBySection,
          description: description || '',
          bannerUrl: bannerUrl || '',
          status: 'published',
        },
      ],
      { session }
    );

    // Auto-generate seats from venue layout
    const generatedSeats = await generateSeatsForEvent(event, venue, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: 'Event created successfully and seats generated from venue layout',
      event,
      seatsGenerated: generatedSeats.length,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

/**
 * List events with filtering by type, city, and search
 * GET /api/events
 */
async function getEvents(req, res, next) {
  try {
    const { type, city, search } = req.query;
    const filter = { status: 'published' };

    if (type && ['movie', 'concert'].includes(type)) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { title: containsRegex(search) },
        { description: containsRegex(search) },
      ];
    }

    let query = Event.find(filter)
      .populate('venueId', 'name city layout')
      .populate('organiserId', 'name email')
      .sort({ startsAt: 1 });

    let events = await query;

    // Filter by venue city if provided
    if (city) {
      const cityRegex = containsRegex(city);
      events = events.filter((ev) => ev.venueId && cityRegex.test(ev.venueId.city));
    }

    // Attach seat availability stats for each event
    const now = new Date();
    const eventSummaries = await Promise.all(
      events.map(async (ev) => {
        const totalSeats = await Seat.countDocuments({ eventId: ev._id });
        const availableSeats = await Seat.countDocuments({
          eventId: ev._id,
          $or: [
            { status: 'available' },
            { status: 'held', holdUntil: { $lt: now } },
          ],
        });

        const evObj = ev.toJSON();
        evObj.totalSeats = totalSeats;
        evObj.availableSeats = availableSeats;
        return evObj;
      })
    );

    return res.status(200).json({ events: eventSummaries });
  } catch (error) {
    next(error);
  }
}

/**
 * Get event details by ID
 * GET /api/events/:id
 */
async function getEventById(req, res, next) {
  try {
    const event = await Event.findById(req.params.id)
      .populate('venueId', 'name city layout')
      .populate('organiserId', 'name email');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const now = new Date();
    const totalSeats = await Seat.countDocuments({ eventId: event._id });
    const availableSeats = await Seat.countDocuments({
      eventId: event._id,
      $or: [
        { status: 'available' },
        { status: 'held', holdUntil: { $lt: now } },
      ],
    });

    const evObj = event.toJSON();
    evObj.totalSeats = totalSeats;
    evObj.availableSeats = availableSeats;

    return res.status(200).json({ event: evObj });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all seats for an event (for interactive seat map rendering)
 * GET /api/events/:id/seats
 */
async function getEventSeats(req, res, next) {
  try {
    const { id } = req.params;
    const now = new Date();

    const seats = await Seat.find({ eventId: id }).sort({ row: 1, number: 1 });

    // Normalize display status for seats where hold has expired
    const normalizedSeats = seats.map((seat) => {
      const s = seat.toJSON();
      if (s.status === 'held' && s.holdUntil && new Date(s.holdUntil) < now) {
        s.status = 'available';
        s.heldBy = null;
        s.holdUntil = null;
      }
      return s;
    });

    return res.status(200).json({ seats: normalizedSeats });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  getEventSeats,
};
