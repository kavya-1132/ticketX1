const express = require('express');
const { body } = require('express-validator');
const seatController = require('../controllers/seatController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const seatActionValidation = [
  body('eventId').isMongoId().withMessage('Valid eventId is required'),
];

router.post('/:id/hold', auth, validate(seatActionValidation), seatController.holdSeat);
router.post('/:id/release', auth, validate(seatActionValidation), seatController.releaseSeat);

module.exports = router;
