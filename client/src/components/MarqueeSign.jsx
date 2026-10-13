import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

const INSET = 11; // distance of the bulb track from the sign's edge (px)
const RADIUS = 24; // sign corner radius (px)
const SPACING = 22; // target distance between bulbs (px)
const CYCLE = 2.4; // seconds for one chase cycle (matches .bulb animation)
const WAVES = 3; // bright spots travelling around at once

/** Points evenly spaced along a rounded rectangle, clockwise from the top-left. */
function bulbPoints(w, h) {
  const r = Math.max(0, RADIUS - INSET);
  const x0 = INSET;
  const y0 = INSET;
  const x1 = w - INSET;
  const y1 = h - INSET;
  const sw = x1 - x0 - 2 * r;
  const sh = y1 - y0 - 2 * r;
  if (sw <= 0 || sh <= 0) return [];
  const arc = (Math.PI / 2) * r;
  const segments = [
    { len: sw, at: (t) => [x0 + r + t, y0] },
    { len: arc, at: (t) => { const a = -Math.PI / 2 + t / r; return [x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a)]; } },
    { len: sh, at: (t) => [x1, y0 + r + t] },
    { len: arc, at: (t) => { const a = t / r; return [x1 - r + r * Math.cos(a), y1 - r + r * Math.sin(a)]; } },
    { len: sw, at: (t) => [x1 - r - t, y1] },
    { len: arc, at: (t) => { const a = Math.PI / 2 + t / r; return [x0 + r + r * Math.cos(a), y1 - r + r * Math.sin(a)]; } },
    { len: sh, at: (t) => [x0, y1 - r - t] },
    { len: arc, at: (t) => { const a = Math.PI + t / r; return [x0 + r + r * Math.cos(a), y0 + r + r * Math.sin(a)]; } },
  ];
  const total = segments.reduce((s, g) => s + g.len, 0);
  const count = Math.max(8, Math.round(total / SPACING));
  const step = total / count;
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    let d = i * step;
    for (const seg of segments) {
      if (d <= seg.len) {
        pts.push(seg.at(d));
        break;
      }
      d -= seg.len;
    }
  }
  return pts;
}

/**
 * A theatre marquee: a dark sign framed by bulbs that flicker on, then chase around the edge.
 * The bulbs are positioned from the sign's real size, so they always sit evenly on the frame.
 */
export default function MarqueeSign({ children, className = '' }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => bulbPoints(size.w, size.h), [size.w, size.h]);

  return (
    <div ref={ref} className={`marquee-sign ${className}`} style={{ borderRadius: RADIUS }}>
      <div className="marquee-bulbs absolute inset-0 pointer-events-none" aria-hidden="true">
        {points.map(([x, y], i) => (
          <span
            key={i}
            className="bulb"
            // Later bulbs peak later, so the light travels clockwise
            style={{ left: x, top: y, animationDelay: `${-(CYCLE - (((i / points.length) * CYCLE * WAVES) % CYCLE))}s` }}
          />
        ))}
      </div>
      <div className="relative" style={{ padding: INSET + 18 }}>
        {children}
      </div>
    </div>
  );
}
