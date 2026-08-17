import React from 'react';
import { ClipboardCheck, Banknote } from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';

/**
 * Dashboard Nhân viên — placeholder.
 * Nội dung: chấm công (Bước 5) + phiếu lương (Bước 6).
 */
export default function EmployeeDashboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text">Tổng quan — Nhân Viên</h1>
        <p className="text-xs text-muted mt-0.5">Chấm công và phiếu lương của bạn</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Ngày công tháng này', value: '—', icon: ClipboardCheck, color: 'text-primary' },
          { label: 'Lương tháng này', value: '—', icon: Banknote, color: 'text-success' },
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
        <CardHeader title="Chấm công AI" subtitle="Sẽ triển khai ở Bước 5" />
        <div className="flex items-center justify-center h-32 text-muted text-sm">
          Nội dung đang phát triển...
        </div>
      </Card>
    </div>
  );
}
