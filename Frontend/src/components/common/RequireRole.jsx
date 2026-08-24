import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Route guard theo role — theo SKILL_react-frontend-patterns.md mục 4.
 *
 * Nhắc lại: đây CHỈ là UX guard (ẩn route trên frontend).
 * Backend Spring Boot LUÔN kiểm tra @PreAuthorize độc lập, không tin frontend.
 *
 * Props:
 *   roles: string[] — danh sách role được phép (VD: ['truong_phong', 'giam_doc'])
 *   children: ReactNode
 *
 * Dùng:
 *   <RequireRole roles={['giam_doc']}>
 *     <DirectorDashboard />
 *   </RequireRole>
 */
export function RequireRole({ roles, children }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  // Chưa đăng nhập → redirect về login, lưu lại intended URL
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Đã đăng nhập nhưng role không đủ → redirect về trang phù hợp với role thật
  if (roles && !roles.includes(role)) {
    const redirectPath = getDefaultPathForRole(role);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

/**
 * Trả về path mặc định theo role khi người dùng cố truy cập route không thuộc quyền.
 */
function getDefaultPathForRole(role) {
  switch (role) {
    case 'ceo': return '/ceo/dashboard';
    case 'giam_doc_phong_ban': return '/director/dashboard';
    case 'truong_phong': return '/manager/dashboard';
    case 'nhan_vien': return '/employee/dashboard';
    case 'admin': return '/admin/dashboard';
    default: return '/login';
  }
}

export default RequireRole;
