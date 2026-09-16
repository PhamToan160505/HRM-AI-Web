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
import CeoDashboardPage from './pages/ceo/CeoDashboardPage';
import DirectorDashboardPage from './pages/director/DashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import DepartmentManagementPage from './pages/admin/DepartmentManagementPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import ManagerDashboardPage from './pages/manager/DashboardPage';
import DirectorRecruitmentPage from './pages/director/DirectorRecruitmentPage';
import DirectorMyAttendancePage from './pages/manager/DirectorMyAttendancePage';
import RecruitmentLayout from './pages/manager/recruitment/RecruitmentLayout';
import JobPostingList from './pages/manager/recruitment/JobPostingList';
import JobPostingForm from './pages/manager/recruitment/JobPostingForm';
import ApplicationListPage from './pages/manager/recruitment/ApplicationListPage';
import ApplicationDetailPage from './pages/manager/recruitment/ApplicationDetailPage';
import JobRequisitionPage from './pages/manager/recruitment/JobRequisitionPage';
import JobRequisitionForm from './pages/manager/recruitment/JobRequisitionForm';
import ApplicationPipeline from './pages/manager/recruitment/ApplicationPipeline';
import EmployeeDashboardPage from './pages/employee/DashboardPage';
import EmployeeListPage from './pages/manager/employees/EmployeeListPage';
import FaceEnrollment from './pages/employee/FaceEnrollment';
import EmployeeAttendancePage from './pages/employee/AttendancePage';
import ManagerAttendancePage from './pages/manager/AttendancePage';
import HolidayPage from './pages/manager/payroll/HolidayPage';
import PayrollPage from './pages/manager/payroll/PayrollPage';
import GroupChatPage from './pages/chat/GroupChatPage';
import PayrollViewPage from './pages/manager/payroll/PayrollViewPage';
import ProfilePage from './pages/common/ProfilePage';
import MyRequestsPage from './pages/employee/MyRequestsPage';
import ManagerRequestsPage from './pages/manager/ManagerRequestsPage';

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

          {/* ── Admin ───────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="departments" element={<DepartmentManagementPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="settings" element={<SystemSettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="chat" element={<GroupChatPage />} />
          </Route>

          {/* ── CEO ──────────────────────────────────── */}
          <Route
            path="/ceo"
            element={
              <RequireRole roles={['ceo']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CeoDashboardPage />} />
            <Route path="employees" element={<EmployeeListPage />} />
            <Route path="recruitment" element={<RecruitmentLayout />}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="requisitions" element={<JobRequisitionPage />} />
              <Route path="requisitions/new" element={<JobRequisitionForm />} />
              <Route path="campaigns" element={<JobPostingList />} />
              <Route path="campaigns/new" element={<JobPostingForm />} />
              <Route path="campaigns/edit/:id" element={<JobPostingForm />} />
              <Route path="applications" element={<ApplicationListPage />} />
              <Route path="pipeline" element={<ApplicationPipeline />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
            </Route>
            <Route path="attendance" element={<ManagerAttendancePage />} />
            <Route path="my-attendance" element={<EmployeeAttendancePage />} />
            <Route path="requests" element={<ManagerRequestsPage />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="holidays" element={<HolidayPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="chat" element={<GroupChatPage />} />
            <Route path="face-enroll" element={
                <div className="p-8">
                    <FaceEnrollment />
                </div>
            } />
          </Route>

          {/* ── Giám đốc phòng ban ──────────────────────────────────── */}
          <Route
            path="/director"
            element={
              <RequireRole roles={['giam_doc_phong_ban']}>
                <AppLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DirectorDashboardPage />} />
            <Route path="employees" element={<EmployeeListPage />} />
            <Route path="recruitment" element={<RecruitmentLayout />}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="requisitions" element={<JobRequisitionPage />} />
              <Route path="requisitions/new" element={<JobRequisitionForm />} />
              <Route path="campaigns" element={<JobPostingList />} />
              <Route path="campaigns/new" element={<JobPostingForm />} />
              <Route path="campaigns/edit/:id" element={<JobPostingForm />} />
              <Route path="applications" element={<ApplicationListPage />} />
              <Route path="pipeline" element={<ApplicationPipeline />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
            </Route>
            <Route path="attendance" element={<ManagerAttendancePage />} />
            <Route path="my-attendance" element={<DirectorMyAttendancePage />} />
            <Route path="requests" element={<ManagerRequestsPage />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="holidays" element={<HolidayPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="chat" element={<GroupChatPage />} />
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
            <Route path="requests" element={<ManagerRequestsPage />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="chat" element={<GroupChatPage />} />
            <Route path="face-enroll" element={
                <div className="p-8">
                    <FaceEnrollment />
                </div>
            } />
            {/* Module Tuyển dụng (Bước 4) */}
            <Route path="recruitment" element={<RecruitmentLayout />}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="requisitions" element={<JobRequisitionPage />} />
              <Route path="requisitions/new" element={<JobRequisitionForm />} />
              <Route path="campaigns" element={<JobPostingList />} />
              <Route path="campaigns/new" element={<JobPostingForm />} />
              <Route path="campaigns/edit/:id" element={<JobPostingForm />} />
              <Route path="applications" element={<ApplicationListPage />} />
              <Route path="pipeline" element={<ApplicationPipeline />} />
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
            <Route path="requests" element={<MyRequestsPage />} />
            <Route path="payroll" element={<PayrollViewPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="chat" element={<GroupChatPage />} />
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
