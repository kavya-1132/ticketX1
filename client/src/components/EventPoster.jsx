import React from 'react';

// Poster colourways, all drawn from the theme (curtain red, velvet, marquee gold, plum)
const PALETTES = [
  { from: '#D81F48', to: '#3F0518', ink: '#FFF3D6', accent: '#FFC857' },
  { from: '#F5AF2A', to: '#8E1333', ink: '#1B152E', accent: '#FFF3D6' },
  { from: '#B52A7D', to: '#1B152E', ink: '#FFE6AD', accent: '#FF9AAB' },
  { from: '#3B3257', to: '#110C1E', ink: '#FFC857', accent: '#FF6B86' },
  { from: '#FF6B86', to: '#561740', ink: '#FFF3D6', accent: '#FFE6AD' },
];

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function posterPalette(title = '') {
  return PALETTES[hash(title) % PALETTES.length];
}

/**
 * A generated gig / film poster for an event, so every event has its own artwork
 * without needing uploaded images. Concerts get sound rings, films get a film strip.
 */
export default function EventPoster({ event, className = '', compact = false, showTitle = true }) {
  const p = posterPalette(event.title);
  const isMovie = event.type === 'movie';
  const date = new Date(event.startsAt);
  const day = date.toLocaleDateString(undefined, { day: 'numeric' });
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  // Main title before a colon, subtitle after it ("Neon Skies: World Tour Live")
  const [main, ...rest] = (event.title || '').split(':');
  const sub = rest.join(':').trim();
  const seed = hash(event.title || '');

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${p.from} 0%, ${p.to} 85%)`, color: p.ink }}
    >
      {/* Artwork */}
      {isMovie ? (
        <div
          className="absolute -right-6 top-0 bottom-0 w-16 opacity-25"
          style={{
            background: `repeating-linear-gradient(180deg, transparent 0 10px, ${p.ink} 10px 18px)`,
            borderLeft: `6px solid ${p.ink}`,
            borderRight: `6px solid ${p.ink}`,
            transform: `rotate(${8 + (seed % 10)}deg)`,
          }}
        />
      ) : (
        <div
          className="absolute rounded-full opacity-30"
          style={{
            width: 260,
            height: 260,
            right: -90 - (seed % 40),
            top: -70 - (seed % 30),
            background: `repeating-radial-gradient(circle, ${p.accent} 0 2px, transparent 2px 16px)`,
          }}
        />
      )}
      <div className="absolute inset-0 poster-grain opacity-60 pointer-events-none" />

      {/* Type */}
      <div className={`relative h-full flex flex-col justify-between ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold opacity-80">{isMovie ? 'Film' : 'Live music'}</span>
          <div className="text-right leading-none font-display" style={{ color: p.accent }}>
            <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-black`}>{day}</div>
            <div className="text-sm font-bold">{month}</div>
          </div>
        </div>
        {showTitle && <div>
          <div
            className={`font-display font-black uppercase leading-[0.88] tracking-tight ${compact ? 'text-[1.7rem]' : 'text-[2.1rem] sm:text-[2.4rem]'}`}
            style={{ textWrap: 'balance' }}
          >
            {main}
          </div>
          {sub && <div className={`font-semibold opacity-85 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>{sub}</div>}
        </div>}
      </div>
    </div>
  );
}
