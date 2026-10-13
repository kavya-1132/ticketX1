import api from './axios';

export const getEvents = async (params = {}) => {
  const response = await api.get('/api/events', { params });
  return response.data;
};

export const getEventById = async (id) => {
  const response = await api.get(`/api/events/${id}`);
  return response.data;
};

export const getEventSeats = async (id) => {
  const response = await api.get(`/api/events/${id}/seats`);
  return response.data;
};

export const createEvent = async (eventData) => {
  const response = await api.post('/api/events', eventData);
  return response.data;
};

export const getVenues = async () => {
  const response = await api.get('/api/venues');
  return response.data;
};

export const createVenue = async (venueData) => {
  const response = await api.post('/api/venues', venueData);
  return response.data;
};

export const holdSeat = async (seatId, eventId) => {
  const response = await api.post(`/api/seats/${seatId}/hold`, { eventId });
  return response.data;
};

export const releaseSeat = async (seatId, eventId) => {
  const response = await api.post(`/api/seats/${seatId}/release`, { eventId });
  return response.data;
};

export const confirmBooking = async ({ eventId, seatIds }) => {
  const response = await api.post('/api/bookings/confirm', { eventId, seatIds });
  return response.data;
};

export const getMyBookings = async () => {
  const response = await api.get('/api/bookings/my');
  return response.data;
};
