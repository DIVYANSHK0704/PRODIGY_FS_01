import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => refreshSubscribers.push(cb);
const onRefreshed    = (token) => { refreshSubscribers.forEach((cb) => cb(token)); refreshSubscribers = []; };
const onRefreshFailed = ()     => { refreshSubscribers.forEach((cb) => cb(null));  refreshSubscribers = []; };

const forceLogout = () => {
  sessionStorage.removeItem('accessToken');
  window.dispatchEvent(new Event('auth:logout'));
  // FIX #4: use React Router navigation instead of full reload
  // We dispatch a custom event; AuthContext/Router listens and calls navigate()
  window.dispatchEvent(new CustomEvent('auth:redirect', { detail: { to: '/login' } }));
};

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const code = err.response?.data?.code;

    if (err.response?.status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (!newToken) return reject(err);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(API(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = data.token;
        sessionStorage.setItem('accessToken', newToken);
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return API(originalRequest);
      } catch {
        onRefreshFailed();
        forceLogout(); // FIX #4: no full page reload
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (err.response?.status === 401 && !originalRequest._retry) {
      forceLogout(); // FIX #4
    }

    return Promise.reject(err);
  }
);

export const authAPI = {
  register:  (data) => API.post('/auth/register', data),
  login:     (data) => API.post('/auth/login', data),
  refresh:   ()     => API.post('/auth/refresh'),
  getMe:     ()     => API.get('/auth/me'),
  logout:    ()     => API.post('/auth/logout'),
};

export const userAPI = {
  getDashboard:  (config={})     => API.get('/user/dashboard', config),
  getAdmin:      (page = 1, limit = 20, config={}) => API.get(`/user/admin?page=${page}&limit=${limit}`, config),
  updateProfile: (data) => API.put('/user/profile', data),
};

export default API;
