import React, { useState, useEffect } from 'react';
import EventPoster from '../components/EventPoster';
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-5 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl sm:text-6xl font-black uppercase text-white leading-none">
            What&apos;s on
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Pick your exact seat on a live map.
          </p>
        </div>

        {/* Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-[1fr_1fr_auto] md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative min-w-0 md:min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* City Filter */}
          <div className="relative min-w-0 md:min-w-[140px]">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="City"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
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

      {/* Events */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-slate-900 ring-1 ring-slate-800">
              <div className="skeleton rounded-none h-52" />
              <div className="p-4 space-y-2.5">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-11 w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl p-10 text-center max-w-md mx-auto space-y-3 bg-slate-900 ring-1 ring-slate-800">
          <Ticket className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No events match</h3>
          <p className="text-sm text-slate-400">Try a different search or city, or clear the filters to see everything.</p>
          <button
            onClick={() => {
              setSelectedType('');
              setCityFilter('');
              setSearchQuery('');
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => {
            const priceValues = ev.priceBySection ? Object.values(ev.priceBySection) : [];
            const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
            const left = ev.availableSeats ?? 0;
            const total = ev.totalSeats ?? 0;
            const filled = total ? Math.round(((total - left) / total) * 100) : 0;

            return (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="group rounded-2xl overflow-hidden bg-slate-900 ring-1 ring-slate-800 hover:ring-marquee-400/60 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(216,31,72,0.6)] flex flex-col"
              >
                <div className="overflow-hidden">
                  <EventPoster event={ev} className="h-52 transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="text-sm text-slate-300 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                      {new Date(ev.startsAt).toLocaleString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {ev.venueId && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {ev.venueId.name}, {ev.venueId.city}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span
                        className={
                          left === 0
                            ? 'text-indigo-300 font-semibold'
                            : left < 20
                            ? 'text-marquee-300 font-semibold'
                            : 'text-emerald-300 font-semibold'
                        }
                      >
                        {left === 0 ? 'Sold out' : left < 20 ? `Only ${left} left` : `${left} seats left`}
                      </span>
                      <span className="text-slate-400">from ${minPrice}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-marquee-400 to-indigo-500"
                        style={{ width: `${Math.max(filled, 2)}%` }}
                      />
                    </div>
                  </div>

                  <span className="mt-auto w-full py-3 rounded-xl text-sm font-bold text-center text-white bg-indigo-600 group-hover:bg-indigo-500 transition">
                    {left === 0 ? 'Join the waitlist' : 'Pick seats'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
