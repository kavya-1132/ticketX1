import React, { useState, useEffect } from 'react';
import { getAdminUsers, toggleBlockUser, getAdminStats } from '../api/auth';
import { Shield, Users, Ban, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, statsData] = await Promise.all([
        getAdminUsers(selectedRole),
        getAdminStats(),
      ]);
      setUsers(usersData.users);
      setStats(statsData.stats);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedRole]);

  const handleToggleBlock = async (user) => {
    if (user.role === 'admin') return;
    setActionLoading(user.id);
    try {
      const updated = await toggleBlockUser(user.id, !user.isBlocked);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isBlocked: updated.user.isBlocked } : u))
      );
      // Refresh stats
      const statsData = await getAdminStats();
      setStats(statsData.stats);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user block status');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Platform Administration</h1>
          <p className="text-sm text-slate-400 mt-1">Manage users, ban/unban accounts, and view platform metrics</p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Total Users</span>
            <p className="text-2xl font-extrabold text-white mt-1">{stats.totalUsers}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Customers</span>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{stats.customerCount}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Organisers</span>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">{stats.organiserCount}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Admins</span>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">{stats.adminCount}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Blocked</span>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">{stats.blockedCount}</p>
          </div>
        </div>
      )}

      {/* Sales Row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="grid grid-cols-2 gap-4 lg:col-span-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-medium">Revenue</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">${stats.revenue ?? 0}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-medium">Tickets sold</span>
              <p className="text-2xl font-extrabold text-white mt-1">{stats.ticketsSold ?? 0}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-medium">Bookings</span>
              <p className="text-2xl font-extrabold text-indigo-400 mt-1">{stats.confirmedBookings ?? 0}</p>
              <span className="text-[11px] text-slate-500">{stats.cancelledBookings ?? 0} cancelled</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-medium">On waitlists</span>
              <p className="text-2xl font-extrabold text-amber-400 mt-1">{stats.waitlistActive ?? 0}</p>
              <span className="text-[11px] text-slate-500">{stats.eventCount ?? 0} events</span>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-medium">Top events by revenue</span>
            {(!stats.topEvents || stats.topEvents.length === 0) ? (
              <p className="text-xs text-slate-500 mt-3">No sales yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {stats.topEvents.map((ev) => {
                  const max = stats.topEvents[0].revenue || 1;
                  return (
                    <div key={ev.eventId} className="text-xs">
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="truncate pr-2">{ev.title || 'Deleted event'}</span>
                        <span className="text-slate-400 whitespace-nowrap">
                          ${ev.revenue} · {ev.tickets} tickets
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.max(4, (ev.revenue / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Table & Filtering */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Registered Accounts
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="organiser">Organiser</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 font-medium text-white">{u.name}</td>
                    <td className="py-3 text-slate-400 font-mono">{u.email}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                          u.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : u.role === 'organiser'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      {u.isBlocked ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                          <Ban className="w-3.5 h-3.5" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleBlock(u)}
                          disabled={actionLoading === u.id}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                            u.isBlocked
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          {actionLoading === u.id
                            ? 'Updating...'
                            : u.isBlocked
                            ? 'Unblock User'
                            : 'Block User'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
