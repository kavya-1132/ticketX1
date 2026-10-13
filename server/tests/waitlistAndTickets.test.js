const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Venue = require('../src/models/Venue');
const Event = require('../src/models/Event');
const Seat = require('../src/models/Seat');
const Booking = require('../src/models/Booking');
const WaitlistEntry = require('../src/models/WaitlistEntry');
const { generateToken } = require('../src/utils/jwt');
const { cleanExpiredHolds } = require('../src/jobs/seatExpiryJob');

describe('Phases 4-5: cancellation, FIFO waitlist and QR tickets', () => {
  let organiser;
  let otherOrganiser;
  let customers; // [owner, waiter1, waiter2]
  let tokens;
  let event;
  let seats;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  async function holdAndBook(token, seatList) {
    for (const seat of seatList) {
      const res = await request(app)
        .post(`/api/seats/${seat._id}/hold`)
        .set(auth(token))
        .send({ eventId: event._id.toString() });
      expect(res.status).toBe(200);
    }
    const res = await request(app)
      .post('/api/bookings/confirm')
      .set(auth(token))
      .send({ eventId: event._id.toString(), seatIds: seatList.map((s) => s._id.toString()) });
    expect(res.status).toBe(201);
    return res.body.booking;
  }

  beforeEach(async () => {
    organiser = await User.create({ name: 'Org', email: 'org@t.com', passwordHash: 'x', role: 'organiser' });
    otherOrganiser = await User.create({ name: 'Other Org', email: 'org2@t.com', passwordHash: 'x', role: 'organiser' });
    customers = await User.insertMany([
      { name: 'Owner', email: 'owner@t.com', passwordHash: 'x', role: 'customer' },
      { name: 'Waiter One', email: 'w1@t.com', passwordHash: 'x', role: 'customer' },
      { name: 'Waiter Two', email: 'w2@t.com', passwordHash: 'x', role: 'customer' },
    ]);
    tokens = {
      organiser: generateToken(organiser),
      otherOrganiser: generateToken(otherOrganiser),
      owner: generateToken(customers[0]),
      w1: generateToken(customers[1]),
      w2: generateToken(customers[2]),
    };

    const venue = await Venue.create({ name: 'Tiny Hall', city: 'Chennai', layout: { rows: ['A'], seatsPerRow: 2 } });
    event = await Event.create({
      title: 'Tiny Gig',
      type: 'concert',
      venueId: venue._id,
      organiserId: organiser._id,
      startsAt: new Date(Date.now() + 86400000),
      priceBySection: { General: 50 },
      status: 'published',
    });
    seats = await Seat.insertMany([
      { eventId: event._id, row: 'A', number: 1, section: 'General', price: 50 },
      { eventId: event._id, row: 'A', number: 2, section: 'General', price: 50 },
    ]);
  });

  describe('Tickets', () => {
    it('confirming returns a QR code but never exposes the raw QR token', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      expect(booking.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(booking.qrToken).toBeUndefined();

      const mine = await request(app).get('/api/bookings/my').set(auth(tokens.owner));
      expect(mine.status).toBe(200);
      expect(mine.body.bookings).toHaveLength(1);
      expect(mine.body.bookings[0].qrCode).toMatch(/^data:image\/png/);
      expect(mine.body.bookings[0].qrToken).toBeUndefined();
    });

    it('a customer cannot read someone else\'s booking', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const res = await request(app).get(`/api/bookings/${booking.id}`).set(auth(tokens.w1));
      expect(res.status).toBe(404);
    });

    it('QR verify admits once, rejects a second scan, other organisers and cancelled tickets', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const { qrToken } = await Booking.findById(booking.id);

      // Organiser of a different event: forbidden
      const wrongOrg = await request(app)
        .post('/api/tickets/verify')
        .set(auth(tokens.otherOrganiser))
        .send({ qrToken });
      expect(wrongOrg.status).toBe(403);

      // Customers can't verify tickets at all
      const asCustomer = await request(app).post('/api/tickets/verify').set(auth(tokens.w1)).send({ qrToken });
      expect(asCustomer.status).toBe(403);

      // First scan by the event's organiser (as a scanner would read it): admitted
      const first = await request(app)
        .post('/api/tickets/verify')
        .set(auth(tokens.organiser))
        .send({ qrToken: `TICKETX:${qrToken}` });
      expect(first.status).toBe(200);
      expect(first.body.valid).toBe(true);

      // Second scan: rejected
      const second = await request(app).post('/api/tickets/verify').set(auth(tokens.organiser)).send({ qrToken });
      expect(second.status).toBe(409);
      expect(second.body.error).toMatch(/already used/i);

      // A used ticket can no longer be cancelled
      const cancelUsed = await request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(tokens.owner));
      expect(cancelUsed.status).toBe(409);
    });

    it('two gates scanning the same ticket at once admit it exactly once', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const { qrToken } = await Booking.findById(booking.id);

      const scans = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app).post('/api/tickets/verify').set(auth(tokens.organiser)).send({ qrToken })
        )
      );
      expect(scans.filter((r) => r.status === 200)).toHaveLength(1);
      expect(scans.filter((r) => r.status === 409)).toHaveLength(9);
    });

    it('rejects garbage QR codes', async () => {
      const res = await request(app)
        .post('/api/tickets/verify')
        .set(auth(tokens.organiser))
        .send({ qrToken: 'hello-world' });
      expect(res.status).toBe(400);
    });
  });

  describe('Sending a ticket to a friend', () => {
    it('moves the ticket, issues a new QR and the old QR stops working', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const { qrToken: oldToken } = await Booking.findById(booking.id);

      const res = await request(app)
        .post(`/api/bookings/${booking.id}/transfer`)
        .set(auth(tokens.owner))
        .send({ email: 'w1@t.com' });
      expect(res.status).toBe(200);

      const moved = await Booking.findById(booking.id);
      expect(moved.userId.toString()).toBe(customers[1]._id.toString());
      expect(moved.qrToken).not.toBe(oldToken);
      expect(moved.transferredFrom.map(String)).toEqual([customers[0]._id.toString()]);

      // Sender no longer has it; recipient does
      const senderList = await request(app).get('/api/bookings/my').set(auth(tokens.owner));
      expect(senderList.body.bookings).toHaveLength(0);
      const recipientList = await request(app).get('/api/bookings/my').set(auth(tokens.w1));
      expect(recipientList.body.bookings).toHaveLength(1);

      // The old QR is rejected at the gate, the new one is admitted
      const oldScan = await request(app).post('/api/tickets/verify').set(auth(tokens.organiser)).send({ qrToken: oldToken });
      expect(oldScan.status).toBe(404);
      const newScan = await request(app).post('/api/tickets/verify').set(auth(tokens.organiser)).send({ qrToken: moved.qrToken });
      expect(newScan.status).toBe(200);
    });

    it('rejects sending to yourself, to unknown emails, and tickets that were already used', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const self = await request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'owner@t.com' });
      expect(self.status).toBe(400);
      const unknown = await request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'nobody@t.com' });
      expect(unknown.status).toBe(404);
      const organiserTarget = await request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'org@t.com' });
      expect(organiserTarget.status).toBe(400);

      await Booking.updateOne({ _id: booking.id }, { checkedInAt: new Date() });
      const used = await request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'w1@t.com' });
      expect(used.status).toBe(409);
    });

    it('only the owner can send it, and two simultaneous sends succeed once', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const stranger = await request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.w1)).send({ email: 'w2@t.com' });
      expect(stranger.status).toBe(404);

      const [a, b] = await Promise.all([
        request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'w1@t.com' }),
        request(app).post(`/api/bookings/${booking.id}/transfer`).set(auth(tokens.owner)).send({ email: 'w2@t.com' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });
  });

  describe('Cancellation', () => {
    it('cancelling with nobody waiting puts the seats back on sale', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0], seats[1]]);

      const res = await request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(tokens.owner));
      expect(res.status).toBe(200);

      const fresh = await Seat.find({ eventId: event._id });
      fresh.forEach((s) => {
        expect(s.status).toBe('available');
        expect(s.bookingId).toBeNull();
      });
      const dbBooking = await Booking.findById(booking.id);
      expect(dbBooking.status).toBe('cancelled');
      expect(dbBooking.seatsReleasedAt).not.toBeNull();
    });

    it('only the owner can cancel', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const res = await request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(tokens.w1));
      expect(res.status).toBe(404);
    });

    it('ten simultaneous cancel clicks succeed exactly once', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0]]);
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(tokens.owner))
        )
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    });
  });

  describe('Waitlist', () => {
    it('cannot join while seats are still available', async () => {
      const res = await request(app).post(`/api/waitlist/${event._id}/join`).set(auth(tokens.w1));
      expect(res.status).toBe(400);
    });

    it('FIFO: a cancelled seat is offered to the earliest waiter, who can then book it', async () => {
      const booking = await holdAndBook(tokens.owner, [seats[0], seats[1]]); // sold out

      const join1 = await request(app).post(`/api/waitlist/${event._id}/join`).set(auth(tokens.w1));
      expect(join1.status).toBe(201);
      const join2 = await request(app).post(`/api/waitlist/${event._id}/join`).set(auth(tokens.w2));
      expect(join2.status).toBe(201);
      const dup = await request(app).post(`/api/waitlist/${event._id}/join`).set(auth(tokens.w1));
      expect(dup.status).toBe(409);

      // Make the queue order explicit (w1 joined first)
      await WaitlistEntry.updateOne({ userId: customers[1]._id }, { createdAt: new Date(Date.now() - 2000) });

      // Owner cancels both seats -> w1 gets one offer, w2 gets the other (FIFO, one seat each)
      const cancel = await request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(tokens.owner));
      expect(cancel.status).toBe(200);

      const offers = await WaitlistEntry.find({ eventId: event._id, status: 'offered' }).sort({ createdAt: 1 });
      expect(offers).toHaveLength(2);
      expect(offers[0].userId.toString()).toBe(customers[1]._id.toString());

      const w1Seat = await Seat.findById(offers[0].offeredSeatId);
      expect(w1Seat.status).toBe('held');
      expect(w1Seat.heldBy.toString()).toBe(customers[1]._id.toString());
      // Offer window ~15 minutes
      const windowMs = new Date(w1Seat.holdUntil).getTime() - Date.now();
      expect(windowMs).toBeGreaterThan(14 * 60 * 1000);
      expect(windowMs).toBeLessThanOrEqual(15 * 60 * 1000);

      // Nobody else can grab the offered seat
      const steal = await request(app)
        .post(`/api/seats/${w1Seat._id}/hold`)
        .set(auth(tokens.owner))
        .send({ eventId: event._id.toString() });
      expect(steal.status).toBe(409);

      // w1 sees the offer...
      const mine = await request(app).get('/api/waitlist/my').set(auth(tokens.w1));
      expect(mine.body.entries[0].status).toBe('offered');

      // ...and books it with the normal confirm call
      const confirm = await request(app)
        .post('/api/bookings/confirm')
        .set(auth(tokens.w1))
        .send({ eventId: event._id.toString(), seatIds: [w1Seat._id.toString()] });
      expect(confirm.status).toBe(201);

      const accepted = await WaitlistEntry.findById(offers[0]._id);
      expect(accepted.status).toBe('accepted');
    });

    it('an expired offer moves on to the next person in line', async () => {
      // Sold out as two separate bookings, so we can free exactly one seat
      const bookingA1 = await holdAndBook(tokens.owner, [seats[0]]);
      await holdAndBook(tokens.owner, [seats[1]]);

      await WaitlistEntry.create({ eventId: event._id, userId: customers[1]._id, createdAt: new Date(Date.now() - 3000) });
      await WaitlistEntry.create({ eventId: event._id, userId: customers[2]._id, createdAt: new Date(Date.now() - 1000) });

      await request(app).post(`/api/bookings/${bookingA1.id}/cancel`).set(auth(tokens.owner));

      // w1 (first in line) has the offer, w2 is still waiting at position 1
      const w1Offer = await WaitlistEntry.findOne({ userId: customers[1]._id });
      expect(w1Offer.status).toBe('offered');
      expect(w1Offer.offeredSeatId.toString()).toBe(seats[0]._id.toString());
      const w2View = await request(app).get('/api/waitlist/my').set(auth(tokens.w2));
      expect(w2View.body.entries[0].status).toBe('waiting');
      expect(w2View.body.entries[0].position).toBe(1);

      // Simulate the 15 minutes passing without w1 booking
      const past = new Date(Date.now() - 1000);
      await WaitlistEntry.updateOne({ _id: w1Offer._id }, { offerExpiresAt: past });
      await Seat.updateOne({ _id: seats[0]._id }, { holdUntil: past });

      await cleanExpiredHolds(null);

      expect((await WaitlistEntry.findById(w1Offer._id)).status).toBe('expired');
      const w2Offer = await WaitlistEntry.findOne({ userId: customers[2]._id });
      expect(w2Offer.status).toBe('offered');
      const seat = await Seat.findById(seats[0]._id);
      expect(seat.status).toBe('held');
      expect(seat.heldBy.toString()).toBe(customers[2]._id.toString());

      // w2's offer also lapses -> nobody left, seat goes back on sale
      await WaitlistEntry.updateOne({ _id: w2Offer._id }, { offerExpiresAt: past });
      await Seat.updateOne({ _id: seats[0]._id }, { holdUntil: past });
      await cleanExpiredHolds(null);
      expect((await Seat.findById(seats[0]._id)).status).toBe('available');
    });

    it('leaving the waitlist while holding an offer passes the seat to the next person', async () => {
      const bookingA1 = await holdAndBook(tokens.owner, [seats[0]]);
      await holdAndBook(tokens.owner, [seats[1]]);
      await WaitlistEntry.create({ eventId: event._id, userId: customers[1]._id, createdAt: new Date(Date.now() - 3000) });
      await WaitlistEntry.create({ eventId: event._id, userId: customers[2]._id, createdAt: new Date(Date.now() - 1000) });

      await request(app).post(`/api/bookings/${bookingA1.id}/cancel`).set(auth(tokens.owner));
      const leave = await request(app).delete(`/api/waitlist/${event._id}`).set(auth(tokens.w1));
      expect(leave.status).toBe(200);

      const seat = await Seat.findById(seats[0]._id);
      expect(seat.heldBy.toString()).toBe(customers[2]._id.toString());
    });

    it('two expiry-job runs at once never offer the same seat twice', async () => {
      await holdAndBook(tokens.owner, [seats[1]]);
      // Seat A1: an expired ordinary hold; five people waiting
      await Seat.updateOne(
        { _id: seats[0]._id },
        { status: 'held', heldBy: customers[0]._id, holdUntil: new Date(Date.now() - 1000) }
      );
      const extra = await User.insertMany(
        Array.from({ length: 5 }, (_, i) => ({ name: `Q${i}`, email: `q${i}@t.com`, passwordHash: 'x', role: 'customer' }))
      );
      await WaitlistEntry.insertMany(
        extra.map((u, i) => ({ eventId: event._id, userId: u._id, createdAt: new Date(Date.now() - (10 - i) * 1000) }))
      );

      await Promise.all([cleanExpiredHolds(null), cleanExpiredHolds(null), cleanExpiredHolds(null)]);

      const offered = await WaitlistEntry.find({ status: 'offered' });
      expect(offered).toHaveLength(1);
      // FIFO: the earliest waiter got it
      expect(offered[0].userId.toString()).toBe(extra[0]._id.toString());
      const seat = await Seat.findById(seats[0]._id);
      expect(seat.heldBy.toString()).toBe(extra[0]._id.toString());
      // Everyone else is still waiting, in place
      expect(await WaitlistEntry.countDocuments({ status: 'waiting' })).toBe(4);
    });
  });
});
