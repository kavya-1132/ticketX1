import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEventById, getEventSeats, holdSeat, releaseSeat, confirmBooking } from '../api/events';
import { getMyWaitlist, joinWaitlist, leaveWaitlist } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import SeatMap from '../components/SeatMap';
import EventPoster from '../components/EventPoster';
import TicketStub from '../components/TicketStub';
import CountdownRing from '../components/CountdownRing';
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
      setBookingSuccess({ ...res.booking, seatsDetail: myHeldSeats.map((s) => ({ ...s })) });
      // Bring the ticket reveal into view (on phones you're usually scrolled down at the seat map)
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      className={`py-3.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-base shadow-lg shadow-indigo-600/40 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${extra}`}
    >
      {confirmingPayment ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
        <div className="fixed top-16 md:top-20 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[60] p-3.5 rounded-2xl bg-indigo-950/95 backdrop-blur border border-indigo-500/50 text-indigo-50 text-sm flex items-start gap-2.5 shadow-2xl animate-toast-in">
          <ShieldAlert className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-indigo-200 hover:text-white" aria-label="Dismiss">
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

        <div className="grid sm:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] rounded-3xl overflow-hidden bg-slate-900 ring-1 ring-slate-800 shadow-2xl">
          <EventPoster event={event} showTitle={false} compact className="h-20 sm:h-full sm:min-h-[220px]" />
          <div className="p-4 sm:p-7 flex flex-col gap-3 sm:gap-4 justify-center min-w-0">
            <div className="space-y-2">
              <p
                className={`text-sm font-semibold ${
                  seatsLeft === 0 ? 'text-indigo-300' : seatsLeft < 20 ? 'text-marquee-300' : 'text-emerald-300'
                }`}
              >
                {seatsLeft === 0 ? 'Sold out' : seatsLeft < 20 ? `Only ${seatsLeft} seats left` : `${seatsLeft} seats available`}
              </p>
              <h1 className="text-[2rem] sm:text-5xl font-black uppercase text-white leading-[0.92]" style={{ textWrap: 'balance' }}>
                {event.title}
              </h1>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-x-5 text-sm text-slate-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-marquee-400 shrink-0" />
                  {new Date(event.startsAt).toLocaleString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-marquee-400 shrink-0" />
                  {event.venueId?.name}, {event.venueId?.city}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(prices).map(([sec, pr]) => (
                <div key={sec} className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-950/70 ring-1 ring-slate-800 flex sm:block items-baseline gap-2">
                  <span className="text-xs text-slate-400 block">{sec}</span>
                  <span className="font-display text-xl sm:text-2xl font-black text-marquee-300 leading-none">${pr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist offer: a cancelled seat is being held for this customer */}
      {hasOffer && myHeldSeats.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-marquee-400/10 ring-1 ring-marquee-400/40 text-sm flex items-start gap-3 animate-toast-in">
          <Hourglass className="w-5 h-5 text-marquee-300 shrink-0 mt-0.5" />
          <p className="text-slate-100">
            <strong className="text-marquee-200">Good news, a seat opened up for you.</strong> It's saved in your
            basket for 15 minutes. Pay to keep it, or it goes to the next person in line.
          </p>
        </div>
      )}

      {/* Booking confirmed: the ticket prints out of a slot */}
      {bookingSuccess && (
        <section className="grid md:grid-cols-[1fr_360px] gap-6 items-start" aria-live="polite">
          <div className="space-y-3 md:pt-6 order-2 md:order-1">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
              <CheckCircle className="w-5 h-5" />
              Payment received
            </div>
            <h2 className="font-display text-5xl sm:text-6xl font-black uppercase text-white leading-[0.9]">You're going!</h2>
            <p className="text-slate-300 max-w-md">
              Your ticket is ready. It's saved in My Tickets and we've emailed you a copy. Show the QR code at the entrance.
            </p>
            <div className="flex gap-2 pt-2">
              <Link
                to="/my-tickets"
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition"
              >
                Open My Tickets
              </Link>
              <button
                onClick={() => setBookingSuccess(null)}
                className="px-5 py-3 rounded-xl ring-1 ring-slate-700 text-slate-200 font-semibold hover:bg-slate-900 transition"
              >
                Book more seats
              </button>
            </div>
          </div>
          <div className="order-1 md:order-2 max-w-sm w-full mx-auto">
            {/* The slot */}
            <div className="h-3 rounded-full bg-slate-950 ring-1 ring-slate-700 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] mx-2 relative z-10" />
            <div className="-mt-1.5 px-4">
              <TicketStub
                className="animate-print"
                event={event}
                seats={bookingSuccess.seatsDetail || []}
                total={bookingSuccess.total}
                qrCode={bookingSuccess.qrCode}
              />
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Seat map */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-8 shadow-2xl">
          {/* Legend */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-x-4 gap-y-2 px-2 pb-4 mb-4 border-b border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-emerald-400/10 border border-emerald-400/60" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-marquee-400 border border-marquee-200 shadow-[0_0_8px_rgba(255,200,87,0.6)]" />
              Your seats
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-t-md rounded-b-sm bg-indigo-500/20 border border-indigo-400/50" />
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
            <div className="bg-slate-900 ring-1 ring-marquee-400/30 rounded-3xl p-5 space-y-3 text-sm">
              <h2 className="font-display text-3xl font-black uppercase text-marquee-300 flex items-center gap-2">
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
                    className="w-full py-3 rounded-xl bg-marquee-400 hover:bg-marquee-300 text-slate-950 font-bold transition disabled:opacity-50"
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
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 ring-1 ring-slate-800">
                <CountdownRing seconds={timeLeftSeconds} total={hasOffer ? 900 : 600} size={52} />
                <p className={`text-sm ${lowTime ? 'text-indigo-200' : 'text-slate-300'}`}>
                  {lowTime ? 'Less than a minute left. Pay now to keep these seats.' : 'These seats are saved for you while you pay.'}
                </p>
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
                        Row {seat.row}, seat {seat.number}
                      </span>
                      <span className="text-xs text-slate-400 block">{seat.section}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-marquee-300">${seat.price}</span>
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
        <div className="lg:hidden fixed inset-x-0 bottom-16 md:bottom-0 z-40 px-3 pb-3 pt-6 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent animate-slide-up">
          <div className="max-w-2xl mx-auto bg-slate-900 ring-1 ring-marquee-400/30 rounded-2xl p-3 shadow-[0_-10px_40px_-10px_rgba(255,200,87,0.25)] flex items-center gap-3">
            <CountdownRing seconds={timeLeftSeconds} total={hasOffer ? 900 : 600} size={46} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {seatList}
              </p>
              <p className={`text-xs ${lowTime ? 'text-indigo-200' : 'text-slate-400'}`}>
                {lowTime ? 'Pay now to keep them' : `Saved for you, $${totalHeldPrice} total`}
              </p>
            </div>
            {payButton('shrink-0')}
          </div>
        </div>
      )}
    </div>
  );
}
