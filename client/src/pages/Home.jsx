import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvents } from '../api/events';
import {
  Ticket,
  Zap,
  Clock,
  QrCode,
  Hourglass,
  ArrowRight,
  Calendar,
  MapPin,
  Film,
  Music,
  ShieldCheck,
} from 'lucide-react';

function EventCard({ ev }) {
  const prices = ev.priceBySection ? Object.values(ev.priceBySection) : [];
  const from = prices.length ? Math.min(...prices) : null;
  const isMovie = ev.type === 'movie';
  const soldOut = (ev.availableSeats ?? 0) === 0;

  return (
    <Link
      to={`/events/${ev.id}`}
      className="group shrink-0 w-[78%] sm:w-auto snap-start bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden transition"
    >
      <div
        className={`h-24 p-4 flex items-start justify-between ${
          isMovie
            ? 'bg-gradient-to-br from-indigo-800/60 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-violet-800/60 via-slate-900 to-slate-950'
        }`}
      >
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-950/60 text-slate-200 border border-slate-700 flex items-center gap-1">
          {isMovie ? <Film className="w-3 h-3" /> : <Music className="w-3 h-3" />}
          {ev.type}
        </span>
        {from !== null && (
          <span className="text-xs font-bold text-white bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-700">
            from ${from}
          </span>
        )}
      </div>
      <div className="p-4 space-y-1.5">
        <h3 className="font-bold text-white leading-snug group-hover:text-indigo-300 transition line-clamp-2">{ev.title}</h3>
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          {new Date(ev.startsAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
        {ev.venueId && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{ev.venueId.name}, {ev.venueId.city}</span>
          </p>
        )}
        <p className={`text-xs font-semibold pt-1 ${soldOut ? 'text-rose-300' : 'text-emerald-400'}`}>
          {soldOut ? 'Sold out · join the waitlist' : `${ev.availableSeats} seats left`}
        </p>
      </div>
    </Link>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Live seat map',
    text: 'See seats change colour the moment someone picks one. What you see is what is really free.',
  },
  {
    icon: Clock,
    title: 'Your seat is saved',
    text: 'Pick a seat and it is yours for 10 minutes while you pay. Nobody can take it from you.',
  },
  {
    icon: ShieldCheck,
    title: 'Never sold twice',
    text: 'Even when thousands click at once, every seat goes to exactly one person.',
  },
  {
    icon: Hourglass,
    title: 'Fair waitlist',
    text: 'Sold out? Join the line. If someone cancels, their seat is offered to the next person first.',
  },
  {
    icon: QrCode,
    title: 'QR tickets',
    text: 'Your ticket lives on your phone and in your email. Scan once at the gate and you are in.',
  },
  {
    icon: Ticket,
    title: 'For organisers',
    text: 'Create events, watch sales live, see every booking and check guests in at the door.',
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    getEvents()
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 space-y-10 sm:space-y-14">
      {/* Hero */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 px-5 py-8 sm:p-12 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            Concerts & cinema
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
            Grab the best seats before they're gone.
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Pick your exact seat on a live map. It's saved for you while you pay, and your QR ticket lands on your phone.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              to="/events"
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              Browse events
              <ArrowRight className="w-4 h-4" />
            </Link>
            {isAuthenticated ? (
              user.role === 'customer' ? (
                <Link
                  to="/my-tickets"
                  className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 transition"
                >
                  <Ticket className="w-4 h-4" />
                  My tickets
                </Link>
              ) : (
                <Link
                  to={user.role === 'admin' ? '/admin' : '/organiser'}
                  className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center transition"
                >
                  {user.role === 'admin' ? 'Admin dashboard' : 'Organiser portal'}
                </Link>
              )
            ) : (
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center transition"
              >
                Try a demo account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      {events.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white">On sale now</h2>
            <Link to="/events" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              See all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {/* Swipeable row on phones, grid on larger screens */}
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
            {events.slice(0, 4).map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="space-y-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Why people book with TicketX</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex gap-4 sm:block sm:space-y-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo accounts */}
      {!isAuthenticated && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Try it in 10 seconds</h2>
            <p className="text-sm text-slate-400 mt-1">
              Log in as a customer, an organiser or an admin with one tap. No sign-up needed.
            </p>
          </div>
          <Link
            to="/login"
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shrink-0"
          >
            Open demo accounts <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      )}
    </div>
  );
}
