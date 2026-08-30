import React, { useState, useEffect } from 'react';
import { requestService } from '../../services/request.service';
import Button from '../../components/common/Button';
import CreateRequestModal from '../../components/request/CreateRequestModal';
import {
  Plus, Clock, CheckCircle2, XCircle, FileText,
  Umbrella, Monitor, SunMedium, AlarmClock, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useToast } from '../../components/common/Toast';

// ─── Widget thẻ tổng hợp ────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color, bgColor }) {
  return (
    <div className={`rounded-2xl p-4 flex items-center gap-4 ${bgColor} border border-white/60 shadow-sm`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color} bg-white/60`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Thanh tiến trình phép ──────────────────────────────────────────────────
function LeaveProgressBar({ used, quota }) {
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const remaining = Math.max(0, quota - used);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Umbrella size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">Phép có lương tháng này</span>
        </div>
        <span className="text-sm font-bold text-blue-600">{used}/{quota} ngày</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-rose-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {remaining > 0
          ? `Còn lại ${remaining} ngày phép có lương — nghỉ thêm sẽ bị trừ lương`
          : '⚠️ Đã dùng hết phép có lương — nghỉ thêm sẽ bị trừ lương'}
      </p>
    </div>
  );
}

// ─── Bảng tác động lương ────────────────────────────────────────────────────
function LeaveSalaryImpact({ summary }) {
  if (!summary) return null;

  const rows = [
    {
      label: 'Nghỉ phép có lương',
      days: summary.paidLeaveUsed,
      rate: '100%',
      impact: 'Không trừ lương',
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
    },
    {
      label: 'Làm việc từ xa (WFH)',
      days: summary.wfhDays,
      rate: '70%',
      impact: summary.wfhDays > 0 ? `-${(summary.wfhDays * 0.3 * 100).toFixed(0)}% ngày công/ngày WFH` : 'Không ảnh hưởng',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      label: 'Nghỉ nửa ngày',
      days: summary.halfDayCount,
      rate: '50%',
      impact: summary.halfDayCount > 0 ? `-50% ngày công/lần` : 'Không ảnh hưởng',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
    },
    {
      label: 'Nghỉ không lương',
      days: summary.unpaidDays,
      rate: '0%',
      impact: summary.unpaidDays > 0 ? `Trừ ${summary.unpaidDays} ngày công` : 'Không ảnh hưởng',
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-50',
    },
    {
      label: 'Làm thêm giờ',
      days: summary.overtimeDays,
      rate: '150%',
      impact: summary.overtimeDays > 0 ? `+${(summary.overtimeDays * 1.5 * 100).toFixed(0)}% ngày công/ngày OT` : 'Không ảnh hưởng',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-700">Tác động đến lương tháng {summary.month}/{summary.year}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center px-5 py-3 gap-4">
            <span className="text-sm text-slate-600 flex-1">{row.label}</span>
            <span className={`text-sm font-bold w-16 text-center py-0.5 px-2 rounded-full ${row.bgClass} ${row.colorClass}`}>
              {row.days} ngày
            </span>
            <span className="text-xs text-slate-400 w-12 text-center">{row.rate} lương</span>
            <span className={`text-xs font-medium flex-1 text-right ${row.colorClass}`}>{row.impact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const calculateFrontendSummary = (reqList, backendSummary, selectedMonth, selectedYear) => {
  let normalLeaveDays = 0;
  let wfhDays = 0;
  let halfDayCount = 0;
  let unpaidDays = 0;
  let overtimeDays = 0;

  reqList.filter(r => r.status === 'APPROVED').forEach(req => {
    let count = 0;
    let d = new Date(req.startDate);
    let e = new Date(req.endDate);
    d.setHours(0,0,0,0);
    e.setHours(0,0,0,0);

    while (d <= e) {
      if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
        if (req.requestType === 'OVERTIME' || (d.getDay() !== 0 && d.getDay() !== 6)) {
          count++;
        }
      }
      d.setDate(d.getDate() + 1);
    }

    switch (req.requestType) {
      case 'NORMAL_LEAVE': normalLeaveDays += count; break;
      case 'SPECIAL_WFH_LEAVE': wfhDays += count; break;
      case 'HALF_DAY_LEAVE': halfDayCount += count; break;
      case 'UNPAID_LEAVE': unpaidDays += count; break;
      case 'OVERTIME': overtimeDays += count; break;
    }
  });

  const quota = backendSummary?.paidLeaveQuota || 1;
  const usedPaidLeave = Math.min(normalLeaveDays, quota);
  const extraUnpaidFromLeave = Math.max(0, normalLeaveDays - quota);

  return {
    ...backendSummary,
    month: selectedMonth + 1,
    year: selectedYear,
    paidLeaveUsed: usedPaidLeave,
    paidLeaveRemaining: Math.max(0, quota - usedPaidLeave),
    wfhDays,
    halfDayCount,
    unpaidDays: unpaidDays + extraUnpaidFromLeave,
    overtimeDays
  };
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function MyRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqData, summaryData] = await Promise.all([
        requestService.getMyRequests(),
        requestService.getMonthlySummary(),
      ]);
      setRequests(reqData);
      setSummary(calculateFrontendSummary(reqData, summaryData, currentDate.getMonth(), currentDate.getFullYear()));
    } catch (error) {
      toast.show('Lỗi', 'Lỗi khi tải dữ liệu đơn từ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const filteredRequests = requests.filter(req => {
      const s = new Date(req.startDate);
      const e = new Date(req.endDate);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      s.setHours(0,0,0,0);
      e.setHours(23,59,59,999);
      return s <= endOfMonth && e >= startOfMonth;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={12} /> Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600">
            <XCircle size={12} /> Từ chối
          </span>
        );
      case 'FORWARDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            <Clock size={12} /> Đã chuyển tiếp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
            <Clock size={12} /> Chờ duyệt
          </span>
        );
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'NORMAL_LEAVE': return '🌴 Nghỉ phép';
      case 'HALF_DAY_LEAVE': return '☀️ Nghỉ nửa ngày';
      case 'SPECIAL_WFH_LEAVE': return '💻 Làm việc từ xa';
      case 'UNPAID_LEAVE': return '⛔ Nghỉ không lương';
      case 'OVERTIME': return '⏰ Làm thêm giờ';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Đơn từ của tôi</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý yêu cầu nghỉ phép, WFH và làm thêm giờ</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-semibold text-slate-700 min-w-[120px] text-center">
              Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
            Tạo đơn mới
          </Button>
        </div>
      </div>

      {/* Summary grid */}
      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard
              icon={Umbrella}
              label="Phép có lương còn lại"
              value={`${summary.paidLeaveRemaining} ngày`}
              sub={`Đã dùng ${summary.paidLeaveUsed}/${summary.paidLeaveQuota}`}
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <SummaryCard
              icon={Monitor}
              label="WFH tháng này"
              value={`${summary.wfhDays} ngày`}
              sub="Hưởng 70% lương/ngày"
              color="text-violet-600"
              bgColor="bg-violet-50"
            />
            <SummaryCard
              icon={SunMedium}
              label="Nghỉ nửa ngày"
              value={`${summary.halfDayCount} ngày`}
              sub="Hưởng 50% lương/lần"
              color="text-amber-600"
              bgColor="bg-amber-50"
            />
            <SummaryCard
              icon={AlertCircle}
              label="Nghỉ không lương"
              value={`${summary.unpaidDays} ngày`}
              sub="Bị trừ toàn bộ ngày công"
              color="text-rose-600"
              bgColor="bg-rose-50"
            />
            <SummaryCard
              icon={AlarmClock}
              label="Làm thêm giờ"
              value={`${summary.overtimeDays} ngày`}
              sub="Hưởng 150% lương/ngày"
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LeaveProgressBar used={summary.paidLeaveUsed} quota={summary.paidLeaveQuota} />
            <LeaveSalaryImpact summary={summary} />
          </div>
        </>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-700">Lịch sử đơn từ trong tháng</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Loại đơn</th>
                <th className="px-5 py-3 font-medium">Lý do</th>
                <th className="px-5 py-3 font-medium">Thời gian</th>
                <th className="px-5 py-3 font-medium">Ngày tạo</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 font-medium">Ghi chú duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">Chưa có đơn từ nào trong tháng này</p>
                    <p className="text-sm mt-1">Các đơn yêu cầu của bạn sẽ hiển thị ở đây</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{getTypeLabel(req.requestType)}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {new Date(req.startDate).toLocaleDateString('vi-VN')}
                      {req.startDate !== req.endDate && ` - ${new Date(req.endDate).toLocaleDateString('vi-VN')}`}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-5 py-3">{getStatusBadge(req.status)}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs max-w-xs truncate" title={req.note}>{req.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
        }}
      />
    </div>
  );
}
