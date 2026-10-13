const express = require('express');
const { body } = require('express-validator');
const venueController = require('../controllers/venueController');
const { auth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const createVenueValidation = [
  body('name').trim().notEmpty().withMessage('Venue name is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('layout.seatsPerRow')
    .isInt({ min: 1, max: 100 })
    .withMessage('seatsPerRow must be an integer between 1 and 100'),
  body('layout.rows')
    .isArray({ min: 1 })
    .withMessage('rows must be a non-empty array of row labels'),
];

router.post(
  '/',
  auth,
  requireRole('organiser', 'admin'),
  validate(createVenueValidation),
  venueController.createVenue
);

router.get('/', venueController.getVenues);
router.get('/:id', venueController.getVenueById);

module.exports = router;
