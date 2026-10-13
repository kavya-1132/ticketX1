const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Venue = require('../src/models/Venue');
const Event = require('../src/models/Event');
const Seat = require('../src/models/Seat');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 3 Concurrency Race Test: 50 Users Contending for 1 Seat', () => {
  let users = [];
  let userTokens = [];
  let testVenue;
  let testEvent;

  beforeEach(async () => {
    // 1. Create 50 distinct test customer users
    const userDocs = [];
    for (let i = 1; i <= 50; i++) {
      userDocs.push({
        name: `Racer User ${i}`,
        email: `racer${i}@concurrency-test.com`,
        passwordHash: 'dummy_hash_for_race',
        role: 'customer',
      });
    }
    users = await User.insertMany(userDocs);
    userTokens = users.map((u) => generateToken(u));

    // 2. Create a test venue
    testVenue = await Venue.create({
      name: 'High Contention Arena',
      city: 'Concurrencyland',
      layout: {
        rows: ['A'],
        seatsPerRow: 50,
      },
    });

    // 3. Create a test event
    testEvent = await Event.create({
      title: 'Mega Sold-Out Flash Sale',
      type: 'concert',
      venueId: testVenue._id,
      organiserId: users[0]._id,
      startsAt: new Date(Date.now() + 86400000),
      priceBySection: { General: 100 },
      status: 'published',
    });
  });

  it('runs 20 consecutive races in a loop: exactly 1 of 50 users gets 200, 49 get 409, and DB shows one holder each time', async () => {
    for (let iteration = 1; iteration <= 20; iteration++) {
      // Reset seats before each race so all 50 users start with 0 held seats
      await Seat.deleteMany({});

      // Create a fresh available seat for this race iteration
      const seat = await Seat.create({
        eventId: testEvent._id,
        row: 'A',
        number: iteration,
        section: 'General',
        price: 100,
        status: 'available',
        heldBy: null,
        holdUntil: null,
      });

      // Dispatch 50 concurrent hold requests simultaneously for this exact seat
      const holdPromises = userTokens.map((token) =>
        request(app)
          .post(`/api/seats/${seat._id}/hold`)
          .set('Authorization', `Bearer ${token}`)
          .send({ eventId: testEvent._id.toString() })
      );

      const responses = await Promise.all(holdPromises);

      // Analyze HTTP response codes
      const successes = responses.filter((r) => r.status === 200);
      const conflicts = responses.filter((r) => r.status === 409);
      const otherErrors = responses.filter((r) => r.status !== 200 && r.status !== 409);

      // Invariant checks for iteration
      expect(otherErrors.length).toBe(0);
      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(49);

      conflicts.forEach((conflict) => {
        expect(conflict.body.error).toMatch(/seat just taken/i);
      });

      // Winning user info from response
      const winningResponse = successes[0];
      const winningUserId = winningResponse.body.seat.heldBy;

      // Database verification
      const seatInDb = await Seat.findById(seat._id);
      expect(seatInDb).not.toBeNull();
      expect(seatInDb.status).toBe('held');
      expect(seatInDb.heldBy.toString()).toBe(winningUserId.toString());
      expect(new Date(seatInDb.holdUntil).getTime()).toBeGreaterThan(Date.now());

      // Print confirmation per iteration
      // eslint-disable-next-line no-console
      console.log(`[Race Iteration ${iteration.toString().padStart(2, '0')}/20 PASSED] Winner: User ${winningUserId} (1x 200 OK, 49x 409 Conflict)`);
    }
  }, 120000);
});
