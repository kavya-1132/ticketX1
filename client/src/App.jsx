import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';

import EventsList from './pages/EventsList';
import EventDetails from './pages/EventDetails';
import OrganiserDashboard from './pages/OrganiserDashboard';
import MyTickets from './pages/MyTickets';

/** Each page fades in when you navigate, and the view starts at the top. */
function PageTransition({ children }) {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-md mx-auto my-20 p-8 text-center">
      <h1 className="text-8xl font-black text-marquee-300 mb-2">404</h1>
      <p className="text-lg font-bold text-white mb-2">This show isn't playing</p>
      <p className="text-sm text-slate-400 mb-6">The page you were looking for doesn't exist.</p>
      <a
        href="/"
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition"
      >
        Back to home
      </a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-16 md:pb-0">
          <Navbar />
          <main className="flex-1">
            <PageTransition>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/events" element={<EventsList />} />
              <Route path="/events/:id" element={<EventDetails />} />
              <Route
                path="/my-tickets"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <MyTickets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organiser"
                element={
                  <ProtectedRoute allowedRoles={['organiser', 'admin']}>
                    <OrganiserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PageTransition>
          </main>
          <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
            TicketX &copy; 2026. Concert and cinema tickets.
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
