import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/common/Toast';
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
import DirectorRecruitmentPage from './pages/director/DirectorRecruitmentPage';
import RecruitmentLayout from './pages/manager/recruitment/RecruitmentLayout';
import JobPostingList from './pages/manager/recruitment/JobPostingList';
import JobPostingForm from './pages/manager/recruitment/JobPostingForm';
import ApplicationListPage from './pages/manager/recruitment/ApplicationListPage';
import ApplicationDetailPage from './pages/manager/recruitment/ApplicationDetailPage';
import EmployeeDashboardPage from './pages/employee/DashboardPage';
import EmployeeListPage from './pages/manager/employees/EmployeeListPage';
import FaceEnrollment from './pages/employee/FaceEnrollment';
import EmployeeAttendancePage from './pages/employee/AttendancePage';
import ManagerAttendancePage from './pages/manager/AttendancePage';
import HolidayPage from './pages/manager/payroll/HolidayPage';
import PayrollPage from './pages/manager/payroll/PayrollPage';
import PayrollViewPage from './pages/manager/payroll/PayrollViewPage';
import ProfilePage from './pages/common/ProfilePage';

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
        <ToastProvider>
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
            <Route path="employees" element={<EmployeeListPage />} />
            <Route path="recruitment" element={<DirectorRecruitmentPage />} />
            <Route path="recruitment/applications/:id" element={<ApplicationDetailPage />} />
            <Route path="attendance" element={<ManagerAttendancePage />} />
            <Route path="my-attendance" element={<EmployeeAttendancePage />} />
            <Route path="holidays" element={<HolidayPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="face-enroll" element={
                <div className="p-8">
                    <FaceEnrollment />
                </div>
            } />
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
            <Route path="employees" element={<EmployeeListPage />} />
            <Route path="attendance" element={<ManagerAttendancePage />} />
            <Route path="my-attendance" element={<EmployeeAttendancePage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="face-enroll" element={
                <div className="p-8">
                    <FaceEnrollment />
                </div>
            } />
            {/* Module Tuyển dụng (Bước 4) */}
            <Route path="recruitment" element={<RecruitmentLayout />}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="campaigns" element={<JobPostingList />} />
              <Route path="campaigns/new" element={<JobPostingForm />} />
              <Route path="campaigns/edit/:id" element={<JobPostingForm />} />
              <Route path="applications" element={<ApplicationListPage />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
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
            <Route path="face-enroll" element={
                <div className="p-8">
                    <FaceEnrollment />
                </div>
            } />
            <Route path="attendance" element={<EmployeeAttendancePage />} />
            <Route path="payroll" element={<PayrollViewPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
