import api from './api';

/**
 * Auth service — gọi API đăng nhập.
 * Luồng: component → hook → service → api.js (theo SKILL_react-frontend-patterns.md mục 1)
 */

/**
 * Đăng nhập — POST /api/auth/login
 * @returns {Promise<{token, userId, hoTen, role, departmentId}>}
 */
export async function login(maNhanVien, password) {
  const response = await api.post('/api/auth/login', { maNhanVien, password });
  // Backend trả ApiResponse<LoginResponse>: { success, data, message }
  return response.data.data;
}

const authService = { login };
export default authService;
