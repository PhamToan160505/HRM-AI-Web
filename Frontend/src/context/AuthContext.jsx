import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * AuthContext — lưu thông tin người dùng đã đăng nhập.
 * Theo SKILL_react-frontend-patterns.md mục 4.
 *
 * Lưu: token, userId, role (1 trong 3: nhan_vien/truong_phong/giam_doc), departmentId, hoTen.
 *
 * QUAN TRỌNG: context này CHỈ dùng cho UX (ẩn/hiện menu, route guard).
 * Backend Spring Boot LUÔN kiểm tra độc lập qua @PreAuthorize — không tin frontend.
 */

const AuthContext = createContext(null);

const TOKEN_KEY = 'hrm_token';
const USER_KEY = 'hrm_user';

/**
 * Đọc user từ localStorage khi khởi động app (persist qua F5).
 */
function loadUserFromStorage() {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUserFromStorage);

  /**
   * Gọi sau khi login thành công — nhận LoginResponse từ backend.
   * @param {Object} loginResponse — { token, userId, hoTen, role, departmentId }
   */
  const login = useCallback((loginResponse) => {
    const { token, userId, hoTen, role, departmentId, teamId } = loginResponse;

    // Chuẩn hóa role về lowercase để dùng trong so sánh/route guard
    const normalizedRole = role?.toLowerCase();

    const userData = {
      userId,
      hoTen,
      role: normalizedRole,
      departmentId,
      teamId,
    };

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  const value = {
    user,
    isAuthenticated,
    login,
    logout,
    // Helpers
    role: user?.role ?? null,
    departmentId: user?.departmentId ?? null,
    teamId: user?.teamId ?? null,
    userId: user?.userId ?? null,
    hoTen: user?.hoTen ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook — dùng trong mọi component cần thông tin auth.
 * Throw nếu dùng ngoài AuthProvider để phát hiện lỗi cấu hình sớm.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  }
  return context;
}

export default AuthContext;
