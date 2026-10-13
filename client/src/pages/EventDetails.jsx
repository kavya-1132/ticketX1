import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEventById, getEventSeats, holdSeat, releaseSeat, confirmBooking } from '../api/events';
import { getMyWaitlist, joinWaitlist, leaveWaitlist } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
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
        setErrorMsg('Seat was just taken by another customer at the exact same moment!');
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
        <p className="text-sm font-medium">Loading seat blueprint...</p>
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back link & Event Overview Header */}
      <div>
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all events</span>
        </Link>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {event.type}
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Live Contention Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                {event.venueId?.name}, {event.venueId?.city}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {new Date(event.startsAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Capacity: {seats.length} Seats
              </span>
            </div>
          </div>

          {/* Pricing Legend Breakdown */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            {event.priceBySection &&
              Object.entries(
                event.priceBySection instanceof Map
                  ? Object.fromEntries(event.priceBySection)
                  : event.priceBySection
              ).map(([sec, pr]) => (
                <div key={sec} className="text-center px-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">{sec}</span>
                  <span className="text-sm font-black text-indigo-300">${pr}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Error / Conflict Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 animate-shake">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Waitlist offer: a cancelled seat is being held for this customer */}
      {hasOffer && myHeldSeats.length > 0 && (
        <div className="p-5 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 text-sm flex items-center gap-3">
          <Hourglass className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-emerald-200">
            <strong className="text-emerald-300">A seat opened up for you from the waitlist.</strong>{' '}
            It's held in your checkout for 15 minutes. Pay below to keep it, or it goes to the next person in line.
          </p>
        </div>
      )}

      {/* Booking Confirmed Modal Banner */}
      {bookingSuccess && (
        <div className="p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-base">
              <CheckCircle className="w-5 h-5" />
              <span>Booking Confirmed via MongoDB ACID Transaction!</span>
            </div>
            <p className="text-xs text-slate-300">
              Booking Ref: <code className="text-white font-mono">{bookingSuccess.id || bookingSuccess._id}</code> | Total Paid: <strong className="text-white">${bookingSuccess.total}</strong>
            </p>
            <p className="text-xs text-slate-400">Your QR ticket is below and has been emailed to you.</p>
          </div>
          {bookingSuccess.qrCode && (
            <img src={bookingSuccess.qrCode} alt="Your QR ticket" className="w-28 h-28 rounded-xl bg-white p-1.5" />
          )}
          <div className="flex flex-col gap-2">
            <Link
              to="/my-tickets"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition text-center"
            >
              My Tickets
            </Link>
            <button
              onClick={() => setBookingSuccess(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Seat Map & Checkout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left 3 Columns: Interactive Seat Map */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Cinema Screen / Concert Stage Indicator */}
          <div className="relative mb-10">
            <div className="w-3/4 mx-auto h-2 bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50" />
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">
              {event.type === 'movie' ? '🎬 IMAX SCREEN' : '🎸 STAGE'}
            </p>
          </div>

          {/* Seat Color Code Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-3 border-y border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-md bg-emerald-500/20 border border-emerald-500/50 block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-md bg-indigo-600 border border-indigo-400 ring-2 ring-indigo-400/50 block" />
              <span className="text-indigo-300 font-semibold">Held By Me</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-md bg-amber-500/20 border border-amber-500/40 block" />
              <span>Held by Others</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-md bg-slate-800 border border-slate-700/60 block line-through" />
              <span>Booked</span>
            </div>
          </div>

          {/* Seat Blueprint Grid */}
          <div className="overflow-x-auto py-6">
            <div className="min-w-[650px] space-y-2.5 flex flex-col items-center">
              {Object.keys(rowsMap).map((rowLabel) => {
                const rowSeats = rowsMap[rowLabel];
                return (
                  <div key={rowLabel} className="flex items-center gap-1.5 sm:gap-2">
                    {/* Row Label Left */}
                    <span className="w-6 text-center text-xs font-bold text-slate-400 font-mono">
                      {rowLabel}
                    </span>

                    {/* Seats in this row */}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {rowSeats.map((seat) => {
                        const seatId = seat.id || seat._id;
                        const userId = user?.id || user?._id;
                        const isHeldByMe =
                          seat.status === 'held' &&
                          (seat.heldBy === userId || seat.heldBy?._id === userId);
                        const isHeldByOther = seat.status === 'held' && !isHeldByMe;
                        const isBooked = seat.status === 'booked';
                        const isAvailable = seat.status === 'available';
                        const isBusy = actionLoadingSeatId === seatId;

                        // Determine visual styling according to spec
                        let seatClass =
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/40 hover:scale-110 active:scale-95 cursor-pointer shadow-sm';
                        if (isBooked) {
                          seatClass =
                            'bg-slate-800/80 text-slate-500 border-slate-700/60 cursor-not-allowed opacity-40 line-through';
                        } else if (isHeldByMe) {
                          seatClass =
                            'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400 scale-105 cursor-pointer animate-pulse';
                        } else if (isHeldByOther) {
                          seatClass =
                            'bg-amber-500/20 text-amber-400 border-amber-500/40 cursor-not-allowed opacity-75';
                        }

                        return (
                          <button
                            key={seatId}
                            disabled={isBooked || isHeldByOther || isBusy}
                            onClick={() => handleSeatClick(seat)}
                            title={`Row ${seat.row}, Seat ${seat.number} (${seat.section}) - $${seat.price} [Status: ${seat.status}]`}
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md text-[10px] font-bold border transition-all duration-150 flex items-center justify-center ${seatClass}`}
                          >
                            {isBusy ? (
                              <span className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              seat.number
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Row Label Right */}
                    <span className="w-6 text-center text-xs font-bold text-slate-400 font-mono">
                      {rowLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Checkout & Hold Countdown Panel */}
        <div className="space-y-6">
          {/* Sold out -> FIFO waitlist */}
          {soldOut && myHeldSeats.length === 0 && (!isAuthenticated || isCustomer) && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-3xl p-5 space-y-3 text-xs">
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Hourglass className="w-4 h-4" />
                Sold out
              </h2>
              {waitlistEntry?.status === 'waiting' ? (
                <>
                  <p className="text-slate-300">
                    You're <strong className="text-white">#{waitlistEntry.position}</strong> on the waitlist. If someone
                    cancels, their seat is held for you for 15 minutes and we email you.
                  </p>
                  <button
                    onClick={handleLeaveWaitlist}
                    disabled={waitlistBusy}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition disabled:opacity-50"
                  >
                    Leave waitlist
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-300">
                    Join the waitlist. Cancelled seats go to people in the order they joined.
                  </p>
                  <button
                    onClick={handleJoinWaitlist}
                    disabled={waitlistBusy}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-50"
                  >
                    {waitlistBusy ? 'Joining...' : 'Join waitlist'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl sticky top-20 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Checkout Selection
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300">
                {myHeldSeats.length}/6 Seats
              </span>
            </div>

            {/* 10-Minute Hold Countdown Banner */}
            {myHeldSeats.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-xs flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>Hold Expires In:</span>
                </div>
                <span className="font-mono font-extrabold text-sm text-indigo-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                  {formatTime(timeLeftSeconds)}
                </span>
              </div>
            )}

            {/* Selected Seats List */}
            {myHeldSeats.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs space-y-2">
                <p>No seats selected.</p>
                <p className="text-[11px] text-slate-400">
                  Click on green available seats on the blueprint to reserve them atomically.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {myHeldSeats.map((seat) => (
                  <div
                    key={seat.id || seat._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">
                        Row {seat.row}, Seat {seat.number}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{seat.section}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-300">${seat.price}</span>
                      <button
                        onClick={() => handleSeatClick(seat)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Release seat"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total Calculation */}
            {myHeldSeats.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>${totalHeldPrice}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-white">
                  <span>Total Due</span>
                  <span className="text-emerald-400">${totalHeldPrice}</span>
                </div>
              </div>
            )}

            {/* Pay Button */}
            <button
              disabled={myHeldSeats.length === 0 || confirmingPayment}
              onClick={handlePayAndConfirm}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {confirmingPayment ? (
                <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay & Confirm Booking (${totalHeldPrice})</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Payments are mocked. Confirming executes inside a MongoDB transaction ensuring zero double-bookings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
