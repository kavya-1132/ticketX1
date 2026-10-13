import React from 'react';

/**
 * Circular timer for a seat hold. The ring empties as time runs out and turns red
 * in the last minute, so how long is left is readable at a glance.
 */
export default function CountdownRing({ seconds, total = 600, size = 44 }) {
  const s = Math.max(0, seconds ?? total);
  const frac = Math.min(1, s / total);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = s <= 60;
  const label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="timer" aria-label={`${label} left to pay`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#292141" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? '#FF6B86' : '#FFC857'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 300ms' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-bold tabular-nums ${
          urgent ? 'text-indigo-300 animate-pulse' : 'text-marquee-200'
        }`}
        style={{ fontSize: size * 0.3 }}
      >
        {label}
      </span>
    </div>
  );
}
