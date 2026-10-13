import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Ticket, LogOut, User as UserIcon, Shield, Calendar, Film, Home as HomeIcon, LogIn } from 'lucide-react';

/**
 * Links shown to the current user. Used by the desktop top bar and the phone tab bar,
 * so both always offer the same places.
 */
function useNavItems() {
  const { user, isAuthenticated } = useAuth();
  const items = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/events', label: 'Events', icon: Calendar },
  ];
  if (isAuthenticated && user?.role === 'customer') {
    items.push({ to: '/my-tickets', label: 'My Tickets', icon: Ticket });
  }
  if (isAuthenticated && (user?.role === 'organiser' || user?.role === 'admin')) {
    items.push({ to: '/organiser', label: 'Organiser', icon: Film });
  }
  if (isAuthenticated && user?.role === 'admin') {
    items.push({ to: '/admin', label: 'Admin', icon: Shield });
  }
  return items;
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const items = useNavItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16 gap-3">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-200">
                <Ticket className="w-5 h-5 -rotate-45" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black uppercase text-2xl md:text-[1.7rem] leading-none text-marquee-200 tracking-wide">
                  TicketX
                </span>
              </div>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1 text-sm font-medium">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                      isActive ? 'text-marquee-200 bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-marquee-400" />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Account */}
            <div className="flex items-center gap-2 min-w-0">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2 bg-slate-800/80 pl-1.5 pr-3 py-1 rounded-full border border-slate-700/60 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-semibold text-slate-200 leading-none truncate max-w-[110px] sm:max-w-[160px]">
                        {user.name}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider leading-none mt-0.5">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 shrink-0"
                    title="Log out"
                    aria-label="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 sm:px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all duration-150 active:scale-95 whitespace-nowrap"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Phone tab bar: always reachable with a thumb */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        <div className="flex items-stretch justify-around h-16">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-marquee-200' : 'text-slate-400 active:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                      isActive ? 'bg-marquee-400/15 scale-110' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
          {!isAuthenticated && (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  isActive ? 'text-marquee-200' : 'text-slate-400'
                }`
              }
            >
              <span className="flex items-center justify-center w-12 h-7">
                <LogIn className="w-5 h-5" />
              </span>
              Log in
            </NavLink>
          )}
        </div>
      </nav>
    </>
  );
}
