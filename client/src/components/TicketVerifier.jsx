import React, { useRef, useState } from 'react';
import { ScanLine, CheckCircle, XCircle } from 'lucide-react';
import { verifyTicket } from '../api/tickets';

/**
 * Gate check-in. Works with any USB/Bluetooth QR scanner (they type the code and press Enter)
 * or with the ticket code typed by hand.
 */
export default function TicketVerifier({ onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const data = await verifyTicket(code.trim());
      setResult({ ok: true, ...data });
      if (onVerified) onVerified();
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.error || 'Verification failed' });
    } finally {
      setBusy(false);
      setCode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-indigo-400" />
        Check in a ticket
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan the QR code or paste the ticket code"
          autoComplete="off"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-xs space-y-1">
          <p className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm">
            <CheckCircle className="w-5 h-5" /> Admit
          </p>
          <p className="text-slate-300">{result.ticket.event}</p>
          <p className="text-slate-300">
            {result.ticket.customer} · Seats {result.ticket.seats.join(', ')}
          </p>
        </div>
      )}
      {result && !result.ok && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-xs">
          <p className="flex items-center gap-2 text-rose-300 font-extrabold text-sm">
            <XCircle className="w-5 h-5" /> Do not admit
          </p>
          <p className="text-slate-300 mt-1">{result.error}</p>
        </div>
      )}
    </div>
  );
}
