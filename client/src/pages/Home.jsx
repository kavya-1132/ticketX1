import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvents } from '../api/events';
import MarqueeSign from '../components/MarqueeSign';
import EventPoster from '../components/EventPoster';
import { MapPin, Hourglass, ScanLine } from 'lucide-react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function when(date) {
  return new Date(date).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The marquee: cycles through what's on sale, with how full the house is. */
function NowBooking({ events }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (events.length < 2 || paused || prefersReducedMotion()) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % events.length), 5000);
    return () => clearInterval(t);
  }, [events.length, paused]);

  if (events.length === 0) {
    return (
      <MarqueeSign>
        <div className="space-y-4 py-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-2 w-full" />
        </div>
      </MarqueeSign>
    );
  }

  const ev = events[index % events.length];
  const total = ev.totalSeats || 0;
  const left = ev.availableSeats ?? 0;
  const filled = total ? Math.round(((total - left) / total) * 100) : 0;
  const soldOut = left === 0;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <MarqueeSign>
        <div className="min-h-[230px] sm:min-h-[250px] flex flex-col">
          <p className="text-sm font-semibold text-marquee-300">Now booking</p>

          <div key={ev.id} className="animate-flip-in flex-1 flex flex-col">
            <h2
              className="font-display font-black uppercase text-marquee-200 leading-[0.9] text-[2.6rem] sm:text-6xl mt-2"
              style={{ textShadow: '0 0 24px rgba(255,200,87,0.35)', textWrap: 'balance' }}
            >
              {ev.title.split(':')[0]}
            </h2>
            <p className="text-slate-300 text-sm mt-2">{when(ev.startsAt)}</p>
            {ev.venueId && (
              <p className="text-slate-400 text-sm flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {ev.venueId.name}, {ev.venueId.city}
              </p>
            )}

            <div className="mt-auto pt-5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">House {filled}% full</span>
                <span className={soldOut ? 'text-indigo-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                  {soldOut ? 'Sold out' : `${left} seats left`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-marquee-400 to-indigo-500 transition-[width] duration-700"
                  style={{ width: `${Math.max(filled, 3)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-5">
            <div className="flex gap-1.5" role="tablist" aria-label="Events on the marquee">
              {events.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={e.title}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? 'w-6 bg-marquee-400' : 'w-1.5 bg-slate-600 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
            <Link
              to={`/events/${ev.id}`}
              className="px-5 py-2.5 rounded-xl bg-marquee-400 hover:bg-marquee-300 text-slate-950 font-bold text-sm transition active:scale-95"
            >
              {soldOut ? 'Join the waitlist' : 'Pick seats'}
            </Link>
          </div>
        </div>
      </MarqueeSign>
    </div>
  );
}

function PosterCard({ ev }) {
  const left = ev.availableSeats ?? 0;
  const prices = ev.priceBySection ? Object.values(ev.priceBySection) : [];
  const from = prices.length ? Math.min(...prices) : null;
  return (
    <Link
      to={`/events/${ev.id}`}
      className="group shrink-0 w-[72%] sm:w-auto snap-start rounded-2xl overflow-hidden bg-slate-900 ring-1 ring-slate-800 hover:ring-marquee-400/60 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(216,31,72,0.6)]"
    >
      <EventPoster event={ev} compact className="aspect-[4/5] transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="p-3.5 flex items-center justify-between gap-2 text-sm">
        <span className={left === 0 ? 'text-indigo-300 font-semibold' : 'text-emerald-300 font-semibold'}>
          {left === 0 ? 'Sold out' : `${left} left`}
        </span>
        {from !== null && <span className="text-slate-300">from ${from}</span>}
      </div>
    </Link>
  );
}

const STEPS = [
  { title: 'Pick your seat', text: 'Tap any green seat on the live map. Everyone sees it change instantly.' },
  { title: 'Pay within 10 minutes', text: 'The seat is saved for you while you check out. Nobody else can take it.' },
  { title: 'Scan at the door', text: 'Your QR ticket is on your phone and in your inbox. It works once.' },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getEvents()
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoaded(true));
  }, []);

  const secondary = !isAuthenticated
    ? { to: '/login', label: 'Try a demo account' }
    : user.role === 'customer'
    ? { to: '/my-tickets', label: 'My tickets' }
    : { to: user.role === 'admin' ? '/admin' : '/organiser', label: user.role === 'admin' ? 'Admin dashboard' : 'Organiser portal' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-14 sm:space-y-20">
      {/* Hero */}
      <section className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-14 items-center">
        <div className="space-y-5">
          <h1 className="text-[3.1rem] leading-[0.92] sm:text-7xl lg:text-[5.4rem] font-black uppercase text-white" style={{ textWrap: 'balance' }}>
            Your seat. Your night. Booked in seconds.
          </h1>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed">
            Choose the exact seat you want on a live map, pay while it's saved for you, and walk in with a QR ticket.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              to="/events"
              className="px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base text-center shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              Browse events
            </Link>
            <Link
              to={secondary.to}
              className="px-7 py-3.5 rounded-xl text-slate-100 font-semibold text-base text-center ring-1 ring-slate-700 hover:bg-slate-900 transition"
            >
              {secondary.label}
            </Link>
          </div>
        </div>

        <NowBooking events={events} />
      </section>

      {/* On sale */}
      {(events.length > 0 || !loaded) && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-4xl sm:text-5xl font-black uppercase text-white">On sale now</h2>
            <Link to="/events" className="text-sm font-semibold text-marquee-300 hover:text-marquee-200">
              See all events
            </Link>
          </div>
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
            {!loaded
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="shrink-0 w-[72%] sm:w-auto">
                    <div className="skeleton aspect-[4/5]" />
                    <div className="skeleton h-4 w-1/2 mt-3" />
                  </div>
                ))
              : events.slice(0, 4).map((ev) => <PosterCard key={ev.id} ev={ev} />)}
          </div>
        </section>
      )}

      {/* How booking works (a real sequence, so it's numbered) */}
      <section className="space-y-6">
        <h2 className="font-display text-4xl sm:text-5xl font-black uppercase text-white">How booking works</h2>
        <ol className="grid md:grid-cols-3 gap-4 md:gap-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex md:block gap-4 md:pr-8">
              <div className="flex md:items-center gap-3 md:mb-4">
                <span className="w-11 h-11 shrink-0 rounded-full bg-marquee-400 text-slate-950 font-display font-black text-2xl flex items-center justify-center">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && <span className="hidden md:block flex-1 perforation text-slate-700" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{s.title}</h3>
                <p className="text-slate-400 mt-1 leading-relaxed max-w-xs">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Two things other sites don't do */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6 bg-slate-900 ring-1 ring-slate-800">
          <Hourglass className="w-6 h-6 text-marquee-400" />
          <h3 className="text-lg font-bold text-white mt-3">Sold out isn't the end</h3>
          <p className="text-slate-400 mt-1 leading-relaxed">
            Join the waitlist. When someone cancels, their seat goes to the next person in line, who gets 15 minutes to take it.
          </p>
        </div>
        <div className="rounded-2xl p-6 bg-slate-900 ring-1 ring-slate-800">
          <ScanLine className="w-6 h-6 text-marquee-400" />
          <h3 className="text-lg font-bold text-white mt-3">Running a show?</h3>
          <p className="text-slate-400 mt-1 leading-relaxed">
            Organisers publish events, watch sales come in live and check guests in at the door by scanning their tickets.
          </p>
        </div>
      </section>
    </div>
  );
}
