const express = require('express');
const { body } = require('express-validator');
const eventController = require('../controllers/eventController');
const { auth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const createEventValidation = [
  body('title').trim().notEmpty().withMessage('Event title is required'),
  body('type').isIn(['movie', 'concert']).withMessage('Event type must be movie or concert'),
  body('venueId').isMongoId().withMessage('Valid venueId is required'),
  body('startsAt').isISO8601().toDate().withMessage('Valid ISO8601 startsAt date is required'),
  body('priceBySection').isObject().withMessage('priceBySection must be an object with section pricing'),
];

router.post(
  '/',
  auth,
  requireRole('organiser', 'admin'),
  validate(createEventValidation),
  eventController.createEvent
);

router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.get('/:id/seats', eventController.getEventSeats);

module.exports = router;
