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

  const handleLogin = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const loginResponse = await authService.login(email, password);
      login(loginResponse);

      // Redirect theo role
      const role = loginResponse.role?.toLowerCase();
      if (role === 'giam_doc') {
        navigate('/director/dashboard', { replace: true });
      } else if (role === 'truong_phong') {
        navigate('/manager/dashboard', { replace: true });
      } else {
        navigate('/employee/dashboard', { replace: true });
      }
    } catch (err) {
      // Lấy message từ ApiResponse backend, fallback về generic message
      const message =
        err.response?.data?.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra kết nối.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  return { handleLogin, loading, error, clearError: () => setError(null) };
}

export default useLogin;
