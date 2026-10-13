const express = require('express');
const { body } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const confirmBookingValidation = [
  body('eventId').isMongoId().withMessage('Valid eventId is required'),
  body('seatIds').isArray({ min: 1 }).withMessage('seatIds must be a non-empty array of seat IDs'),
  body('seatIds.*').isMongoId().withMessage('Each seatId must be a valid Mongo ID'),
];

router.post('/confirm', auth, validate(confirmBookingValidation), bookingController.confirmBooking);
router.get('/my', auth, bookingController.getMyBookings);

module.exports = router;
