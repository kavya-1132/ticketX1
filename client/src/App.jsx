import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function NotFound() {
  return (
    <div className="max-w-md mx-auto my-20 p-8 text-center">
      <h1 className="text-5xl font-black text-indigo-500 mb-2">404</h1>
      <p className="text-lg font-bold text-white mb-2">Page Not Found</p>
      <p className="text-xs text-slate-400 mb-6">The page you were looking for doesn't exist.</p>
      <a
        href="/"
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
      >
        Go Home
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
          </main>
          <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
            TicketX &copy; 2026 · Concert & cinema tickets
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
