import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Award,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Edit3,
  Trash2,
  Eye,
  AlertTriangle,
  FolderKanban,
  Check,
  Lock,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import {
  REVIEW_TYPE_CONFIG,
  REVIEW_TYPE_OPTIONS,
  formatDateVN,
} from '../techHelpers';

export default function TechCycleManagementModal({
  isOpen,
  onClose,
  cycles = [],
  selectedCycleId = null,
  onSelectCycle,
  onOpenCreateCycle,
  onEditCycle,
  onDeleteSuccess,
  isReadOnly = false,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'OPEN' | 'CLOSED'
  const [typeFilter, setTypeFilter] = useState('');
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [blockedDeleteTarget, setBlockedDeleteTarget] = useState(null);
  const [closingCycle, setClosingCycle] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKeyword('');
    setStatusFilter('');
    setTypeFilter('');
    setDeletingTarget(null);
    setBlockedDeleteTarget(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) {
        e.stopPropagation();
        if (deletingTarget) {
          setDeletingTarget(null);
        } else if (blockedDeleteTarget) {
          setBlockedDeleteTarget(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, deleting, deletingTarget, blockedDeleteTarget, onClose]);

  const filteredCycles = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return cycles.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (typeFilter && c.reviewType !== typeFilter) return false;
      if (!kw) return true;
      return (
        c.cycleCode?.toLowerCase().includes(kw) ||
        c.title?.toLowerCase().includes(kw) ||
        c.createdByName?.toLowerCase().includes(kw)
      );
    });
  }, [cycles, keyword, statusFilter, typeFilter]);

  const openCount = cycles.filter((c) => c.status === 'OPEN').length;
  const closedCount = cycles.filter((c) => c.status === 'CLOSED').length;

  const handleDeleteClick = (cycle) => {
    if (Number(cycle.approvedCount || 0) > 0) {
      setBlockedDeleteTarget(cycle);
    } else {
      setDeletingTarget(cycle);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget || deleting) return;
    try {
      setDeleting(true);
      await api.delete(`/api/tech/reviews/cycles/${deletingTarget.id}`);
      toastRef.current?.show(
        'Đã xóa kỳ đánh giá',
        `Kỳ "${deletingTarget.cycleCode}" và các phiếu liên quan đã được xóa thành công.`,
        'success'
      );
      const deletedId = deletingTarget.id;
      setDeletingTarget(null);
      if (onDeleteSuccess) await onDeleteSuccess(deletedId);
    } catch (err) {
      toastRef.current?.show(
        'Lỗi xóa kỳ',
        err.response?.data?.message || 'Không thể xóa kỳ đánh giá.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickCloseCycle = async (cycle) => {
    if (!cycle || closingCycle) return;
    try {
      setClosingCycle(true);
      await api.put(`/api/tech/reviews/cycles/${cycle.id}`, { status: 'CLOSED' });
      toastRef.current?.show(
        'Đã đóng kỳ đánh giá',
        `Kỳ "${cycle.cycleCode}" đã được chuyển sang trạng thái Đã đóng (CLOSED).`,
        'success'
      );
      setBlockedDeleteTarget(null);
      if (onDeleteSuccess) await onDeleteSuccess(cycle.id);
    } catch (err) {
      toastRef.current?.show(
        'Lỗi',
        err.response?.data?.message || 'Không thể đóng kỳ đánh giá.',
        'error'
      );
    } finally {
      setClosingCycle(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9992] bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cycle-mgmt-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* Header — Deep Sapphire Corporate */}
        <div className="px-6 py-4 bg-[#0F2557] text-white flex items-center justify-between gap-4 shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <FolderKanban size={20} className="text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="cycle-mgmt-modal-title" className="text-base sm:text-lg font-bold text-white">
                  Quản lý Danh sách Kỳ Đánh giá Hiệu suất
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-blue-100 border border-white/20 tabular">
                  {cycles.length} kỳ
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80">
                Toàn bộ các kỳ đánh giá nhân sự Phòng Công nghệ kèm tiến độ, thời hạn và thao tác sửa/xóa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isReadOnly && onOpenCreateCycle && (
              <button
                type="button"
                onClick={() => {
                  onOpenCreateCycle();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#0F2557] text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Mở kỳ mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Đóng cửa sổ"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative min-w-[220px] sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm mã kỳ, tên kỳ..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả trạng thái ({cycles.length})</option>
              <option value="OPEN">Đang mở ({openCount})</option>
              <option value="CLOSED">Đã đóng ({closedCount})</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả loại kỳ</option>
              {REVIEW_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:justify-end text-xs text-slate-500 tabular">
            <span>
              Hiển thị <strong className="text-slate-900">{filteredCycles.length}</strong> / {cycles.length} kỳ
            </span>
          </div>
        </div>

        {/* Cycle List Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {filteredCycles.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Award size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Không tìm thấy kỳ đánh giá nào</p>
              <p className="text-xs text-slate-500">
                Hãy thử đổi từ khóa tìm kiếm hoặc bấm &quot;Mở kỳ mới&quot; để khởi tạo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Mã &amp; Tên kỳ</th>
                    <th className="py-3 px-4 whitespace-nowrap">Loại kỳ</th>
                    <th className="py-3 px-4 whitespace-nowrap">Thời gian &amp; Hạn</th>
                    <th className="py-3 px-4">Tiến độ đánh giá</th>
                    <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredCycles.map((c) => {
                    const isSelected = selectedCycleId != null && String(selectedCycleId) === String(c.id);
                    const typeCfg = REVIEW_TYPE_CONFIG[c.reviewType] || REVIEW_TYPE_CONFIG.QUARTERLY;
                    const isOpenStatus = c.status === 'OPEN';
                    const approvedPct = c.approvedRatePercent ?? 0;
                    const selfPct = c.selfReviewRatePercent ?? 0;

                    return (
                      <tr
                        key={c.id}
                        className={`transition ${
                          isSelected ? 'bg-blue-50/60 font-medium' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. Code & Title */}
                        <td className="py-3.5 px-4 align-top max-w-sm space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200">
                              {c.cycleCode}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check size={11} />
                                <span>Đang chọn xem</span>
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-slate-900 leading-snug">{c.title}</p>
                          {c.createdByName && (
                            <p className="text-[10px] text-slate-400">Tạo bởi: {c.createdByName}</p>
                          )}
                        </td>

                        {/* 2. Review Type */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.badgeClass}`}>
                            {typeCfg.shortLabel}
                          </span>
                        </td>

                        {/* 3. Dates */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap tabular space-y-0.5">
                          <div className="text-slate-800 font-medium">
                            {formatDateVN(c.periodStart)} → {formatDateVN(c.periodEnd)}
                          </div>
                          {c.selfReviewDeadline && (
                            <div className="text-[11px] text-orange-700 font-semibold flex items-center gap-1">
                              <Clock size={11} />
                              <span>Hạn tự chấm: {formatDateVN(c.selfReviewDeadline)}</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Progress */}
                        <td className="py-3.5 px-4 align-top min-w-[200px] space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] tabular">
                            <span className="font-bold text-slate-800">{c.totalReviews ?? 0} phiếu</span>
                            <span className="text-emerald-700 font-bold">
                              {c.approvedCount ?? 0} đã chốt ({approvedPct}%)
                            </span>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${approvedPct}%` }}
                              title={`Đã chốt: ${approvedPct}%`}
                            />
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${Math.max(0, selfPct - approvedPct)}%` }}
                              title={`Đã tự chấm: ${selfPct}%`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 tabular">
                            <span>Tự chấm: {c.selfReviewSubmittedCount ?? 0} NV</span>
                            {Number(c.pendingActionCount || 0) > 0 && (
                              <span className="font-bold text-orange-600">
                                {c.pendingActionCount} chờ xử lý
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          {isOpenStatus ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={12} />
                              <span>Đang mở</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <Lock size={12} />
                              <span>Đã đóng</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Actions */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {!isSelected && onSelectCycle && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCycle(c.id);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                title="Chọn xem kỳ này trên màn hình"
                              >
                                <Eye size={12} />
                                <span>Xem</span>
                              </button>
                            )}

                            {!isReadOnly && onEditCycle && (
                              <button
                                type="button"
                                onClick={() => onEditCycle(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                                title="Chỉnh sửa kỳ đánh giá"
                              >
                                <Edit3 size={12} />
                                <span>Sửa</span>
                              </button>
                            )}

                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(c)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Xóa kỳ đánh giá"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3 text-xs text-slate-500">
          <span>
            💡 Đổi kỳ đang xem bằng cách bấm nút <strong>&quot;Xem&quot;</strong> ở từng dòng tương ứng.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>

      {/* Dialog xác nhận xóa kỳ đánh giá */}
      {deletingTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleting) setDeletingTarget(null);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa kỳ đánh giá</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn có chắc chắn muốn xóa kỳ đánh giá{' '}
                    <strong className="text-slate-900">[{deletingTarget.cycleCode}] {deletingTarget.title}</strong>{' '}
                    không?
                  </p>
                  <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200/80 p-2.5 rounded-xl font-medium mt-1">
                    ⚠️ Toàn bộ <strong>{deletingTarget.totalReviews ?? 0} phiếu đánh giá</strong> (chưa chốt) thuộc kỳ này sẽ bị xóa theo vĩnh viễn khỏi hệ thống.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {deleting ? 'Đang xóa...' : 'Xác nhận xóa kỳ'}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* Dialog cảnh báo không cho xóa kỳ đã có phiếu APPROVED */}
      {blockedDeleteTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget && !closingCycle) setBlockedDeleteTarget(null);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Không thể xóa kỳ đã có kết quả chốt</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Kỳ đánh giá <strong className="text-slate-900">[{blockedDeleteTarget.cycleCode}]</strong> đã có{' '}
                    <strong className="text-emerald-700 font-bold">{blockedDeleteTarget.approvedCount} phiếu</strong> được phê duyệt hoàn tất.
                  </p>
                  <p className="text-[11px] text-slate-600 bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl leading-relaxed mt-1">
                    Theo quy tắc bảo toàn lịch sử năng lực, thăng bậc và đãi ngộ kỹ sư, hệ thống không cho phép xóa kỳ đã có quyết định chính thức. Bạn hãy đổi trạng thái sang <strong>&quot;Đã đóng (CLOSED)&quot;</strong> để lưu trữ.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={closingCycle}
                  onClick={() => setBlockedDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
                {blockedDeleteTarget.status !== 'CLOSED' && (
                  <button
                    type="button"
                    disabled={closingCycle}
                    onClick={() => handleQuickCloseCycle(blockedDeleteTarget)}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {closingCycle ? 'Đang lưu...' : 'Chuyển sang Đã đóng'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </div>,
    document.body
  );
}
