const { containsRegex } = require('../utils/regex');
const Venue = require('../models/Venue');

/**
 * Create a new venue
 * POST /api/venues
 */
async function createVenue(req, res, next) {
  try {
    const { name, city, layout } = req.body;

    const venue = new Venue({
      name: name.trim(),
      city: city.trim(),
      layout: {
        rows: layout?.rows || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        seatsPerRow: layout?.seatsPerRow || 20,
      },
    });

    await venue.save();

    return res.status(201).json({
      message: 'Venue created successfully',
      venue,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all venues
 * GET /api/venues
 */
async function getVenues(req, res, next) {
  try {
    const { city } = req.query;
    const filter = {};
    if (city) {
      filter.city = containsRegex(city);
    }

    const venues = await Venue.find(filter).sort({ name: 1 });
    return res.status(200).json({ venues });
  } catch (error) {
    next(error);
  }
}

/**
 * Get venue by ID
 * GET /api/venues/:id
 */
async function getVenueById(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    return res.status(200).json({ venue });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createVenue,
  getVenues,
  getVenueById,
};
