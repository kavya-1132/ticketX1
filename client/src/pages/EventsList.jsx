import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../api/events';
import {
  Calendar,
  MapPin,
  Film,
  Music,
  Search,
  Filter,
  Ticket,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEventsList = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedType) params.type = selectedType;
      if (cityFilter) params.city = cityFilter;
      if (searchQuery) params.search = searchQuery;

      const data = await getEvents(params);
      setEvents(data.events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventsList();
  }, [selectedType, cityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEventsList();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Live seat maps</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Discover Events & Screenings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time seat contention for sold-out concerts and cinema premieres.
          </p>
        </div>

        {/* Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* City Filter */}
          <div className="relative min-w-[140px]">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Type Toggle Pills */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <button
          onClick={() => setSelectedType('')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            selectedType === ''
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          All Events
        </button>

        <button
          onClick={() => setSelectedType('movie')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            selectedType === 'movie'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          Movies
        </button>

        <button
          onClick={() => setSelectedType('concert')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            selectedType === 'concert'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          Concerts
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto space-y-3">
          <Ticket className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Events Found</h3>
          <p className="text-xs text-slate-400">
            No events match your current filter settings. Try clearing the search or city filter.
          </p>
          <button
            onClick={() => {
              setSelectedType('');
              setCityFilter('');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => {
            const dateStr = new Date(ev.startsAt).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const priceValues = ev.priceBySection ? Object.values(ev.priceBySection) : [];
            const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
            const maxPrice = priceValues.length ? Math.max(...priceValues) : 0;

            const isMovie = ev.type === 'movie';

            return (
              <div
                key={ev.id}
                className="group bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-xl transition-all duration-200 flex flex-col justify-between hover:-translate-y-1"
              >
                <div>
                  {/* Banner / Poster Header */}
                  <div
                    className={`h-40 p-5 flex flex-col justify-between relative overflow-hidden ${
                      isMovie
                        ? 'bg-gradient-to-br from-indigo-900/60 via-slate-900 to-slate-950'
                        : 'bg-gradient-to-br from-violet-900/60 via-slate-900 to-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between z-10">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 border ${
                          isMovie
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                        }`}
                      >
                        {isMovie ? <Film className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                        {ev.type}
                      </span>

                      <span className="text-xs font-bold text-white/90 bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800 backdrop-blur-md">
                        ${minPrice} {maxPrice > minPrice ? `- $${maxPrice}` : ''}
                      </span>
                    </div>

                    <div className="z-10">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition leading-snug">
                        {ev.title}
                      </h2>
                      {ev.venueId && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            {ev.venueId.name}, {ev.venueId.city}
                          </span>
                        </p>
                      )}
                    </div>

                    {ev.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}

                    {/* Seat Stats */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Availability
                        </span>
                        <span className="font-extrabold text-emerald-400">
                          {ev.availableSeats ?? 0} seats left
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Capacity
                        </span>
                        <span className="font-semibold text-slate-300">
                          {ev.totalSeats ?? 0} Total
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 pt-0">
                  <Link
                    to={`/events/${ev.id}`}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 group-hover:shadow-indigo-600/40 transition active:scale-95"
                  >
                    <span>Select Seats</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
