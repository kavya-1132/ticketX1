const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Venue = require('../src/models/Venue');
const Event = require('../src/models/Event');
const Seat = require('../src/models/Seat');
const Booking = require('../src/models/Booking');
const { generateToken } = require('../src/utils/jwt');
const { cleanExpiredHolds } = require('../src/jobs/seatExpiryJob');

describe('Phase 2 & 3: Events, Seats, Atomic Locks & Transactions', () => {
  let organiserToken;
  let customerToken;
  let customer2Token;
  let organiserUser;
  let customerUser;
  let customer2User;
  let venue;

  beforeEach(async () => {
    organiserUser = await User.create({
      name: 'Event Host Org',
      email: 'host@org.com',
      passwordHash: 'dummy',
      role: 'organiser',
    });
    organiserToken = generateToken(organiserUser);

    customerUser = await User.create({
      name: 'Booking Customer',
      email: 'cust@booker.com',
      passwordHash: 'dummy',
      role: 'customer',
    });
    customerToken = generateToken(customerUser);

    customer2User = await User.create({
      name: 'Second Customer',
      email: 'cust2@booker.com',
      passwordHash: 'dummy',
      role: 'customer',
    });
    customer2Token = generateToken(customer2User);

    venue = await Venue.create({
      name: 'Metropolis Arena',
      city: 'Gotham',
      layout: {
        rows: ['A', 'B', 'C', 'D'],
        seatsPerRow: 10,
      },
    });
  });

  describe('Event Creation & Seat Generation (Phase 2)', () => {
    it('should create an event and generate seats matching venue layout', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Batman Live Symphony',
          type: 'concert',
          venueId: venue._id.toString(),
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          priceBySection: {
            VIP: 150,
            General: 50,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.seatsGenerated).toBe(40); // 4 rows * 10 seatsPerRow = 40 seats

      // Verify in database
      const count = await Seat.countDocuments({ eventId: res.body.event.id });
      expect(count).toBe(40);

      // Check seat numbers and rows
      const seatA1 = await Seat.findOne({ eventId: res.body.event.id, row: 'A', number: 1 });
      expect(seatA1).not.toBeNull();
      expect(seatA1.status).toBe('available');
    });

    it('should filter events by type and city', async () => {
      // Create concert in Gotham
      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Rock Concert',
          type: 'concert',
          venueId: venue._id.toString(),
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          priceBySection: { General: 50 },
        });

      // Create movie venue in Metropolis
      const venue2 = await Venue.create({
        name: 'Daily Planet Cinema',
        city: 'Metropolis',
        layout: { rows: ['A'], seatsPerRow: 5 },
      });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Superman Documentary',
          type: 'movie',
          venueId: venue2._id.toString(),
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          priceBySection: { General: 20 },
        });

      // Filter by type=movie
      const resMovie = await request(app).get('/api/events?type=movie');
      expect(resMovie.status).toBe(200);
      expect(resMovie.body.events.length).toBe(1);
      expect(resMovie.body.events[0].title).toBe('Superman Documentary');

      // Filter by city=Gotham
      const resCity = await request(app).get('/api/events?city=Gotham');
      expect(resCity.status).toBe(200);
      expect(resCity.body.events.length).toBe(1);
      expect(resCity.body.events[0].title).toBe('Rock Concert');
    });
  });

  describe('Seat Hold, Max Limit, Release, and Transactional Booking (Phase 3)', () => {
    let event;
    let seat1;
    let seat2;

    beforeEach(async () => {
      event = await Event.create({
        title: 'Festival 2026',
        type: 'concert',
        venueId: venue._id,
        organiserId: organiserUser._id,
        startsAt: new Date(Date.now() + 86400000),
        priceBySection: { General: 80 },
        status: 'published',
      });

      seat1 = await Seat.create({
        eventId: event._id,
        row: 'A',
        number: 1,
        section: 'General',
        price: 80,
        status: 'available',
      });

      seat2 = await Seat.create({
        eventId: event._id,
        row: 'A',
        number: 2,
        section: 'General',
        price: 80,
        status: 'available',
      });
    });

    it('should allow customer to hold seat and block others with 409', async () => {
      // Customer 1 holds seat1
      const resHold = await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      expect(resHold.status).toBe(200);
      expect(resHold.body.seat.status).toBe('held');
      expect(resHold.body.seat.heldBy).toBe(customerUser._id.toString());

      // Customer 2 tries to hold seat1 -> 409 Conflict
      const resConflict = await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ eventId: event._id.toString() });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error).toMatch(/seat just taken/i);
    });

    it('should enforce rule 6: Max 6 seats held per customer per event', async () => {
      // Create 6 more seats and hold them
      const seats = await Seat.insertMany([
        { eventId: event._id, row: 'B', number: 1, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 2, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 3, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 4, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 5, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 6, section: 'General', price: 50, status: 'available' },
        { eventId: event._id, row: 'B', number: 7, section: 'General', price: 50, status: 'available' },
      ]);

      // Hold 6 seats
      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post(`/api/seats/${seats[i]._id}/hold`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ eventId: event._id.toString() });
        expect(res.status).toBe(200);
      }

      // Try holding 7th seat -> 400
      const resOverLimit = await request(app)
        .post(`/api/seats/${seats[6]._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      expect(resOverLimit.status).toBe(400);
      expect(resOverLimit.body.error).toMatch(/maximum 6 seats/i);
    });

    it('should allow customer to release held seat back to available', async () => {
      // Hold seat1
      await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      // Customer 2 cannot release Customer 1's hold
      const resFailRelease = await request(app)
        .post(`/api/seats/${seat1._id}/release`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ eventId: event._id.toString() });
      expect(resFailRelease.status).toBe(404);

      // Customer 1 releases seat1
      const resRelease = await request(app)
        .post(`/api/seats/${seat1._id}/release`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      expect(resRelease.status).toBe(200);
      expect(resRelease.body.seat.status).toBe('available');

      // Now Customer 2 can hold it
      const resHoldNow = await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ eventId: event._id.toString() });
      expect(resHoldNow.status).toBe(200);
    });

    it('should confirm multi-seat booking inside an ACID transaction', async () => {
      // Customer holds both seat1 and seat2
      await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      await request(app)
        .post(`/api/seats/${seat2._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      // Confirm booking
      const resConfirm = await request(app)
        .post('/api/bookings/confirm')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: event._id.toString(),
          seatIds: [seat1._id.toString(), seat2._id.toString()],
        });

      expect(resConfirm.status).toBe(201);
      expect(resConfirm.body.booking.status).toBe('confirmed');
      expect(resConfirm.body.booking.total).toBe(160);

      // Verify seats in database are now 'booked'
      const updatedSeat1 = await Seat.findById(seat1._id);
      const updatedSeat2 = await Seat.findById(seat2._id);
      expect(updatedSeat1.status).toBe('booked');
      expect(updatedSeat2.status).toBe('booked');
      expect(updatedSeat1.bookingId.toString()).toBe(resConfirm.body.booking.id);
    });

    it('should abort entire multi-seat booking if any seat hold has expired or is invalid', async () => {
      // Customer holds seat1
      await request(app)
        .post(`/api/seats/${seat1._id}/hold`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ eventId: event._id.toString() });

      // seat2 is held by Customer 2 (not Customer 1)
      await request(app)
        .post(`/api/seats/${seat2._id}/hold`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ eventId: event._id.toString() });

      // Customer 1 tries to confirm both seat1 AND seat2
      const resConfirm = await request(app)
        .post('/api/bookings/confirm')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: event._id.toString(),
          seatIds: [seat1._id.toString(), seat2._id.toString()],
        });

      expect(resConfirm.status).toBe(409);
      expect(resConfirm.body.error).toMatch(/aborted/i);

      // Verify transaction rollback: seat1 MUST NOT be booked!
      const seat1Check = await Seat.findById(seat1._id);
      expect(seat1Check.status).toBe('held'); // Still held, not booked!

      const bookingsCount = await Booking.countDocuments();
      expect(bookingsCount).toBe(0);
    });

    it('should sweep expired holds back to available via cleanExpiredHolds job', async () => {
      // Seat held in the past (expired)
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      await Seat.findByIdAndUpdate(seat1._id, {
        status: 'held',
        heldBy: customerUser._id,
        holdUntil: pastDate,
      });

      // Run expiry job
      const sweptCount = await cleanExpiredHolds(null);
      expect(sweptCount).toBe(1);

      const seat1Db = await Seat.findById(seat1._id);
      expect(seat1Db.status).toBe('available');
      expect(seat1Db.heldBy).toBeNull();
      expect(seat1Db.holdUntil).toBeNull();
    });
  });
});
