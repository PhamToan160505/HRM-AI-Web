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
import PublicApplyForm from './pages/public/PublicApplyForm';
import DirectorDashboardPage from './pages/director/DashboardPage';
import ManagerDashboardPage from './pages/manager/DashboardPage';
import RecruitmentLayout from './pages/manager/recruitment/RecruitmentLayout';
import JobPostingList from './pages/manager/recruitment/JobPostingList';
import JobPostingForm from './pages/manager/recruitment/JobPostingForm';
import ApplicationListPage from './pages/manager/recruitment/ApplicationListPage';
import ApplicationDetailPage from './pages/manager/recruitment/ApplicationDetailPage';
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
          {/* Placeholder cho trang public apply (Bước 4) */}
          <Route path="/public/apply/:jobSlug" element={<PublicApplyForm />} />

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
            {/* Module Tuyển dụng (Bước 4) */}
            <Route path="recruitment" element={<RecruitmentLayout />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<div>Màn hình tổng quan (Đang xây dựng)</div>} />
              <Route path="campaigns" element={<JobPostingList />} />
              <Route path="campaigns/new" element={<JobPostingForm />} />
              <Route path="applications" element={<ApplicationListPage />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
              {/* Other tabs placeholders */}
              <Route path="review" element={<div>Đánh giá (Đang xây dựng)</div>} />
              <Route path="approvals" element={<div>Phê duyệt (Đang xây dựng)</div>} />
              <Route path="reports" element={<div>Báo cáo (Đang xây dựng)</div>} />
              <Route path="settings" element={<div>Thiết lập (Đang xây dựng)</div>} />
            </Route>
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
