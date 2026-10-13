/** @type {import('tailwindcss').Config} */

/*
 * TicketX theme: a box office at night.
 *  - slate   -> plum ink (theatre dark, not flat black)
 *  - indigo  -> curtain red (primary actions; white text passes contrast)
 *  - violet  -> velvet magenta (gradient partner for curtain red)
 *  - marquee -> bulb gold (anything that is YOURS: your seats, your tickets)
 * Remapping slate/indigo/violet restyles every existing page consistently.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#F6F4FA',
          100: '#EEEAF6',
          200: '#DDD6EC',
          300: '#C3BAD8',
          400: '#A197BC',
          500: '#82789F',
          600: '#584E77',
          700: '#3B3257',
          800: '#292141',
          900: '#1B152E',
          950: '#110C1E',
        },
        indigo: {
          50: '#FFF0F2',
          100: '#FFE0E5',
          200: '#FFC2CC',
          300: '#FF9AAB',
          400: '#FF6B86',
          500: '#F2405F',
          600: '#D81F48',
          700: '#B3153A',
          800: '#8E1333',
          900: '#6E1230',
          950: '#3F0518',
        },
        violet: {
          50: '#FDF0F8',
          100: '#FBE0F1',
          200: '#F7C2E3',
          300: '#F197CF',
          400: '#E866B4',
          500: '#D43F97',
          600: '#B52A7D',
          700: '#912065',
          800: '#6F1A50',
          900: '#561740',
          950: '#330722',
        },
        marquee: {
          100: '#FFF3D6',
          200: '#FFE6AD',
          300: '#FFD98A',
          400: '#FFC857',
          500: '#F5AF2A',
          600: '#D98E0B',
          700: '#A86A06',
        },
        stub: '#F4EADB',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Big Shoulders Display"', 'Impact', '"Arial Narrow"', 'sans-serif'],
      },
      keyframes: {
        'page-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)' },
          '60%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        flash: {
          '0%': { boxShadow: '0 0 0 0 rgba(255, 107, 134, 0.9)' },
          '100%': { boxShadow: '0 0 0 10px rgba(255, 107, 134, 0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(110%)' },
          to: { transform: 'none' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          from: { backgroundPosition: '-400px 0' },
          to: { backgroundPosition: '400px 0' },
        },
        print: {
          '0%': { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-14px)' },
          '100%': { clipPath: 'inset(0 0 0 0)', transform: 'none' },
        },
        'flip-in': {
          from: { opacity: '0', transform: 'perspective(600px) rotateX(-70deg)' },
          to: { opacity: '1', transform: 'none' },
        },
        'row-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      // 'backwards' = no leftover transform after an entrance, so fixed/sticky children keep working
      animation: {
        'page-in': 'page-in 260ms ease-out backwards',
        pop: 'pop 320ms cubic-bezier(.34,1.56,.64,1) both',
        flash: 'flash 800ms ease-out',
        'slide-up': 'slide-up 340ms cubic-bezier(.2,.9,.3,1) both',
        'toast-in': 'toast-in 220ms ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
        print: 'print 900ms cubic-bezier(.2,.8,.2,1) both',
        'flip-in': 'flip-in 420ms cubic-bezier(.2,.8,.2,1) backwards',
        'row-in': 'row-in 380ms ease-out backwards',
      },
    },
  },
  plugins: [],
};
