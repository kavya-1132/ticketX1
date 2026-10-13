require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('./db');

const Venue = require('../models/Venue');
const Event = require('../models/Event');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const WaitlistEntry = require('../models/WaitlistEntry');
const { generateQrToken } = require('../services/qrService');
const { generateSeatsForEvent } = require('../services/seatGenerator');

const SEED_USERS = [
  // 1 Admin
  {
    name: 'TicketX Administrator',
    email: 'admin@ticketx.com',
    password: 'Password123!',
    role: 'admin',
    isBlocked: false,
  },
  // 2 Organisers
  {
    name: 'Cinema World Studios',
    email: 'cinema@ticketx.com',
    password: 'Password123!',
    role: 'organiser',
    isBlocked: false,
  },
  {
    name: 'Live Beats Concerts',
    email: 'concerts@ticketx.com',
    password: 'Password123!',
    role: 'organiser',
    isBlocked: false,
  },
  // 5 Customers
  {
    name: 'Alice Johnson',
    email: 'alice@ticketx.com',
    password: 'Password123!',
    role: 'customer',
    isBlocked: false,
  },
  {
    name: 'Bob Smith',
    email: 'bob@ticketx.com',
    password: 'Password123!',
    role: 'customer',
    isBlocked: false,
  },
  {
    name: 'Charlie Davis',
    email: 'charlie@ticketx.com',
    password: 'Password123!',
    role: 'customer',
    isBlocked: false,
  },
  {
    name: 'Diana Patel',
    email: 'diana@ticketx.com',
    password: 'Password123!',
    role: 'customer',
    isBlocked: false,
  },
  {
    name: 'Evan Wright',
    email: 'evan@ticketx.com',
    password: 'Password123!',
    role: 'customer',
    isBlocked: false,
  },
];

async function seedUsers() {
  try {
    if (mongoose.connection.readyState === 0) {
      // eslint-disable-next-line no-console
      console.log('Connecting to database for seeding...');
      await connectDB();
    }

    // eslint-disable-next-line no-console
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Venue.deleteMany({});
    await Event.deleteMany({});
    await Seat.deleteMany({});
    await Booking.deleteMany({});
    await WaitlistEntry.deleteMany({});

    const saltRounds = 10;
    const usersToInsert = await Promise.all(
      SEED_USERS.map(async (u) => {
        const passwordHash = await bcrypt.hash(u.password, saltRounds);
        return {
          name: u.name,
          email: u.email.toLowerCase().trim(),
          passwordHash,
          role: u.role,
          isBlocked: u.isBlocked,
        };
      })
    );

    const insertedUsers = await User.insertMany(usersToInsert);
    // eslint-disable-next-line no-console
    console.log(`\nSuccessfully seeded ${insertedUsers.length} users into TicketX:\n`);

    SEED_USERS.forEach((u) => {
      // eslint-disable-next-line no-console
      console.log(`  - [${u.role.toUpperCase()}] ${u.name.padEnd(26)} | Email: ${u.email.padEnd(20)} | Password: ${u.password}`);
    });

    const cinemaOrg = insertedUsers.find((u) => u.email === 'cinema@ticketx.com');
    const concertOrg = insertedUsers.find((u) => u.email === 'concerts@ticketx.com');

    // 1. Venue 1 (cinema, 250 seats: 10 rows x 25 seats)
    const venue1 = await Venue.create({
      name: 'Grand Horizon Cinema',
      city: 'Los Angeles',
      layout: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        seatsPerRow: 25,
      },
    });

    // 2. Venue 2 (Arena, 240 seats: 12 rows x 20 seats)
    const venue2 = await Venue.create({
      name: 'Riverside Grand Arena',
      city: 'London',
      layout: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
        seatsPerRow: 20,
      },
    });

    // 3. Venue 3 (Symphony Hall, 220 seats: 11 rows x 20 seats)
    const venue3 = await Venue.create({
      name: 'Metro Symphony Hall',
      city: 'New York',
      layout: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
        seatsPerRow: 20,
      },
    });

    // Seed Event 1 (Movie, 250 seats)
    const event1 = await Event.create({
      title: 'Starfall: 70mm Anniversary Screening',
      type: 'movie',
      venueId: venue1._id,
      organiserId: cinemaOrg._id,
      startsAt: new Date(Date.now() + 3 * 86400000), // 3 days from now
      priceBySection: {
        VIP: 35,
        Premium: 25,
        General: 18,
      },
      description: 'A space epic back on the big screen in glorious 70mm, with a remastered soundtrack.',
      status: 'published',
    });
    const seats1 = await generateSeatsForEvent(event1, venue1);

    // Seed Event 2 (Concert, 240 seats)
    const event2 = await Event.create({
      title: 'Neon Skies: World Tour Live',
      type: 'concert',
      venueId: venue2._id,
      organiserId: concertOrg._id,
      startsAt: new Date(Date.now() + 7 * 86400000), // 7 days from now
      priceBySection: {
        VIP: 220,
        Premium: 140,
        General: 85,
      },
      description: 'A stadium-sized night of anthems, light shows and confetti from an award-winning live band.',
      status: 'published',
    });
    const seats2 = await generateSeatsForEvent(event2, venue2);

    // Seed Event 3 (Concert, 220 seats)
    const event3 = await Event.create({
      title: 'Symphonic Odyssey: Film Scores Live',
      type: 'concert',
      venueId: venue3._id,
      organiserId: concertOrg._id,
      startsAt: new Date(Date.now() + 14 * 86400000), // 14 days from now
      priceBySection: {
        VIP: 180,
        Premium: 120,
        General: 75,
      },
      description: 'Epic film and game soundtracks performed live by a full orchestra and choir.',
      status: 'published',
    });
    const seats3 = await generateSeatsForEvent(event3, venue3);

    // eslint-disable-next-line no-console
    console.log(`\nSuccessfully seeded 3 Events with 200+ seats each:`);
    // eslint-disable-next-line no-console
    console.log(`  1. "${event1.title}" (${seats1.length} seats) at ${venue1.name}, ${venue1.city}`);
    // eslint-disable-next-line no-console
    console.log(`  2. "${event2.title}" (${seats2.length} seats) at ${venue2.name}, ${venue2.city}`);
    // eslint-disable-next-line no-console
    console.log(`  3. "${event3.title}" (${seats3.length} seats) at ${venue3.name}, ${venue3.city}`);
    // eslint-disable-next-line no-console
    console.log(`\nTotal Seats Generated: ${seats1.length + seats2.length + seats3.length}`);

    // Seed Event 4: a tiny SOLD-OUT show for demoing the waitlist.
    // Bob and Charlie own all 12 seats. Log in as Alice, join the waitlist,
    // then log in as Bob and cancel his booking: Alice is offered his seats for 15 minutes.
    const studio = await Venue.create({
      name: 'Basement Jazz Studio',
      city: 'Chennai',
      layout: { rows: ['A', 'B'], seatsPerRow: 6 },
    });
    const soldOut = await Event.create({
      title: 'Sold-Out Jazz Night (Waitlist Demo)',
      type: 'concert',
      venueId: studio._id,
      organiserId: concertOrg._id,
      startsAt: new Date(Date.now() + 5 * 86400000),
      priceBySection: { General: 40 },
      description: 'A deliberately sold-out show. Join the waitlist, then cancel a booking as another user to watch the FIFO hand-off.',
      status: 'published',
    });
    const soldOutSeats = await generateSeatsForEvent(soldOut, studio);
    const bob = insertedUsers.find((u) => u.email === 'bob@ticketx.com');
    const charlie = insertedUsers.find((u) => u.email === 'charlie@ticketx.com');
    for (const [owner, row] of [[bob, 'A'], [charlie, 'B']]) {
      const rowSeats = soldOutSeats.filter((s) => s.row === row);
      const booking = await Booking.create({
        userId: owner._id,
        eventId: soldOut._id,
        seatIds: rowSeats.map((s) => s._id),
        total: rowSeats.reduce((sum, s) => sum + s.price, 0),
        status: 'confirmed',
        qrToken: generateQrToken(),
      });
      await Seat.updateMany(
        { _id: { $in: rowSeats.map((s) => s._id) } },
        { $set: { status: 'booked', bookingId: booking._id } }
      );
    }
    // eslint-disable-next-line no-console
    console.log(`  4. "${soldOut.title}" (${soldOutSeats.length} seats, all booked by Bob + Charlie)`);

    // Record which version of the demo data this database holds
    await mongoose.connection.db
      .collection('meta')
      .updateOne({ _id: 'seed' }, { $set: { version: SEED_VERSION, seededAt: new Date() } }, { upsert: true });

    // eslint-disable-next-line no-console
    console.log('\nSeeding complete.');
    return {
      users: insertedUsers,
      events: [event1, event2, event3, soldOut],
      totalSeats: seats1.length + seats2.length + seats3.length,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    if (require.main === module) {
      await disconnectDB();
    }
  }
}

if (require.main === module) {
  seedUsers().then(() => process.exit(0));
}

// Bump when the demo data changes, so a live demo reseeds on its next start
const SEED_VERSION = '2026-10-13-fictional-events';

module.exports = { seedUsers, SEED_USERS, SEED_VERSION };
