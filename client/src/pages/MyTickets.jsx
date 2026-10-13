import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, X, AlertCircle, CheckCircle, Hourglass, Copy, CalendarPlus, Share2, Send } from 'lucide-react';
import TicketStub from '../components/TicketStub';
import { getMyBookings, cancelBooking, getMyWaitlist, leaveWaitlist, transferTicket } from '../api/tickets';
import { downloadCalendarFile, shareLink } from '../utils/calendar';

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

/** Everything you can do with an upcoming ticket. */
function TicketActions({ booking, busy, copied, onCopy, onCancel, onSent }) {
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [shared, setShared] = useState('');
  const [formError, setFormError] = useState('');
  const ev = booking.eventId || {};
  const venue = ev.venueId && typeof ev.venueId === 'object' ? ev.venueId : null;
  const eventUrl = `${window.location.origin}/events/${ev._id || ev.id || ''}`;
  const seatText = booking.seatIds.map((s) => `${s.row}${s.number}`).join(', ');
  const used = Boolean(booking.checkedInAt);

  const addToCalendar = () =>
    downloadCalendarFile({
      id: booking.id,
      title: ev.title,
      startsAt: ev.startsAt,
      location: venue ? `${venue.name}, ${venue.city}` : '',
      seats: seatText,
      url: eventUrl,
    });

  const share = async () => {
    const result = await shareLink({
      title: ev.title,
      text: `I'm going to ${ev.title}! Grab a seat near me on TicketX.`,
      url: eventUrl,
    });
    if (result === 'copied') {
      setShared('Link copied');
      setTimeout(() => setShared(''), 2000);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    setWorking(true);
    setFormError('');
    try {
      const res = await transferTicket(booking.id, email.trim());
      setSending(false);
      setEmail('');
      onSent(res.recipient?.name || email);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Could not send this ticket. Check the email and try again.');
    } finally {
      setWorking(false);
    }
  };

  const btn =
    'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ring-1 ring-slate-800 hover:bg-slate-900 active:scale-95';

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={addToCalendar} className={`${btn} text-slate-200`}>
          <CalendarPlus className="w-4 h-4 text-marquee-400" />
          Calendar
        </button>
        <button type="button" onClick={share} className={`${btn} text-slate-200`}>
          <Share2 className="w-4 h-4 text-marquee-400" />
          {shared || 'Share'}
        </button>
        <button
          type="button"
          onClick={() => setSending((v) => !v)}
          disabled={used}
          className={`${btn} text-slate-200 disabled:opacity-40 ${sending ? 'bg-slate-900 ring-marquee-400/50' : ''}`}
          aria-expanded={sending}
        >
          <Send className="w-4 h-4 text-marquee-400" />
          Send
        </button>
        <button type="button" onClick={onCancel} disabled={busy || used} className={`${btn} text-indigo-300 disabled:opacity-40`}>
          <X className="w-4 h-4" />
          {busy ? 'Wait' : 'Cancel'}
        </button>
      </div>

      {sending && (
        <form onSubmit={send} className="p-3.5 rounded-2xl bg-slate-900 ring-1 ring-marquee-400/30 space-y-2.5 animate-toast-in">
          <p className="text-sm text-slate-300">
            Send this ticket to a friend who has a TicketX account. They get a new QR code and yours stops working.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-950 ring-1 ring-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-marquee-400"
            />
            <button
              type="submit"
              disabled={working}
              className="px-4 py-2.5 rounded-xl bg-marquee-400 hover:bg-marquee-300 text-slate-950 font-bold text-sm disabled:opacity-50"
            >
              {working ? 'Sending...' : 'Send ticket'}
            </button>
          </div>
          {formError && <p className="text-sm text-indigo-300">{formError}</p>}
        </form>
      )}

      {booking.ticketCode && !used && (
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-1"
          title="For entry if the QR code can't be scanned"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'Ticket code copied' : 'Copy ticket code'}
        </button>
      )}
    </div>
  );
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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-5xl sm:text-6xl font-black uppercase text-white leading-none">My tickets</h1>
        <p className="text-slate-400 mt-2">Show the QR code at the entrance. Each ticket can be scanned once.</p>
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
          <h2 className="font-display text-3xl font-black uppercase text-white flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-marquee-400" />
            Waitlist
          </h2>
          {waitlist.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                entry.status === 'offered'
                  ? 'bg-marquee-400/10 border-marquee-400/50 animate-toast-in'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="text-sm">
                <p className="font-bold text-white">{entry.eventId?.title}</p>
                {entry.status === 'offered' ? (
                  <p className="text-marquee-200 text-xs mt-1">
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
                    className="px-4 py-2 rounded-xl bg-marquee-400 hover:bg-marquee-300 text-slate-950 text-sm font-bold transition"
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
        <h2 className="font-display text-3xl font-black uppercase text-white">Coming up</h2>
        {upcoming.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 ring-1 ring-slate-800 text-center space-y-3">
            <Ticket className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-slate-300">You don't have any upcoming tickets.</p>
            <Link to="/events" className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition">
              Browse events
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-10">
            {upcoming.map((b, i) => (
              <div key={b.id} className="space-y-3 animate-row-in" style={{ animationDelay: `${i * 80}ms` }}>
                <TicketStub
                  event={b.eventId || {}}
                  seats={b.seatIds}
                  total={b.total}
                  qrCode={b.qrCode}
                  status={b.checkedInAt ? 'used' : 'confirmed'}
                />
                <TicketActions
                  booking={b}
                  busy={busyId === b.id}
                  copied={copied === b.id}
                  onCopy={() => copyCode(b.ticketCode, b.id)}
                  onCancel={() => handleCancel(b)}
                  onSent={(name) => {
                    setNotice(`Ticket sent to ${name}. Your copy no longer works.`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    load();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {other.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-3xl font-black uppercase text-slate-300">Past and cancelled</h2>
          {other.map((b) => (
            <div key={b.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-300">{b.eventId?.title || 'Event removed'}</p>
                <p className="text-xs text-slate-500">
                  {b.eventId?.startsAt && formatWhen(b.eventId.startsAt)}, {b.seatIds.length} {b.seatIds.length === 1 ? 'seat' : 'seats'}, ${b.total}
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
