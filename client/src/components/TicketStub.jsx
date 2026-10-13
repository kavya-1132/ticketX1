import React from 'react';
import { posterPalette } from './EventPoster';

/**
 * A paper ticket: event details on top, a perforated tear line with notches,
 * and the QR code on the stub below. Used after payment and in My Tickets.
 */
export default function TicketStub({ event = {}, seats = [], total, qrCode, status = 'confirmed', className = '' }) {
  const p = posterPalette(event.title || '');
  const used = status === 'used';
  const cancelled = status === 'cancelled';
  const date = event.startsAt ? new Date(event.startsAt) : null;
  const venue = event.venueId && typeof event.venueId === 'object' ? event.venueId : null;
  const [main, ...rest] = (event.title || 'Your event').split(':');
  const sub = rest.join(':').trim();

  return (
    <div
      className={`relative bg-stub text-slate-950 rounded-[22px] overflow-hidden shadow-[0_24px_50px_-20px_rgba(0,0,0,0.8)] ${className}`}
    >
      {/* Colour band from the event's poster */}
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${p.from}, ${p.to})` }} />

      <div className="px-5 pt-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-black uppercase text-[1.9rem] leading-[0.9] tracking-tight" style={{ textWrap: 'balance' }}>
              {main}
            </p>
            {sub && <p className="text-sm font-semibold text-slate-700 mt-1">{sub}</p>}
          </div>
          {(used || cancelled) && (
            <span
              className={`shrink-0 -rotate-6 px-2 py-0.5 rounded-md border-2 font-display font-black text-lg uppercase ${
                cancelled ? 'border-indigo-600 text-indigo-600' : 'border-slate-500 text-slate-500'
              }`}
            >
              {cancelled ? 'Cancelled' : 'Used'}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">When</dt>
            <dd className="font-semibold">
              {date
                ? date.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Paid</dt>
            <dd className="font-semibold">${total}</dd>
          </div>
          {venue && (
            <div className="col-span-3">
              <dt className="text-xs text-slate-500">Where</dt>
              <dd className="font-semibold">
                {venue.name}, {venue.city}
              </dd>
            </div>
          )}
          <div className="col-span-3">
            <dt className="text-xs text-slate-500">{seats.length > 1 ? 'Seats' : 'Seat'}</dt>
            <dd className="flex flex-wrap gap-1.5 mt-1">
              {seats.map((s) => (
                <span
                  key={s._id || s.id || `${s.row}${s.number}`}
                  className="px-2 py-0.5 rounded-md bg-slate-950 text-marquee-300 font-display font-bold text-lg leading-tight"
                >
                  {s.row}
                  {s.number}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {qrCode && (
        <>
          {/* Tear line with a notch bitten out of each side */}
          <div className="relative h-7 flex items-center" aria-hidden="true">
            <span className="absolute -left-3.5 w-7 h-7 rounded-full bg-slate-950" />
            <span className="perforation flex-1 mx-5 text-slate-400/70" />
            <span className="absolute -right-3.5 w-7 h-7 rounded-full bg-slate-950" />
          </div>
          <div className="px-5 pb-5 pt-2 flex flex-col items-center gap-2">
            <img
              src={qrCode}
              alt="QR code ticket"
              className={`w-52 h-52 sm:w-44 sm:h-44 mix-blend-multiply ${used || cancelled ? 'opacity-25' : ''}`}
            />
            <p className="text-xs text-slate-600">{used ? 'This ticket has been scanned' : 'Show this at the entrance'}</p>
          </div>
        </>
      )}
    </div>
  );
}
