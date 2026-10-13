import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Calendar, MapPin, X, Clock, AlertCircle, CheckCircle, Hourglass, Copy } from 'lucide-react';
import { getMyBookings, cancelBooking, getMyWaitlist, leaveWaitlist } from '../api/tickets';

function formatWhen(date) {
  return new Date(date).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Countdown({ until }) {
  const now = useNow();
  const secs = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className="font-mono font-bold">{m}:{s}</span>;
}

function StatusBadge({ booking }) {
  if (booking.status === 'cancelled') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">Cancelled</span>;
  }
  if (booking.checkedInAt) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-700 text-slate-300">Used</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Confirmed</span>;
}

export default function MyTickets() {
  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = async () => {
    try {
      const [b, w] = await Promise.all([getMyBookings(), getMyWaitlist()]);
      setBookings(b.bookings);
      setWaitlist(w.entries);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (booking) => {
    const ok = window.confirm(
      `Cancel your booking for "${booking.eventId?.title}"? Your seats will go to the next person on the waitlist.`
    );
    if (!ok) return;
    setBusyId(booking.id);
    setNotice('');
    try {
      await cancelBooking(booking.id);
      setNotice('Booking cancelled. Your seats have been released.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel this booking');
    } finally {
      setBusyId(null);
    }
  };

  const handleLeave = async (entry) => {
    setBusyId(entry.id);
    try {
      await leaveWaitlist(entry.eventId._id || entry.eventId.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not leave the waitlist');
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard not available; the code is visible anyway */
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading your tickets...</p>
      </div>
    );
  }

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.eventId?.startsAt).getTime() > now);
  const other = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
          <Ticket className="w-3.5 h-3.5" />
          <span>My Tickets</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Your tickets</h1>
        <p className="text-sm text-slate-400 mt-1">Show the QR code at the entrance. Each ticket can be scanned once.</p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {waitlist.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-amber-400" />
            Waitlist
          </h2>
          {waitlist.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                entry.status === 'offered'
                  ? 'bg-emerald-950/40 border-emerald-500/40'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="text-sm">
                <p className="font-bold text-white">{entry.eventId?.title}</p>
                {entry.status === 'offered' ? (
                  <p className="text-emerald-300 text-xs mt-1">
                    Seat {entry.offeredSeatId?.row}
                    {entry.offeredSeatId?.number} is held for you. Book within <Countdown until={entry.offerExpiresAt} />.
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs mt-1">You are #{entry.position} in line. We'll email you if a seat opens up.</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {entry.status === 'offered' && (
                  <Link
                    to={`/events/${entry.eventId?._id || entry.eventId?.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition"
                  >
                    Book now
                  </Link>
                )}
                <button
                  onClick={() => handleLeave(entry)}
                  disabled={busyId === entry.id}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
                >
                  Leave
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-sm text-slate-400">
            No upcoming tickets.{' '}
            <Link to="/events" className="text-indigo-400 font-semibold">Browse events</Link>
          </div>
        ) : (
          upcoming.map((b) => (
            <div key={b.id} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge booking={b} />
                  <span className="text-[10px] uppercase font-bold text-indigo-300">{b.eventId?.type}</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">{b.eventId?.title}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    {formatWhen(b.eventId?.startsAt)}
                  </span>
                  {b.eventId?.venueId && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      {b.eventId.venueId.name}, {b.eventId.venueId.city}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.seatIds.map((s) => (
                    <span key={s._id || s.id} className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono">
                      {s.row}{s.number} <span className="text-slate-500">{s.section}</span>
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-300">
                  Paid <strong className="text-white">${b.total}</strong>
                </p>
                {!b.checkedInAt && (
                  <button
                    onClick={() => handleCancel(b)}
                    disabled={busyId === b.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 transition disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    {busyId === b.id ? 'Cancelling...' : 'Cancel booking'}
                  </button>
                )}
              </div>

              {b.qrCode && (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={b.qrCode}
                    alt={`QR ticket for ${b.eventId?.title}`}
                    className={`w-44 h-44 rounded-xl bg-white p-2 ${b.checkedInAt ? 'opacity-30' : ''}`}
                  />
                  {b.ticketCode && (
                    <button
                      onClick={() => copyCode(b.ticketCode, b.id)}
                      className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300"
                      title="Copy ticket code"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === b.id ? 'Copied' : `${b.ticketCode.slice(0, 8)}...`}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {other.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Past and cancelled
          </h2>
          {other.map((b) => (
            <div key={b.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-300">{b.eventId?.title || 'Event removed'}</p>
                <p className="text-xs text-slate-500">
                  {b.eventId?.startsAt && formatWhen(b.eventId.startsAt)} · {b.seatIds.length} seat(s) · ${b.total}
                </p>
              </div>
              <StatusBadge booking={b} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
