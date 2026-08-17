import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationModal from './components/common/NotificationModal';

// Layout
import AppLayout from './components/layout/AppLayout';

// Route guard
import RequireRole from './components/common/RequireRole';

// Pages
import LoginPage from './pages/public/LoginPage';
import DirectorDashboardPage from './pages/director/DashboardPage';
import ManagerDashboardPage from './pages/manager/DashboardPage';
import EmployeeDashboardPage from './pages/employee/DashboardPage';

/**
 * App Router — cấu trúc route theo SKILL_react-frontend-patterns.md mục 1.
 *
 * Cấu trúc phân cấp:
 *   /login                → public, không auth
 *   /director/*           → RequireRole(['giam_doc']) + AppLayout
 *   /manager/*            → RequireRole(['truong_phong']) + AppLayout
 *   /employee/*           → RequireRole(['nhan_vien']) + AppLayout
 *   /public/*             → public (ứng viên — không có auth, không sidebar)
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <NotificationModal />
          <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── Public routes ─────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* Placeholder cho trang public apply (Bước 4) */}
          {/* <Route path="/public/apply/:jobSlug" element={<ApplyPage />} /> */}

          {/* ── Giám đốc ──────────────────────────────────── */}
          <Route
            path="/director"
            element={
              <RequireRole roles={['giam_doc']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DirectorDashboardPage />} />
            {/* Các route khác sẽ thêm theo từng Bước */}
          </Route>

          {/* ── Trưởng phòng ──────────────────────────────── */}
          <Route
            path="/manager"
            element={
              <RequireRole roles={['truong_phong']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboardPage />} />
            {/* Module Tuyển dụng (Bước 4): /manager/recruitment/... */}
          </Route>

          {/* ── Nhân viên ─────────────────────────────────── */}
          <Route
            path="/employee"
            element={
              <RequireRole roles={['nhan_vien']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<EmployeeDashboardPage />} />
            {/* Module Chấm công (Bước 5): /employee/attendance */}
          </Route>

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
