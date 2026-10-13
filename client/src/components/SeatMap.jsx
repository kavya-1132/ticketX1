import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, Maximize2 } from 'lucide-react';

const LABEL_W = 22; // row letter column (px)
const COMFORT = 32; // finger-friendly seat size (px)
const MAX_FIT = 34; // largest seat when the whole hall fits

/**
 * Seat map that adapts to the screen.
 *
 * - Wide screens: the whole hall fits, seats are comfortable to click.
 * - Phones: seats would be too small to tap if the whole hall were squeezed in, so it opens
 *   zoomed in (finger-sized seats, swipe sideways, row letters stay pinned on the left)
 *   with a toggle to see the whole hall at once.
 * - Rows are grouped by section with the section's price, so it's clear what each area costs.
 */
export default function SeatMap({ seats, userId, busySeatId, onSeatClick, stageLabel, priceBySection }) {
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [zoomed, setZoomed] = useState(null); // null = decide automatically

  // Track the available width
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Group seats by row, keep rows in order, note where the section changes
  const rows = useMemo(() => {
    const map = new Map();
    seats.forEach((s) => {
      if (!map.has(s.row)) map.set(s.row, []);
      map.get(s.row).push(s);
    });
    const list = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([row, rowSeats]) => ({ row, seats: rowSeats.sort((a, b) => a.number - b.number) }));
    return list.map((r, i) => ({
      ...r,
      section: r.seats[0]?.section,
      newSection: i === 0 || r.seats[0]?.section !== list[i - 1].seats[0]?.section,
    }));
  }, [seats]);

  const maxPerRow = rows.reduce((m, r) => Math.max(m, r.seats.length), 0) || 1;

  // Seat size if the whole hall must fit in the width
  const fitGap = 3;
  const fitSize = width
    ? Math.min(MAX_FIT, Math.floor((width - LABEL_W * 2 - 8 - (maxPerRow - 1) * fitGap) / maxPerRow))
    : COMFORT;
  const fitsComfortably = fitSize >= 24;
  const isZoomed = fitsComfortably ? false : zoomed ?? true;

  const size = isZoomed ? COMFORT : Math.max(8, fitSize);
  const gap = isZoomed ? 5 : fitGap;
  const showNumbers = size >= 22;
  const rowWidth = maxPerRow * size + (maxPerRow - 1) * gap;

  // When zoomed in, start the view in the middle of the hall (best seats)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && isZoomed) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [isZoomed, width, rows.length]);

  const priceOf = (section) => {
    if (!priceBySection) return null;
    const prices = priceBySection instanceof Map ? Object.fromEntries(priceBySection) : priceBySection;
    return prices[section];
  };

  return (
    <div ref={wrapRef} className="w-full">
      {/* Stage / screen */}
      <div className="mb-6">
        <div className="w-4/5 sm:w-3/4 mx-auto h-1.5 bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50" />
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">{stageLabel}</p>
      </div>

      {!fitsComfortably && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setZoomed(!isZoomed)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 active:scale-95 transition"
          >
            {isZoomed ? <Maximize2 className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            {isZoomed ? 'See whole hall' : 'Zoom in to pick'}
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`relative ${isZoomed ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden'} pb-2`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="mx-auto" style={{ width: rowWidth + LABEL_W * 2 + 8 }}>
          {rows.map(({ row, seats: rowSeats, section, newSection }) => (
            <React.Fragment key={row}>
              {newSection && (
                <div
                  className="sticky left-0 flex items-center gap-2 mt-4 mb-2 first:mt-0"
                  style={{ width: isZoomed && width ? width - 4 : '100%' }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{section}</span>
                  {priceOf(section) !== undefined && priceOf(section) !== null && (
                    <span className="text-[11px] font-bold text-indigo-300">${priceOf(section)}</span>
                  )}
                  <span className="flex-1 h-px bg-slate-800" />
                </div>
              )}
              <div className="flex items-center" style={{ marginBottom: gap }}>
                <span
                  className="sticky left-0 z-10 shrink-0 text-center text-[11px] font-bold text-slate-400 font-mono bg-slate-900"
                  style={{ width: LABEL_W, lineHeight: `${size}px` }}
                >
                  {row}
                </span>
                <div className="flex mx-1" style={{ gap }}>
                  {rowSeats.map((seat) => {
                    const seatId = seat.id || seat._id;
                    const heldById = seat.heldBy?._id || seat.heldBy;
                    const mine = seat.status === 'held' && userId && heldById === userId;
                    const heldOther = seat.status === 'held' && !mine;
                    const booked = seat.status === 'booked';
                    const busy = busySeatId === seatId;

                    let cls =
                      'bg-emerald-500/15 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/35 active:scale-90';
                    if (booked) cls = 'bg-slate-800 text-slate-600 border-slate-700/60 cursor-not-allowed';
                    else if (mine) cls = 'bg-indigo-500 text-white border-indigo-300 ring-2 ring-indigo-300/60 shadow-md shadow-indigo-500/40';
                    else if (heldOther) cls = 'bg-amber-500/20 text-amber-300/80 border-amber-500/40 cursor-not-allowed';

                    const status = booked ? 'booked' : mine ? 'held by you' : heldOther ? 'being held by someone' : 'available';

                    return (
                      <button
                        key={seatId}
                        type="button"
                        disabled={booked || heldOther || busy}
                        onClick={() => onSeatClick(seat)}
                        aria-label={`Row ${seat.row} seat ${seat.number}, ${seat.section}, $${seat.price}, ${status}`}
                        title={`${seat.row}${seat.number} · ${seat.section} · $${seat.price}`}
                        className={`shrink-0 rounded-t-lg rounded-b-sm border font-bold flex items-center justify-center transition-all duration-150 ${cls}`}
                        style={{ width: size, height: size, fontSize: size >= 30 ? 11 : 9 }}
                      >
                        {busy ? (
                          <span className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : showNumbers ? (
                          seat.number
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <span
                  className="shrink-0 text-center text-[11px] font-bold text-slate-500 font-mono"
                  style={{ width: LABEL_W, lineHeight: `${size}px` }}
                >
                  {row}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {isZoomed && (
        <p className="text-center text-[11px] text-slate-500 mt-1">Swipe sideways to see more seats</p>
      )}
    </div>
  );
}
