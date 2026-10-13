import api from './axios';

// ---- Bookings / tickets (customer) ----
export const getMyBookings = async () => (await api.get('/api/bookings/my')).data;
export const getBooking = async (id) => (await api.get(`/api/bookings/${id}`)).data;
export const cancelBooking = async (id) => (await api.post(`/api/bookings/${id}/cancel`)).data;

// ---- Waitlist (customer) ----
export const getMyWaitlist = async () => (await api.get('/api/waitlist/my')).data;
export const joinWaitlist = async (eventId) => (await api.post(`/api/waitlist/${eventId}/join`)).data;
export const leaveWaitlist = async (eventId) => (await api.delete(`/api/waitlist/${eventId}`)).data;

// ---- Organiser ----
export const getOrganiserEvents = async () => (await api.get('/api/organiser/events')).data;
export const getOrganiserEventBookings = async (eventId) =>
  (await api.get(`/api/organiser/events/${eventId}/bookings`)).data;
export const verifyTicket = async (qrToken) => (await api.post('/api/tickets/verify', { qrToken })).data;
