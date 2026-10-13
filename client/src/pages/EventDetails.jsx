import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEventById, getEventSeats, holdSeat, releaseSeat, confirmBooking } from '../api/events';
import { getMyWaitlist, joinWaitlist, leaveWaitlist } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import SeatMap from '../components/SeatMap';
import {
  Calendar,
  MapPin,
  Clock,
  ShieldAlert,
  CheckCircle,
  CreditCard,
  X,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Users,
  Hourglass,
} from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : '');

export default function EventDetails() {
  const { id: eventId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoadingSeatId, setActionLoadingSeatId] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Countdown timer state
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(null);

  // Waitlist state for this event (customers only)
  const [waitlistEntry, setWaitlistEntry] = useState(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const isCustomer = user?.role === 'customer';

  const loadWaitlist = async () => {
    if (!isAuthenticated || user?.role !== 'customer') {
      setWaitlistEntry(null);
      return;
    }
    try {
      const data = await getMyWaitlist();
      const entry = data.entries.find(
        (e) => (e.eventId?._id || e.eventId?.id || e.eventId) === eventId
      );
      setWaitlistEntry(entry || null);
    } catch {
      // Non-critical: the seat map still works without waitlist info
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, [eventId, isAuthenticated, user?.role]);

  // Fetch Event & Seats
  const loadData = async () => {
    try {
      const [eventData, seatsData] = await Promise.all([
        getEventById(eventId),
        getEventSeats(eventId),
      ]);
      setEvent(eventData.event);
      setSeats(seatsData.seats);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  // Socket.IO real-time subscription
  useEffect(() => {
    const socket = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.emit('join:event', eventId);

    // Live update when any user holds a seat
    socket.on('seat:held', (data) => {
      const me = user?.id || user?._id;
      if (me && data.heldBy === me) {
        // Could be a waitlist offer landing for this user
        loadWaitlist();
      }
      setSeats((prev) =>
        prev.map((s) =>
          s.id === data.seatId || s._id === data.seatId
            ? { ...s, status: 'held', heldBy: data.heldBy, holdUntil: data.holdUntil }
            : s
        )
      );
    });

    // Live update when a seat is released
    socket.on('seat:released', (data) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === data.seatId || s._id === data.seatId
            ? { ...s, status: 'available', heldBy: null, holdUntil: null }
            : s
        )
      );
    });

    // Live update when seats are booked
    socket.on('seat:booked', (data) => {
      setSeats((prev) =>
        prev.map((s) =>
          data.seatIds.includes(s.id) || data.seatIds.includes(s._id)
            ? { ...s, status: 'booked', heldBy: null, holdUntil: null }
            : s
        )
      );
    });

    return () => {
      socket.emit('leave:event', eventId);
      socket.disconnect();
    };
  }, [eventId, user?.id, user?._id]);

  // Current user's held seats
  const myHeldSeats = useMemo(() => {
    if (!user) return [];
    const userId = user.id || user._id;
    return seats.filter(
      (s) => s.status === 'held' && (s.heldBy === userId || s.heldBy?._id === userId)
    );
  }, [seats, user]);

  // Calculate 10-minute hold countdown timer
  useEffect(() => {
    if (myHeldSeats.length === 0) {
      setTimeLeftSeconds(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const earliestExpiry = Math.min(
        ...myHeldSeats.map((s) => (s.holdUntil ? new Date(s.holdUntil).getTime() : now + 600000))
      );
      const remainingSec = Math.max(0, Math.floor((earliestExpiry - now) / 1000));
      setTimeLeftSeconds(remainingSec);

      if (remainingSec === 0) {
        // Hold expired, refresh seat states
        loadData();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [myHeldSeats]);

  // Errors show as a toast and clear themselves
  useEffect(() => {
    if (!errorMsg) return undefined;
    const t = setTimeout(() => setErrorMsg(''), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  // Format MM:SS
  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Group seats by row for map layout
  const rowsMap = useMemo(() => {
    const map = {};
    seats.forEach((seat) => {
      if (!map[seat.row]) {
        map[seat.row] = [];
      }
      map[seat.row].push(seat);
    });
    // Sort seats in each row by seat number
    Object.keys(map).forEach((r) => {
      map[r].sort((a, b) => a.number - b.number);
    });
    return map;
  }, [seats]);

  // Handle seat click (Atomic Hold or Release)
  const handleSeatClick = async (seat) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/events/${eventId}` } } });
      return;
    }

    const userId = user.id || user._id;
    const isHeldByMe = seat.status === 'held' && (seat.heldBy === userId || seat.heldBy?._id === userId);

    setErrorMsg('');
    setActionLoadingSeatId(seat.id || seat._id);

    try {
      if (isHeldByMe) {
        // Release seat early
        await releaseSeat(seat.id || seat._id, eventId);
        setSeats((prev) =>
          prev.map((s) =>
            (s.id || s._id) === (seat.id || seat._id)
              ? { ...s, status: 'available', heldBy: null, holdUntil: null }
              : s
          )
        );
      } else if (seat.status === 'available') {
        // Enforce max 6 seats client-side check before network call
        if (myHeldSeats.length >= 6) {
          setErrorMsg('You can hold a maximum of 6 seats for this event.');
          return;
        }

        // Single atomic hold request
        const res = await holdSeat(seat.id || seat._id, eventId);
        setSeats((prev) =>
          prev.map((s) =>
            (s.id || s._id) === (seat.id || seat._id)
              ? { ...s, status: 'held', heldBy: userId, holdUntil: res.seat.holdUntil }
              : s
          )
        );
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setErrorMsg('Someone grabbed that seat a moment before you. Please pick another one.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to update seat status');
      }
      // Reload seat state to ensure local sync
      loadData();
    } finally {
      setActionLoadingSeatId(null);
    }
  };

  // Mocked Checkout Payment Confirmation (MongoDB Transaction)
  const handlePayAndConfirm = async () => {
    if (myHeldSeats.length === 0) return;
    setConfirmingPayment(true);
    setErrorMsg('');

    try {
      const seatIds = myHeldSeats.map((s) => s.id || s._id);
      const res = await confirmBooking({ eventId, seatIds });
      setBookingSuccess(res.booking);
      loadWaitlist();

      // Locally mark seats as booked
      setSeats((prev) =>
        prev.map((s) => (seatIds.includes(s.id || s._id) ? { ...s, status: 'booked' } : s))
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Payment and booking confirmation failed');
      loadData();
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/events/${eventId}` } } });
      return;
    }
    setWaitlistBusy(true);
    setErrorMsg('');
    try {
      await joinWaitlist(eventId);
      await loadWaitlist();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not join the waitlist');
      loadData();
    } finally {
      setWaitlistBusy(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      await leaveWaitlist(eventId);
      setWaitlistEntry(null);
      loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not leave the waitlist');
    } finally {
      setWaitlistBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading seats...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-md mx-auto my-16 text-center text-slate-400">
        <p>Event not found.</p>
        <Link to="/events" className="text-indigo-400 font-bold text-xs mt-2 inline-block">
          Return to Events
        </Link>
      </div>
    );
  }

  const totalHeldPrice = myHeldSeats.reduce((sum, s) => sum + s.price, 0);
  const soldOut = seats.length > 0 && !seats.some((s) => s.status === 'available');
  const hasOffer = waitlistEntry?.status === 'offered';

  const userId = user?.id || user?._id;
  const prices =
    event.priceBySection instanceof Map ? Object.fromEntries(event.priceBySection) : event.priceBySection || {};
  const fromPrice = Object.values(prices).length ? Math.min(...Object.values(prices)) : null;
  const seatsLeft = seats.filter((s) => s.status === 'available').length;
  const lowTime = timeLeftSeconds !== null && timeLeftSeconds <= 60;
  const seatList = myHeldSeats
    .slice()
    .sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number)
    .map((s) => `${s.row}${s.number}`)
    .join(', ');

  const payButton = (extra = '') => (
    <button
      disabled={myHeldSeats.length === 0 || confirmingPayment}
      onClick={handlePayAndConfirm}
      className={`py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${extra}`}
    >
      {confirmingPayment ? (
        <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          <span>Pay ${totalHeldPrice}</span>
        </>
      )}
    </button>
  );

  return (
    <div className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 ${myHeldSeats.length > 0 ? 'pb-32 lg:pb-8' : ''}`}>
      {/* Error toast (stays visible wherever you've scrolled) */}
      {errorMsg && (
        <div className="fixed top-16 md:top-20 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[60] p-3.5 rounded-2xl bg-rose-950/95 border border-rose-500/50 text-rose-100 text-sm flex items-start gap-2.5 shadow-2xl animate-shake">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-300 hover:text-white" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All events</span>
        </Link>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-2xl">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {event.type}
              </span>
              <span className={`text-xs font-semibold ${seatsLeft === 0 ? 'text-rose-300' : seatsLeft < 20 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {seatsLeft === 0 ? 'Sold out' : seatsLeft < 20 ? `Only ${seatsLeft} seats left` : `${seatsLeft} seats available`}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">{event.title}</h1>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                {new Date(event.startsAt).toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                {event.venueId?.name}, {event.venueId?.city}
              </span>
            </div>
          </div>

          {/* Prices */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {Object.entries(prices).map(([sec, pr]) => (
              <div key={sec} className="flex-1 md:flex-none text-center px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{sec}</span>
                <span className="text-base font-black text-indigo-300">${pr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Waitlist offer: a cancelled seat is being held for this customer */}
      {hasOffer && myHeldSeats.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-sm flex items-start gap-3">
          <Hourglass className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-emerald-100">
            <strong className="text-emerald-300">Good news, a seat opened up for you.</strong> It's saved in your
            basket for 15 minutes. Pay to keep it, or it goes to the next person in line.
          </p>
        </div>
      )}

      {/* Booking confirmed */}
      {bookingSuccess && (
        <div className="p-5 sm:p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center gap-5 shadow-xl text-center sm:text-left">
          {bookingSuccess.qrCode && (
            <img src={bookingSuccess.qrCode} alt="Your QR ticket" className="w-40 h-40 sm:w-28 sm:h-28 rounded-xl bg-white p-1.5 shrink-0" />
          )}
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-300 font-extrabold text-lg">
              <CheckCircle className="w-5 h-5" />
              <span>You're going!</span>
            </div>
            <p className="text-sm text-slate-300">
              Paid <strong className="text-white">${bookingSuccess.total}</strong>. Show this QR code at the entrance.
              A copy is in My Tickets and your email.
            </p>
          </div>
          <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
            <Link
              to="/my-tickets"
              className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition text-center"
            >
              My Tickets
            </Link>
            <button
              onClick={() => setBookingSuccess(null)}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Seat map */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-8 shadow-2xl">
          {/* Legend */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-x-4 gap-y-2 px-2 pb-4 mb-4 border-b border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-emerald-500/15 border border-emerald-500/50" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-indigo-500 border border-indigo-300" />
              Your seats
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-amber-500/20 border border-amber-500/40" />
              Someone's choosing
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-slate-800 border border-slate-700" />
              Sold
            </span>
          </div>

          {myHeldSeats.length === 0 && seatsLeft > 0 && (
            <p className="text-center text-xs sm:text-sm text-slate-400 mb-4">
              Tap a green seat to save it for 10 minutes. You can pick up to 6.
            </p>
          )}

          <SeatMap
            seats={seats}
            userId={userId}
            busySeatId={actionLoadingSeatId}
            onSeatClick={handleSeatClick}
            stageLabel={event.type === 'movie' ? 'Screen this way' : 'Stage'}
            priceBySection={prices}
          />
        </div>

        {/* Side column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Sold out -> FIFO waitlist */}
          {soldOut && myHeldSeats.length === 0 && (!isAuthenticated || isCustomer) && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-3xl p-5 space-y-3 text-sm">
              <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <Hourglass className="w-4 h-4" />
                Sold out
              </h2>
              {waitlistEntry?.status === 'waiting' ? (
                <>
                  <p className="text-slate-300">
                    You're <strong className="text-white">#{waitlistEntry.position}</strong> in line. If someone
                    cancels, we'll save their seat for you for 15 minutes and email you.
                  </p>
                  <button
                    onClick={handleLeaveWaitlist}
                    disabled={waitlistBusy}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition disabled:opacity-50"
                  >
                    Leave waitlist
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-300">
                    Join the waitlist. When someone cancels, their seat goes to the next person in line.
                  </p>
                  <button
                    onClick={handleJoinWaitlist}
                    disabled={waitlistBusy}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-50"
                  >
                    {waitlistBusy ? 'Joining...' : 'Join waitlist'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Basket (desktop) */}
          <div className="hidden lg:block bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl sticky top-20 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Your seats
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300">
                {myHeldSeats.length}/6
              </span>
            </div>

            {myHeldSeats.length > 0 && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-3 border ${
                  lowTime ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Clock className="w-4 h-4" />
                  Saved for you for
                </span>
                <span className="font-mono font-extrabold text-sm">{formatTime(timeLeftSeconds)}</span>
              </div>
            )}

            {myHeldSeats.length === 0 ? (
              <p className="py-6 text-center text-slate-400 text-sm">Pick seats on the map.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {myHeldSeats.map((seat) => (
                  <div
                    key={seat.id || seat._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm"
                  >
                    <div>
                      <span className="font-bold text-white">
                        Row {seat.row} · Seat {seat.number}
                      </span>
                      <span className="text-xs text-slate-400 block">{seat.section}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-300">${seat.price}</span>
                      <button
                        onClick={() => handleSeatClick(seat)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Remove seat"
                        aria-label={`Remove seat ${seat.row}${seat.number}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {myHeldSeats.length > 0 && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-base font-extrabold text-white">
                <span>Total</span>
                <span className="text-emerald-400">${totalHeldPrice}</span>
              </div>
            )}

            {payButton('w-full')}
            <p className="text-[11px] text-slate-500 text-center">Demo checkout: no real payment is taken.</p>
          </div>
        </div>
      </div>

      {/* Basket (phones and tablets): pinned above the tab bar */}
      {myHeldSeats.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-16 md:bottom-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {myHeldSeats.length} seat{myHeldSeats.length > 1 ? 's' : ''} · {seatList}
              </p>
              <p className={`text-xs flex items-center gap-1 ${lowTime ? 'text-rose-300' : 'text-slate-400'}`}>
                <Clock className="w-3.5 h-3.5" />
                Saved for <span className="font-mono font-bold">{formatTime(timeLeftSeconds)}</span>
              </p>
            </div>
            {payButton('shrink-0')}
          </div>
        </div>
      )}
    </div>
  );
}
