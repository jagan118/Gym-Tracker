import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gymlog_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear token and reload
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthSubmission = ['/api/auth/login', '/api/auth/register', '/api/auth/google']
      .some((path) => error.config?.url?.includes(path));
    if (error.response?.status === 401 && !isAuthSubmission && localStorage.getItem('gymlog_token')) {
      localStorage.removeItem('gymlog_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  googleAuth: (idToken) => api.post('/api/auth/google', { idToken }),
  setPassword: (password) => api.post('/api/auth/password', { password }),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
};

// ─── Workout API ──────────────────────────────────────────────

export const workoutAPI = {
  getAll: (params) => api.get('/api/workouts', { params }),
  getExercises: (params) => api.get('/api/workouts/exercises', { params }),
  getGroups: () => api.get('/api/workouts/groups'),
  getGroupExercises: (group) => api.get(`/api/workouts/groups/${encodeURIComponent(group)}`),
  getHistory: (exerciseName, params) =>
    api.get(`/api/workouts/history/${encodeURIComponent(exerciseName)}`, { params }),
  getOne: (id) => api.get(`/api/workouts/${id}`),
  create: (data) => api.post('/api/workouts', data),
  update: (id, data) => api.put(`/api/workouts/${id}`, data),
  delete: (id) => api.delete(`/api/workouts/${id}`),
};

export default api;
