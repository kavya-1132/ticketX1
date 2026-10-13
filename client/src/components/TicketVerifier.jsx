import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, CheckCircle, XCircle, Camera, CameraOff } from 'lucide-react';
import { verifyTicket } from '../api/tickets';

// The browser's built-in QR reader (Chrome on Android and desktop). No extra library needed.
const canScanWithCamera = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Gate check-in. Three ways in:
 *  - point the phone camera at the customer's QR code,
 *  - a USB/Bluetooth scanner (they type the code and press Enter),
 *  - type the ticket code by hand.
 */
export default function TicketVerifier({ onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const busyRef = useRef(false);

  const verify = async (value) => {
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const data = await verifyTicket(value.trim());
      setResult({ ok: true, ...data });
      if (navigator.vibrate) navigator.vibrate(80);
      if (onVerified) onVerified();
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.error || 'Verification failed' });
      if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setCode('');
    }
  };

  const stopCamera = () => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      // Wait a tick for the <video> to mount
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        let lastCode = '';
        loopRef.current = setInterval(async () => {
          if (busyRef.current || video.readyState < 2) return;
          try {
            const found = await detector.detect(video);
            const value = found[0]?.rawValue;
            // Ignore the same code twice in a row so one ticket isn't submitted repeatedly
            if (value && value !== lastCode) {
              lastCode = value;
              await verify(value);
              setTimeout(() => {
                lastCode = '';
              }, 3000);
            }
          } catch {
            /* a frame that couldn't be read; try the next one */
          }
        }, 300);
      });
    } catch (err) {
      setCameraOn(false);
      setCameraError(
        err && err.name === 'NotAllowedError'
          ? 'Allow camera access in your browser to scan tickets.'
          : 'Could not start the camera on this device.'
      );
    }
  };

  useEffect(() => stopCamera, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    verify(code);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-marquee-400" />
          Check in a ticket
        </h2>
        {canScanWithCamera() && (
          <button
            type="button"
            onClick={cameraOn ? stopCamera : startCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              cameraOn ? 'ring-1 ring-slate-700 text-slate-200' : 'bg-marquee-400 text-slate-950 hover:bg-marquee-300'
            }`}
          >
            {cameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {cameraOn ? 'Stop camera' : 'Scan with camera'}
          </button>
        )}
      </div>

      {cameraOn && (
        <div className="relative aspect-square max-w-xs mx-auto rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Aiming frame */}
          <div className="absolute inset-8 pointer-events-none">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'].map((c) => (
              <span key={c} className={`absolute w-8 h-8 border-marquee-400 ${c}`} />
            ))}
            <span className="absolute inset-x-2 h-0.5 bg-marquee-300/80 shadow-[0_0_12px_rgba(255,200,87,0.9)] animate-scan" />
          </div>
          <p className="absolute bottom-2 inset-x-0 text-center text-xs text-white/80">Point at the ticket's QR code</p>
        </div>
      )}

      {cameraError && <p className="text-sm text-indigo-300">{cameraError}</p>}
      {!canScanWithCamera() && (
        <p className="text-xs text-slate-400">
          Camera scanning works in Chrome on Android and computers. Here, use a QR scanner or type the code.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Or paste / scan the ticket code"
          autoComplete="off"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-marquee-400"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition disabled:opacity-50"
        >
          {busy ? 'Checking...' : 'Verify'}
        </button>
      </form>

      {result && result.ok && (
        <div key={result.ticket.bookingId} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-xs space-y-1 animate-pop">
          <p className="flex items-center gap-2 text-emerald-300 font-display font-black text-3xl uppercase">
            <CheckCircle className="w-7 h-7" /> Admit
          </p>
          <p className="text-slate-200 text-sm">{result.ticket.event}</p>
          <p className="text-slate-300">
            {result.ticket.customer}, seats {result.ticket.seats.join(', ')}
          </p>
        </div>
      )}
      {result && !result.ok && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/50 text-xs animate-shake">
          <p className="flex items-center gap-2 text-indigo-300 font-display font-black text-3xl uppercase">
            <XCircle className="w-7 h-7" /> Stop
          </p>
          <p className="text-slate-200 text-sm mt-1">{result.error}</p>
        </div>
      )}
    </div>
  );
}
