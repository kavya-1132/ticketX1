const express = require('express');
const { body, param } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const confirmBookingValidation = [
  body('eventId').isMongoId().withMessage('Valid eventId is required'),
  body('seatIds').isArray({ min: 1, max: 6 }).withMessage('seatIds must be an array of 1 to 6 seat IDs'),
  body('seatIds.*').isMongoId().withMessage('Each seatId must be a valid Mongo ID'),
];

const bookingIdValidation = [param('id').isMongoId().withMessage('Valid booking id is required')];

router.post('/confirm', auth, validate(confirmBookingValidation), bookingController.confirmBooking);
router.get('/my', auth, bookingController.getMyBookings);
router.get('/:id', auth, validate(bookingIdValidation), bookingController.getBookingById);
router.post('/:id/cancel', auth, validate(bookingIdValidation), bookingController.cancelBooking);

module.exports = router;
