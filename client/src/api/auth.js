import api from './axios';

export const registerUser = async (userData) => {
  const response = await api.post('/api/auth/register', userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const getAdminUsers = async (role) => {
  const response = await api.get('/api/admin/users', {
    params: role ? { role } : {},
  });
  return response.data;
};

export const toggleBlockUser = async (userId, isBlocked) => {
  const response = await api.patch(`/api/admin/users/${userId}/block`, { isBlocked });
  return response.data;
};

export const getAdminStats = async () => {
  const response = await api.get('/api/admin/stats');
  return response.data;
};
