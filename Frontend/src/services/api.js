import axios from 'axios';

/**
 * Axios instance dùng chung — theo SKILL_react-frontend-patterns.md mục 4.
 *
 * Quy tắc bắt buộc:
 * - MỌI request HTTP của app nội bộ đều đi qua instance này
 * - publicApply.service.js là ngoại lệ duy nhất (ứng viên không có JWT)
 * - Interceptor tự động gắn JWT vào mọi request
 * - 401 response → clear token + redirect login
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor — gắn JWT ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hrm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — xử lý 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('hrm_token');
      localStorage.removeItem('hrm_user');
      // Redirect về login — không dùng React Router ở đây vì ngoài component tree
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
