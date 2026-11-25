import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/auth.service';

/**
 * Hook xử lý logic đăng nhập — "Controller" theo SKILL_react-frontend-patterns.md mục 1.
 *
 * Luồng: LoginPage → useLogin (hook) → authService → api.js
 * Component không gọi axios trực tiếp.
 */
export function useLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = useCallback(async (maNhanVien, password) => {
    setLoading(true);
    setError(null);

    try {
      const loginResponse = await authService.login(maNhanVien, password);
      const destinations = {
        admin: '/admin/dashboard',
        ceo: '/ceo/dashboard',
        giam_doc_phong_ban: '/director/dashboard',
        truong_phong: '/manager/dashboard',
        nhan_vien: '/employee/dashboard',
      };
      const destination = destinations[loginResponse.role?.toLowerCase()];
      if (!destination) {
        setError('Vai trò của tài khoản chưa được hỗ trợ. Vui lòng liên hệ quản trị viên.');
        return;
      }
      login(loginResponse);
      navigate(destination, { replace: true });
    } catch (err) {
      // Lấy message từ ApiResponse backend, fallback về generic message
      let message = err.response?.data?.message;
      if (!message && !err.response) {
        message = err.code === 'ECONNABORTED'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra cửa sổ HRM Backend và thử lại.'
          : 'Không kết nối được máy chủ. Hãy chạy start.bat và chờ cửa sổ HRM Backend báo khởi động thành công.';
      }
      if (!message) {
        message = 'Máy chủ chưa xử lý được đăng nhập. Vui lòng xem lỗi trong cửa sổ HRM Backend.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  return { handleLogin, loading, error, clearError: () => setError(null) };
}

export default useLogin;
