import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  FileSpreadsheet,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Lock,
  ExternalLink,
  X,
  Loader2,
  Briefcase,
  CreditCard,
  Edit3,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import useRealtimeSync from '../../hooks/useRealtimeSync';
import { isFinanceDepartment } from '../../utils/payrollStatus';
import {
  formatCurrencyVND,
  formatDateTimeVN,
  formatMonthVN,
  formatVndInput,
  parseVndInput,
} from '../tech/techHelpers';

const COST_STATUS_META = {
  SUBMITTED: { label: 'Chờ Tài chính xác nhận', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  CONFIRMED: { label: 'Đã xác nhận hạch toán', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  DISPUTED: { label: 'Yêu cầu giải trình', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
};

const COMP_STATUS_META = {
  PENDING_FINANCE_APPLY: { label: 'Chờ Tài chính áp dụng', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPLIED: { label: 'Đã đồng bộ hồ sơ lương', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const CERT_STATUS_META = {
  SUBMITTED: { label: 'Chờ Công nghệ xác thực', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  TECH_APPROVED: { label: 'Chờ Tài chính duyệt chi', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  FINANCE_APPROVED: { label: 'Đã duyệt chi — Chờ thanh toán', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  DISBURSED: { label: 'Đã chi trả', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Từ chối', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
};

export default function FinanceTechHubPage() {
  const { user, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isCeoOrAdmin = role === 'ceo' || role === 'admin';
  const isFinance = isFinanceDepartment(user?.tenPhong);
  const isFinanceChief = isFinance && (role === 'truong_phong' || role === 'giam_doc_phong_ban');
  const isTechManager = (role === 'truong_phong' || role === 'giam_doc_phong_ban')
    && (user?.tenPhong?.toLowerCase().includes('công nghệ') || user?.tenPhong?.toLowerCase().includes('kỹ thuật'));

  const [activeTab, setActiveTab] = useState('costing'); // costing | compensation | certificates
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [costReports, setCostReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [compSyncs, setCompSyncs] = useState([]);
  const [certReimbs, setCertReimbs] = useState([]);
  const [busyId, setBusyId] = useState(null);

  // Modals
  const [reviewReportModal, setReviewReportModal] = useState(null); // { report, decision }
  const [voucherNo, setVoucherNo] = useState('');
  const [financeNote, setFinanceNote] = useState('');

  const [budgetModal, setBudgetModal] = useState(null); // { projectId, projectCode, projectName, currentBudget }
  const [budgetStr, setBudgetStr] = useState('');

  const [applyCompModal, setApplyCompModal] = useState(null);
  const [applyCompNote, setApplyCompNote] = useState('');

  const [certDecisionModal, setCertDecisionModal] = useState(null); // { item, mode: 'finance_approve' | 'finance_reject' | 'disburse' }
  const [approvedAmtStr, setApprovedAmtStr] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('BANK_TRANSFER');
  const [payoutMonth, setPayoutMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [paymentRef, setPaymentRef] = useState('');
  const [certModalNote, setCertModalNote] = useState('');

  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [ovRes, costRes, compRes, certRes] = await Promise.all([
        api.get('/api/tech-finance/overview').catch(() => ({ data: { data: null } })),
        api.get('/api/tech-finance/cost-reports').catch(() => ({ data: { data: [] } })),
        api.get('/api/tech-finance/compensation-syncs').catch(() => ({ data: { data: [] } })),
        api.get('/api/tech-finance/cert-reimbursements').catch(() => ({ data: { data: [] } })),
      ]);
      setOverview(ovRes.data?.data || null);
      const reports = costRes.data?.data || [];
      setCostReports(reports);
      setSelectedReportId((prev) => prev || (reports[0]?.id ?? null));
      setCompSyncs(compRes.data?.data || []);
      setCertReimbs(certRes.data?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useRealtimeSync(() => loadAll(true), {
    events: ['hrm:tech-sync', 'hrm:recruitment-sync', 'hrm:notification'],
    paused: Boolean(reviewReportModal || budgetModal || applyCompModal || certDecisionModal),
  });

  const selectedReport = costReports.find((r) => r.id === selectedReportId) || costReports[0] || null;

  const requisitionsPath = role === 'ceo'
    ? '/ceo/recruitment/requisitions'
    : role === 'giam_doc_phong_ban'
      ? '/director/recruitment/requisitions'
      : '/manager/recruitment/requisitions';

  const handleExportExcel = async (report) => {
    try {
      setBusyId(`excel-${report.id}`);
      const res = await api.get(`/api/tech-finance/cost-reports/${report.id}/export-excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `HachToan_DuAn_CongNghe_${report.reportMonth}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast?.show('Xuất Excel thành công', `Đã tải bảng hạch toán dự án ${formatMonthVN(report.reportMonth)}.`, 'success');
    } catch (err) {
      toast?.show('Lỗi xuất Excel', err.response?.data?.message || 'Không thể tải file Excel', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitCostReview = async (e) => {
    e.preventDefault();
    if (!reviewReportModal) return;
    if (reviewReportModal.decision === 'DISPUTED' && financeNote.trim().length < 5) {
      toast?.show('Thiếu lý do', 'Vui lòng nhập lý do yêu cầu giải trình (ít nhất 5 ký tự).', 'error');
      return;
    }
    try {
      setBusyId('review-cost');
      await api.put(`/api/tech-finance/cost-reports/${reviewReportModal.report.id}/review`, {
        decision: reviewReportModal.decision,
        accountingVoucherNo: voucherNo.trim() || null,
        financeNote: financeNote.trim() || null,
      });
      toast?.show(
        'Đã cập nhật',
        reviewReportModal.decision === 'CONFIRMED'
          ? 'Đã xác nhận hạch toán giá vốn dự án thành công.'
          : 'Đã gửi yêu cầu giải trình về Phòng Công nghệ.',
        'success'
      );
      setReviewReportModal(null);
      setVoucherNo('');
      setFinanceNote('');
      await loadAll(true);
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xử lý bảng đối soát', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveProjectBudget = async (e) => {
    e.preventDefault();
    const val = parseVndInput(budgetStr);
    if (val === null || val < 0) {
      toast?.show('Số tiền chưa hợp lệ', 'Vui lòng nhập ngân sách dự án hợp lệ (>= 0 VNĐ).', 'error');
      return;
    }
    try {
      setBusyId('save-budget');
      await api.put(`/api/tech-finance/projects/${budgetModal.projectId}/budget`, {
        budgetAmount: val,
      });
      toast?.show('Đã lưu ngân sách', `Đã cập nhật ngân sách dự án ${budgetModal.projectCode}.`, 'success');
      setBudgetModal(null);
      setBudgetStr('');
      await loadAll(true);
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật ngân sách dự án', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyCompSync = async (e) => {
    e.preventDefault();
    if (!applyCompModal) return;
    try {
      setBusyId(`apply-${applyCompModal.id}`);
      await api.post(`/api/tech-finance/compensation-syncs/${applyCompModal.id}/apply`, {
        financeNote: applyCompNote.trim() || null,
      });
      toast?.show(
        'Đồng bộ lương thành công',
        `Đã cập nhật mức lương/phụ cấp mới cho ${applyCompModal.employeeName} (kỳ ${formatMonthVN(applyCompModal.effectiveMonth)}).`,
        'success'
      );
      setApplyCompModal(null);
      setApplyCompNote('');
      await loadAll(true);
    } catch (err) {
      toast?.show('Không thể áp dụng', err.response?.data?.message || 'Đã có lỗi xảy ra', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCertModalSubmit = async (e) => {
    e.preventDefault();
    if (!certDecisionModal) return;
    const { item, mode } = certDecisionModal;

    try {
      setBusyId(`cert-${item.id}`);
      if (mode === 'finance_approve') {
        const amt = parseVndInput(approvedAmtStr);
        if (!amt || amt <= 0) {
          toast?.show('Thiếu số tiền', 'Vui lòng nhập số tiền duyệt chi hợp lệ.', 'error');
          setBusyId(null);
          return;
        }
        await api.put(`/api/tech-finance/cert-reimbursements/${item.id}/finance-decision`, {
          decision: 'APPROVED',
          approvedAmountVnd: amt,
          payoutMethod,
          payoutPayrollMonth: payoutMethod === 'NEXT_PAYROLL' ? payoutMonth : null,
          financeNote: certModalNote.trim() || null,
        });
        toast?.show('Đã duyệt chi', `Đã phê duyệt hoàn ứng cho ${item.employeeName}.`, 'success');
      } else if (mode === 'finance_reject') {
        if (certModalNote.trim().length < 5) {
          toast?.show('Thiếu lý do', 'Vui lòng nhập lý do từ chối (ít nhất 5 ký tự).', 'error');
          setBusyId(null);
          return;
        }
        await api.put(`/api/tech-finance/cert-reimbursements/${item.id}/finance-decision`, {
          decision: 'REJECTED',
          financeNote: certModalNote.trim(),
        });
        toast?.show('Đã từ chối', `Đã từ chối đề xuất hoàn ứng của ${item.employeeName}.`, 'success');
      } else if (mode === 'disburse') {
        if (paymentRef.trim().length < 3) {
          toast?.show('Thiếu mã chứng từ', 'Vui lòng nhập Mã chứng từ / giao dịch chi trả (>= 3 ký tự).', 'error');
          setBusyId(null);
          return;
        }
        await api.put(`/api/tech-finance/cert-reimbursements/${item.id}/disburse`, {
          paymentReference: paymentRef.trim(),
          financeNote: certModalNote.trim() || null,
        });
        toast?.show('Đã xác nhận chi trả', `Đã ghi nhận thanh toán (Mã CT: ${paymentRef.trim()}).`, 'success');
      }
      setCertDecisionModal(null);
      setCertModalNote('');
      setPaymentRef('');
      await loadAll(true);
    } catch (err) {
      toast?.show('Lỗi xử lý', err.response?.data?.message || 'Không thể thực hiện thao tác', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F2557] via-[#1E3A8A] to-[#1D4ED8] rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-blue-100">
              <Landmark size={12} />
              <span>Liên kết Phòng Tài chính - Kế toán ↔ Phòng Công nghệ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Tài chính ↔ Công nghệ
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/85">
              Hạch toán giá vốn dự án (Billable / Internal), đồng bộ quyết định tăng lương theo khóa kỳ lương và duyệt chi chứng chỉ quốc tế.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(isFinanceChief || isCeoOrAdmin) && (
              <button
                type="button"
                onClick={() => navigate(requisitionsPath)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition cursor-pointer"
              >
                <Briefcase size={14} />
                <span>Thẩm định Ngân sách Tuyển dụng ({overview?.pendingBudgetRequisitionsCount ?? 0})</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => loadAll()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#0F2557] hover:bg-blue-50 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-blue-100/80 block">Tuyển dụng chờ duyệt ngân sách</span>
            <p className="text-2xl font-extrabold mt-0.5 tabular-nums">{overview?.pendingBudgetRequisitionsCount ?? 0}</p>
            <span className="text-[10px] text-blue-200/80">Bước 2/3 trong quy trình duyệt</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-blue-100/80 block">Bảng giá vốn dự án chờ duyệt</span>
            <p className="text-2xl font-extrabold mt-0.5 tabular-nums">{overview?.submittedCostReportsCount ?? 0}</p>
            <span className="text-[10px] text-blue-200/80">Đã xác nhận: {overview?.confirmedCostReportsCount ?? 0} kỳ</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-blue-100/80 block">Tăng lương chờ đồng bộ kỳ lương</span>
            <p className="text-2xl font-extrabold mt-0.5 tabular-nums">{overview?.pendingCompensationSyncsCount ?? 0}</p>
            <span className="text-[10px] text-blue-200/80">An toàn theo khóa kỳ lương</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-blue-100/80 block">Chứng chỉ chờ duyệt / chi trả</span>
            <p className="text-2xl font-extrabold mt-0.5 tabular-nums">
              {(overview?.pendingCertReimbursementsCount ?? 0) + (overview?.approvedCertAwaitingDisbursementCount ?? 0)}
            </p>
            <span className="text-[10px] text-blue-200/80">
              Đã chi: {formatCurrencyVND(overview?.totalDisbursedCertVnd ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 flex items-center gap-2 overflow-x-auto">
          {[
            {
              key: 'costing',
              label: '1. Hạch toán Dự án (Billable / Giá vốn)',
              icon: FileSpreadsheet,
              badge: overview?.submittedCostReportsCount || 0,
            },
            {
              key: 'compensation',
              label: '2. Đồng bộ Tăng lương & Phụ cấp',
              icon: TrendingUp,
              badge: overview?.pendingCompensationSyncsCount || 0,
            },
            {
              key: 'certificates',
              label: '3. Hoàn ứng Chứng chỉ Quốc tế',
              icon: Award,
              badge: (overview?.pendingCertReimbursementsCount || 0) + (overview?.approvedCertAwaitingDisbursementCount || 0),
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#1E3A8A] text-[#0F2557] bg-blue-50/50 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-100 text-amber-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <span>Đang tải dữ liệu liên kết Tài chính – Công nghệ...</span>
            </div>
          ) : activeTab === 'costing' ? (
            /* ── TAB 1: PROJECT COSTING ─────────────────────────────────── */
            <div className="space-y-5">
              {costReports.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                  <FileSpreadsheet size={34} className="mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Chưa có bảng đối soát giờ công dự án nào được gửi</p>
                  <p className="text-xs text-slate-500">
                    Trưởng phòng / Giám đốc Công nghệ chốt gửi bảng đối soát hàng tháng từ tab <strong>Chấm công &amp; Giờ công</strong>.
                  </p>
                </div>
              ) : (
                <>
                  {/* Month selector cards */}
                  <div className="flex flex-wrap gap-2">
                    {costReports.map((r) => {
                      const st = COST_STATUS_META[r.status] || COST_STATUS_META.SUBMITTED;
                      const isSelected = selectedReport?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedReportId(r.id)}
                          className={`px-3.5 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-[#1E3A8A] ring-1 ring-[#1E3A8A]'
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-900">{formatMonthVN(r.reportMonth)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.badge}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                            {r.totalApprovedHours}h ({r.totalManDays} MD)
                            {r.costVisible && r.totalLaborCost != null ? ` • ${formatCurrencyVND(r.totalLaborCost)}` : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedReport && (
                    <div className="space-y-4">
                      {/* Summary Header */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Bảng Đối soát Giá vốn Dự án — {formatMonthVN(selectedReport.reportMonth)}
                            </h3>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${COST_STATUS_META[selectedReport.status]?.badge}`}>
                              {COST_STATUS_META[selectedReport.status]?.label || selectedReport.status}
                            </span>
                            {selectedReport.accountingVoucherNo && (
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                                CT: {selectedReport.accountingVoucherNo}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            Gửi bởi <strong>{selectedReport.submittedByName}</strong> lúc {formatDateTimeVN(selectedReport.submittedAt)}
                            {selectedReport.pendingWorklogsAtSubmit > 0 && (
                              <span className="ml-2 text-amber-700 font-semibold">
                                (⚠ còn {selectedReport.pendingWorklogsAtSubmit} worklog chờ duyệt tại thời điểm chốt)
                              </span>
                            )}
                          </p>
                          {selectedReport.submitNote && (
                            <p className="text-xs text-slate-600 italic">Ghi chú Tech: &ldquo;{selectedReport.submitNote}&rdquo;</p>
                          )}
                          {selectedReport.financeNote && (
                            <p className="text-xs text-blue-900 font-medium">
                              Phản hồi Tài chính ({selectedReport.reviewedByName}): {selectedReport.financeNote}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busyId === `excel-${selectedReport.id}`}
                            onClick={() => handleExportExcel(selectedReport)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer"
                          >
                            <FileSpreadsheet size={14} />
                            <span>Xuất Excel Hạch toán</span>
                          </button>
                          {isFinanceChief && selectedReport.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewReportModal({ report: selectedReport, decision: 'CONFIRMED' });
                                  setVoucherNo('');
                                  setFinanceNote('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                              >
                                <CheckCircle2 size={14} />
                                <span>Xác nhận Hạch toán</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewReportModal({ report: selectedReport, decision: 'DISPUTED' });
                                  setVoucherNo('');
                                  setFinanceNote('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                              >
                                <XCircle size={14} />
                                <span>Yêu cầu giải trình</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Cross-check KPI bar */}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Tổng giờ duyệt / Man-days</span>
                          <p className="text-base font-extrabold text-[#0F2557] mt-0.5">
                            {selectedReport.totalApprovedHours}h <span className="text-xs font-semibold text-slate-500">/ {selectedReport.totalManDays} MD</span>
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Billable / Internal</span>
                          <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                            {selectedReport.billableRatioPercent}% Billable
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {selectedReport.totalBillableHours}h tính phí · {selectedReport.totalInternalHours}h nội bộ
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Chi phí Nhân công Dự án</span>
                          <p className="text-base font-extrabold text-slate-900 mt-0.5">
                            {selectedReport.costVisible ? formatCurrencyVND(selectedReport.totalLaborCost) : 'Bảo mật B-10'}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Trạng thái Kỳ lương Phòng CN</span>
                          <p className="text-xs font-bold text-blue-800 mt-1">
                            {selectedReport.payrollBatchStatus || 'Chưa chốt công tháng này'}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Tổng lương thực nhận kỳ này</span>
                          <p className="text-base font-extrabold text-indigo-800 mt-0.5">
                            {selectedReport.costVisible && selectedReport.payrollTotalNetSalary != null
                              ? formatCurrencyVND(selectedReport.payrollTotalNetSalary)
                              : 'Chưa tính lương'}
                          </p>
                        </div>
                      </div>

                      {/* Project Cost Table */}
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                              <th className="py-3 px-4">Dự án</th>
                              <th className="py-3 px-3 text-right">Giờ duyệt</th>
                              <th className="py-3 px-3 text-right">Billable / Internal</th>
                              <th className="py-3 px-3 text-right">Man-days / FTE</th>
                              {selectedReport.costVisible && (
                                <>
                                  <th className="py-3 px-3 text-right">Chi phí Nhân công</th>
                                  <th className="py-3 px-3 text-right">Ngân sách Dự án</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums">
                            {(selectedReport.projectBreakdowns || []).map((p) => {
                              const overBudget = (p.budgetUtilizationPercent || 0) > 100;
                              const warnBudget = (p.budgetUtilizationPercent || 0) >= 80 && !overBudget;
                              return (
                                <tr key={p.projectId} className="hover:bg-slate-50/70">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200">
                                        {p.projectCode}
                                      </span>
                                      <span className="font-bold text-slate-900">{p.projectName}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">Loại: {p.projectType}</span>
                                  </td>
                                  <td className="py-3 px-3 text-right font-bold text-slate-900">{p.approvedHours}h</td>
                                  <td className="py-3 px-3 text-right">
                                    <span className="text-emerald-700 font-semibold">{p.billableHours}h</span>
                                    <span className="text-slate-400"> / {p.internalHours}h</span>
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <span className="font-bold text-slate-800">{p.manDays} MD</span>
                                    <span className="text-slate-400 block text-[10px]">{p.fte} FTE</span>
                                  </td>
                                  {selectedReport.costVisible && (
                                    <>
                                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                                        {formatCurrencyVND(p.estimatedLaborCost)}
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        <div className="inline-flex items-center gap-1.5 justify-end">
                                          <div>
                                            <span className="font-semibold text-slate-700 block">
                                              {p.projectBudgetAmount != null ? formatCurrencyVND(p.projectBudgetAmount) : 'Chưa đặt'}
                                            </span>
                                            {p.budgetUtilizationPercent != null && (
                                              <span
                                                className={`text-[10px] font-bold ${
                                                  overBudget ? 'text-rose-600' : warnBudget ? 'text-amber-600' : 'text-emerald-600'
                                                }`}
                                              >
                                                {p.budgetUtilizationPercent}% ngân sách
                                              </span>
                                            )}
                                          </div>
                                          {(isFinance || isCeoOrAdmin) && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setBudgetModal({
                                                  projectId: p.projectId,
                                                  projectCode: p.projectCode,
                                                  projectName: p.projectName,
                                                });
                                                setBudgetStr(p.projectBudgetAmount != null ? formatVndInput(Number(p.projectBudgetAmount)) : '');
                                              }}
                                              className="p-1 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                                              title="Cập nhật ngân sách dự án"
                                            >
                                              <Edit3 size={13} />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : activeTab === 'compensation' ? (
            /* ── TAB 2: COMPENSATION SYNC ───────────────────────────────── */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
                <Lock size={15} className="text-[#1E3A8A] shrink-0 mt-0.5" />
                <div>
                  <strong>Cơ chế đồng bộ an toàn theo khóa kỳ lương:</strong> Mọi quyết định tăng lương/phụ cấp của CEO từ Đánh giá Kỹ sư đều gắn <strong>Kỳ lương hiệu lực (YYYY-MM)</strong>. Nếu kỳ tháng cũ đang khóa hoặc quyết định hẹn sang tháng kế tiếp, lương mới sẽ chờ Phòng Tài chính xác nhận áp dụng đúng kỳ mà không ghi đè làm lệch bảng lương cũ.
                </div>
              </div>

              {compSyncs.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                  <TrendingUp size={34} className="mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Chưa có quyết định tăng lương/phụ cấp nào cần đồng bộ</p>
                  <p className="text-xs text-slate-500">
                    Khi CEO phê duyệt tăng lương / phụ cấp trong Đánh giá Kỹ sư, bản ghi đồng bộ sẽ tự động xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {compSyncs.map((s) => {
                    const st = COMP_STATUS_META[s.status] || COMP_STATUS_META.PENDING_FINANCE_APPLY;
                    return (
                      <div key={s.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{s.employeeName}</span>
                              {s.employeeCode && (
                                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s.employeeCode}</span>
                              )}
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.badge}`}>
                                {st.label}
                              </span>
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200">
                                Kỳ hiệu lực: {formatMonthVN(s.effectiveMonth)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              CEO phê duyệt: <strong>{s.approvedByCeoName}</strong> ({formatDateTimeVN(s.approvedAt)})
                              {s.newTitle && s.newTitle !== s.oldTitle ? ` • Chức danh mới: ${s.newTitle}` : ''}
                            </p>
                          </div>

                          {s.status === 'PENDING_FINANCE_APPLY' && (isFinance || isCeoOrAdmin) && (
                            <button
                              type="button"
                              disabled={s.effectivePeriodLockedForSubmit}
                              onClick={() => {
                                setApplyCompModal(s);
                                setApplyCompNote('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                              title={
                                s.effectivePeriodLockedForSubmit
                                  ? `Kỳ lương ${formatMonthVN(s.effectiveMonth)} đã gửi duyệt / chi trả (${s.effectivePeriodPayrollStatus})`
                                  : 'Cập nhật mức lương/phụ cấp mới vào hồ sơ lương để tính lương kỳ này'
                              }
                            >
                              <CheckCircle2 size={14} />
                              <span>Xác nhận áp dụng vào Hồ sơ Lương</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80 tabular-nums">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Lương cơ bản</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-600">{formatCurrencyVND(s.oldBaseSalary)}</span>
                              <ArrowRight size={13} className="text-emerald-600" />
                              <strong className="text-emerald-700">{formatCurrencyVND(s.newBaseSalary)}</strong>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Phụ cấp</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-600">{formatCurrencyVND(s.oldAllowance)}</span>
                              <ArrowRight size={13} className="text-emerald-600" />
                              <strong className="text-emerald-700">{formatCurrencyVND(s.newAllowance)}</strong>
                            </div>
                          </div>
                        </div>

                        {(s.ceoNote || s.financeNote) && (
                          <div className="text-xs text-slate-600 space-y-1">
                            {s.ceoNote && <p><strong>Ghi chú CEO:</strong> {s.ceoNote}</p>}
                            {s.financeNote && (
                              <p className="text-emerald-800">
                                <strong>Tài chính{s.appliedByName ? ` (${s.appliedByName})` : ''}:</strong> {s.financeNote}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── TAB 3: CERT REIMBURSEMENTS ─────────────────────────────── */
            <div className="space-y-4">
              {certReimbs.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                  <Award size={34} className="mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Chưa có đề xuất hoàn ứng chứng chỉ quốc tế nào</p>
                  <p className="text-xs text-slate-500">
                    Kỹ sư gửi đề xuất hoàn ứng ngay từ thẻ Chứng chỉ trên trang <strong>Dự án của tôi → Hồ sơ Kỹ thuật</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certReimbs.map((c) => {
                    const st = CERT_STATUS_META[c.status] || CERT_STATUS_META.SUBMITTED;
                    return (
                      <div key={c.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 text-xs">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{c.certificateName}</span>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {c.issuingOrganization}
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.badge}`}>
                                {st.label}
                              </span>
                            </div>
                            <p className="text-slate-600">
                              Kỹ sư: <strong>{c.employeeName}</strong> {c.employeeCode ? `(${c.employeeCode})` : ''} • {c.employeePosition || 'Kỹ sư Công nghệ'}
                              {c.commitmentMonths > 0 ? ` • Cam kết gắn bó: ${c.commitmentMonths} tháng` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-0.5 tabular-nums">
                              <span>Lệ phí thi: <strong>{formatCurrencyVND(c.examFeeVnd)}</strong></span>
                              <span>Đề xuất ({c.supportPercent}%): <strong className="text-blue-800">{formatCurrencyVND(c.requestedAmountVnd)}</strong></span>
                              {c.approvedAmountVnd != null && (
                                <span>Tài chính duyệt: <strong className="text-emerald-700">{formatCurrencyVND(c.approvedAmountVnd)}</strong></span>
                              )}
                              {c.invoiceNumber && <span>Hóa đơn: <strong className="font-mono">{c.invoiceNumber}</strong></span>}
                              {c.credentialUrl && (
                                <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold">
                                  Xác thực chứng chỉ <ExternalLink size={11} />
                                </a>
                              )}
                              {c.receiptUrl && (
                                <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold">
                                  Xem biên lai <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {isFinanceChief && c.status === 'TECH_APPROVED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCertDecisionModal({ item: c, mode: 'finance_approve' });
                                    setApprovedAmtStr(formatVndInput(Number(c.requestedAmountVnd || c.examFeeVnd)));
                                    setPayoutMethod('BANK_TRANSFER');
                                    setCertModalNote('');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                                >
                                  <CheckCircle2 size={13} /> Duyệt chi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCertDecisionModal({ item: c, mode: 'finance_reject' });
                                    setCertModalNote('');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                                >
                                  <XCircle size={13} /> Từ chối
                                </button>
                              </>
                            )}
                            {isFinance && c.status === 'FINANCE_APPROVED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCertDecisionModal({ item: c, mode: 'disburse' });
                                  setPaymentRef('');
                                  setCertModalNote('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-700 text-white font-bold cursor-pointer"
                              >
                                <CreditCard size={13} /> Xác nhận đã chi trả
                              </button>
                            )}
                          </div>
                        </div>

                        {(c.techNote || c.financeNote || c.paymentReference || c.rejectionReason) && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1 text-slate-700">
                            {c.techNote && (
                              <p><strong>Phòng Công nghệ{c.techReviewerName ? ` (${c.techReviewerName})` : ''}:</strong> {c.techNote}</p>
                            )}
                            {c.financeNote && (
                              <p>
                                <strong>Phòng Tài chính{c.financeApproverName ? ` (${c.financeApproverName})` : ''}:</strong> {c.financeNote}
                                {c.payoutMethod === 'NEXT_PAYROLL' && c.payoutPayrollMonth && (
                                  <span className="ml-1.5 font-bold text-indigo-700">• Gộp kỳ lương {formatMonthVN(c.payoutPayrollMonth)}</span>
                                )}
                                {c.payoutMethod === 'BANK_TRANSFER' && (
                                  <span className="ml-1.5 font-bold text-emerald-700">• Chuyển khoản riêng</span>
                                )}
                              </p>
                            )}
                            {c.paymentReference && (
                              <p className="text-emerald-800 font-semibold">
                                Mã chứng từ chi trả: <span className="font-mono">{c.paymentReference}</span> ({formatDateTimeVN(c.disbursedAt)})
                              </p>
                            )}
                            {c.rejectionReason && (
                              <p className="text-rose-700 font-semibold">Lý do từ chối: {c.rejectionReason}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Review Project Cost Report */}
      {reviewReportModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {reviewReportModal.decision === 'CONFIRMED'
                  ? `Xác nhận Hạch toán ${formatMonthVN(reviewReportModal.report.reportMonth)}`
                  : `Yêu cầu giải trình ${formatMonthVN(reviewReportModal.report.reportMonth)}`}
              </h3>
              <button type="button" onClick={() => setReviewReportModal(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleSubmitCostReview} className="p-5 space-y-3 text-xs">
              {reviewReportModal.decision === 'CONFIRMED' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã chứng từ / Bút toán kế toán (tùy chọn)</label>
                  <input
                    type="text"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    placeholder="VD: BT-CPDA-2026-11"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {reviewReportModal.decision === 'CONFIRMED' ? 'Ghi chú hạch toán (tùy chọn)' : 'Lý do yêu cầu giải trình *'}
                </label>
                <textarea
                  rows={3}
                  value={financeNote}
                  onChange={(e) => setFinanceNote(e.target.value)}
                  placeholder={
                    reviewReportModal.decision === 'CONFIRMED'
                      ? 'VD: Đã đối chiếu khớp bảng công & ghi nhận giá vốn dự án...'
                      : 'Nhập rõ sai lệch giờ công hoặc dự án cần Phòng Công nghệ giải trình...'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewReportModal(null)} className="px-4 py-2 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'review-cost'}
                  className={`px-4 py-2 font-bold text-white rounded-xl cursor-pointer ${
                    reviewReportModal.decision === 'CONFIRMED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {reviewReportModal.decision === 'CONFIRMED' ? 'Xác nhận Hạch toán' : 'Gửi yêu cầu giải trình'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 2: Update Project Budget */}
      {budgetModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Ngân sách Dự án {budgetModal.projectCode}</h3>
              <button type="button" onClick={() => setBudgetModal(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleSaveProjectBudget} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">Dự án: <strong>{budgetModal.projectName}</strong></p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ngân sách chi phí nhân công (VNĐ)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={budgetStr}
                    onChange={(e) => setBudgetStr(formatVndInput(e.target.value))}
                    placeholder="VD: 500.000.000"
                    className="w-full pl-3 pr-12 py-2 font-bold border border-slate-200 rounded-xl outline-none focus:border-blue-500 tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                    VNĐ
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBudgetModal(null)} className="px-4 py-2 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Hủy
                </button>
                <button type="submit" disabled={busyId === 'save-budget'} className="px-4 py-2 font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl cursor-pointer">
                  Lưu ngân sách
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 3: Apply Compensation Sync */}
      {applyCompModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Xác nhận Áp dụng Lương mới ({formatMonthVN(applyCompModal.effectiveMonth)})</h3>
              <button type="button" onClick={() => setApplyCompModal(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleApplyCompSync} className="p-5 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <p>Kỹ sư: <strong>{applyCompModal.employeeName}</strong></p>
                <p>Lương CB mới: <strong>{formatCurrencyVND(applyCompModal.newBaseSalary)}</strong></p>
                <p>Phụ cấp mới: <strong>{formatCurrencyVND(applyCompModal.newAllowance)}</strong></p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú Kế toán (tùy chọn)</label>
                <input
                  type="text"
                  value={applyCompNote}
                  onChange={(e) => setApplyCompNote(e.target.value)}
                  placeholder="VD: Đã cập nhật trước khi chạy bảng lương tháng..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setApplyCompModal(null)} className="px-4 py-2 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Hủy
                </button>
                <button type="submit" disabled={Boolean(busyId)} className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer">
                  Xác nhận cập nhật hồ sơ lương
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 4: Finance Cert Decision / Disburse */}
      {certDecisionModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {certDecisionModal.mode === 'finance_approve'
                  ? 'Phê duyệt chi Hoàn ứng Chứng chỉ'
                  : certDecisionModal.mode === 'disburse'
                    ? 'Xác nhận Đã chi trả Hoàn ứng'
                    : 'Từ chối Hoàn ứng Chứng chỉ'}
              </h3>
              <button type="button" onClick={() => setCertDecisionModal(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleCertModalSubmit} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                <strong>{certDecisionModal.item.employeeName}</strong> — {certDecisionModal.item.certificateName}
              </p>

              {certDecisionModal.mode === 'finance_approve' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số tiền duyệt chi (VNĐ) *</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={approvedAmtStr}
                        onChange={(e) => setApprovedAmtStr(formatVndInput(e.target.value))}
                        className="w-full pl-3 pr-12 py-2 font-bold border border-slate-200 rounded-xl outline-none focus:border-blue-500 tabular-nums"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        VNĐ
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Phương thức chi trả</label>
                      <select
                        value={payoutMethod}
                        onChange={(e) => setPayoutMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      >
                        <option value="BANK_TRANSFER">Chuyển khoản riêng</option>
                        <option value="NEXT_PAYROLL">Gộp kỳ lương tháng</option>
                      </select>
                    </div>
                    {payoutMethod === 'NEXT_PAYROLL' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Kỳ lương gộp chi</label>
                        <input
                          type="month"
                          value={payoutMonth}
                          onChange={(e) => setPayoutMonth(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {certDecisionModal.mode === 'disburse' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã chứng từ / Mã giao dịch chuyển khoản *</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="VD: UNC-2026-1124-CERT"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {certDecisionModal.mode === 'finance_reject' ? 'Lý do từ chối *' : 'Ghi chú Tài chính (tùy chọn)'}
                </label>
                <textarea
                  rows={2}
                  value={certModalNote}
                  onChange={(e) => setCertModalNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCertDecisionModal(null)} className="px-4 py-2 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={Boolean(busyId)}
                  className={`px-4 py-2 font-bold text-white rounded-xl cursor-pointer ${
                    certDecisionModal.mode === 'finance_reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {certDecisionModal.mode === 'finance_approve'
                    ? 'Phê duyệt chi'
                    : certDecisionModal.mode === 'disburse'
                      ? 'Xác nhận đã chi trả'
                      : 'Xác nhận từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
