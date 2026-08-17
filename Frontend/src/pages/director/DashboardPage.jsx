import React from 'react';
import { BarChart3, Users, TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';

/**
 * Dashboard Giám đốc — placeholder.
 * Nội dung đầy đủ sẽ triển khai ở Bước 7 (Dashboard tổng hợp).
 */
export default function DirectorDashboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text">Tổng quan — Giám đốc</h1>
        <p className="text-xs text-muted mt-0.5">Thống kê toàn công ty</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng nhân viên', value: '—', icon: Users, color: 'text-primary' },
          { label: 'Ứng viên đang xử lý', value: '—', icon: BarChart3, color: 'text-warning' },
          { label: 'Tỉ lệ chấm công', value: '—', icon: TrendingUp, color: 'text-success' },
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
        <CardHeader title="Thông báo" subtitle="Dashboard đầy đủ sẽ triển khai ở Bước 7" />
        <div className="flex items-center justify-center h-32 text-muted text-sm">
          Nội dung đang phát triển...
        </div>
      </Card>
    </div>
  );
}
