const express = require('express');
const { param } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const waitlistService = require('../services/waitlistService');

const router = express.Router();

const eventIdValidation = [param('eventId').isMongoId().withMessage('Valid eventId is required')];

/**
 * GET /api/waitlist/my
 * The caller's active waitlist entries: queue position, or the seat on offer and when it expires
 */
router.get('/my', auth, async (req, res, next) => {
  try {
    const entries = await waitlistService.getMyWaitlist(req.user._id);
    return res.status(200).json({ entries });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/waitlist/:eventId/join
 * Customers only, and only when no seat can be held
 */
router.post(
  '/:eventId/join',
  auth,
  requireRole('customer'),
  validate(eventIdValidation),
  async (req, res, next) => {
    try {
      const entry = await waitlistService.joinWaitlist({
        eventId: req.params.eventId,
        userId: req.user._id,
      });
      return res.status(201).json({ message: 'Joined the waitlist', entry });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/waitlist/:eventId
 * Leave the waitlist; a held offer is passed straight to the next person
 */
router.delete('/:eventId', auth, validate(eventIdValidation), async (req, res, next) => {
  try {
    await waitlistService.leaveWaitlist({
      eventId: req.params.eventId,
      userId: req.user._id,
      io: req.app.get('io'),
    });
    return res.status(200).json({ message: 'Left the waitlist' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
