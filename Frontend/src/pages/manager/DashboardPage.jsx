import React from 'react';
import { Users, ClipboardCheck } from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';

/**
 * Dashboard Trưởng phòng — placeholder.
 * Nội dung đầy đủ sẽ triển khai ở Bước 7.
 * Ghi nhớ: module Tuyển dụng KHÔNG lọc theo department_id (README mục 3).
 */
export default function ManagerDashboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text">Tổng quan — Trưởng Phòng</h1>
        <p className="text-xs text-muted mt-0.5">Quản lý tuyển dụng & phòng ban</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Hồ sơ chờ duyệt', value: '—', icon: Users, color: 'text-warning' },
          { label: 'Chấm công cần duyệt', value: '—', icon: ClipboardCheck, color: 'text-danger' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center gap-3">
              <div className={['w-9 h-9 rounded-md flex items-center justify-center bg-bg-secondary', color].join(' ')}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-lg font-bold text-text tabular">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Module Tuyển dụng" subtitle="Sẽ triển khai ở Bước 4" />
        <div className="flex items-center justify-center h-32 text-muted text-sm">
          Nội dung đang phát triển...
        </div>
      </Card>
    </div>
  );
}
