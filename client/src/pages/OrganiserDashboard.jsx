import React, { useState, useEffect } from 'react';
import { getVenues, createVenue, createEvent, getEvents } from '../api/events';
import { useAuth } from '../context/AuthContext';
import { Plus, Film, Calendar, MapPin, CheckCircle, AlertCircle, Building2 } from 'lucide-react';

export default function OrganiserDashboard() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Event form
  const [title, setTitle] = useState('');
  const [type, setType] = useState('concert');
  const [venueId, setVenueId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [vipPrice, setVipPrice] = useState('150');
  const [generalPrice, setGeneralPrice] = useState('50');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    try {
      const [venuesData, eventsData] = await Promise.all([getVenues(), getEvents()]);
      setVenues(venuesData.venues);
      if (venuesData.venues.length > 0 && !venueId) {
        setVenueId(venuesData.venues[0].id || venuesData.venues[0]._id);
      }
      setEvents(eventsData.events);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load organiser data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreating(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const eventData = {
        title,
        type,
        venueId,
        startsAt: new Date(startsAt).toISOString(),
        priceBySection: {
          VIP: Number(vipPrice),
          General: Number(generalPrice),
        },
        description,
      };

      const res = await createEvent(eventData);
      setSuccessMsg(
        `Event "${res.event.title}" created with ${res.seatsGenerated} seats generated from venue layout!`
      );
      setTitle('');
      setDescription('');
      setStartsAt('');
      loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
          <Film className="w-3.5 h-3.5" />
          <span>Organiser Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Event Creation & Venue Layouts</h1>
        <p className="text-sm text-slate-400 mt-1">
          Create events. The backend automatically translates venue blueprint rows into seat documents.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form: Create Event */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            Create New Event
          </h2>

          <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">Event Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Neon Nights Symphony"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">Event Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="concert">Concert</option>
                <option value="movie">Movie</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">Select Venue</label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {venues.map((v) => (
                  <option key={v.id || v._id} value={v.id || v._id}>
                    {v.name} ({v.city}) — {v.layout?.rows?.length * v.layout?.seatsPerRow} seats
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">VIP Price ($)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">General Price ($)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={generalPrice}
                  onChange={(e) => setGeneralPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">Description</label>
              <textarea
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief event description..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition duration-150 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {creating ? 'Generating Seats...' : 'Publish Event'}
            </button>
          </form>
        </div>

        {/* List of active events */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Active Platform Events
          </h2>

          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300">
                      {ev.type}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{ev.venueId?.name}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{ev.title}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(ev.startsAt).toLocaleDateString()} &bull; {ev.totalSeats} Total Seats ({ev.availableSeats} available)
                  </p>
                </div>

                <a
                  href={`/events/${ev.id}`}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition"
                >
                  View Blueprint &rarr;
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
