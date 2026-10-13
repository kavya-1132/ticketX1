import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token into request headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ticketx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle unauthenticated/unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Optional: Auto logout if token is explicitly invalid/expired
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        // Only remove if it was an expired/invalid token error
        if (error.response.data?.error?.includes('token')) {
          localStorage.removeItem('ticketx_token');
          localStorage.removeItem('ticketx_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
