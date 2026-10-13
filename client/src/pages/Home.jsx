import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Ticket,
  ShieldCheck,
  Zap,
  Users,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  Database,
  Cpu,
} from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Phase 1 Architecture Complete: Auth & Replica Set Ready</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            High-Concurrency Live Event & Movie Booking
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            TicketX is engineered for high-demand ticket drops where thousands of fans claim seats at the exact same millisecond. Powered by MongoDB Replica Set multi-document transactions and atomic seat locks.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">
                  Logged in as <strong className="text-white">{user.name}</strong> ({user.role})
                </span>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
                  >
                    Open Admin Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
                >
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
                >
                  Sign In with Demo Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Core Architecture Pillars */}
      <div>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          Concurrency & Core Engine Highlights
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Atomic Seat Locking</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zero double-bookings guaranteed. Uses single-step atomic <code className="text-indigo-300">findOneAndUpdate</code> with status and hold expiry filter conditions.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Replica Set Transactions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-seat confirmations execute inside an ACID transaction. If any seat fails validation, the entire booking rolls back automatically.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Role-Based Access Control</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Granular JWT authentication with <code className="text-indigo-300">requireRole</code> guard covering Customers, Organisers, and Admins with real-time block checks.
            </p>
          </div>
        </div>
      </div>

      {/* Seed Accounts Matrix */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Pre-configured Seed Accounts
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Created via <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded">npm run seed</code> (Password for all: <code className="text-emerald-300">Password123!</code>)
            </p>
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Quick test via Login Page <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Display Name</th>
                <th className="pb-3 font-semibold">Email</th>
                <th className="pb-3 font-semibold">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30">
                    Admin
                  </span>
                </td>
                <td className="py-3 font-medium text-white">TicketX Administrator</td>
                <td className="py-3 text-slate-400 font-mono">admin@ticketx.com</td>
                <td className="py-3 text-slate-400">User management, block accounts, platform stats</td>
              </tr>
              <tr>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30">
                    Organiser
                  </span>
                </td>
                <td className="py-3 font-medium text-white">Cinema World Studios</td>
                <td className="py-3 text-slate-400 font-mono">cinema@ticketx.com</td>
                <td className="py-3 text-slate-400">Manage cinema screens, movies & ticket verification</td>
              </tr>
              <tr>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30">
                    Organiser
                  </span>
                </td>
                <td className="py-3 font-medium text-white">Live Beats Concerts</td>
                <td className="py-3 text-slate-400 font-mono">concerts@ticketx.com</td>
                <td className="py-3 text-slate-400">Manage stadium seating, concerts & live events</td>
              </tr>
              <tr>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                    Customer
                  </span>
                </td>
                <td className="py-3 font-medium text-white">Alice Johnson</td>
                <td className="py-3 text-slate-400 font-mono">alice@ticketx.com</td>
                <td className="py-3 text-slate-400">Seat selection, holding, booking, QR tickets</td>
              </tr>
              <tr>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                    Customer
                  </span>
                </td>
                <td className="py-3 font-medium text-white">Bob, Charlie, Diana, Evan</td>
                <td className="py-3 text-slate-400 font-mono">bob@ticketx.com, ...</td>
                <td className="py-3 text-slate-400">Concurrent hold contention & waitlist testing</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
