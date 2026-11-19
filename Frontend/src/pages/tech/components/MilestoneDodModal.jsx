import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ListChecks,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatDateTimeVN } from '../techHelpers';

export default function MilestoneDodModal({
  isOpen,
  onClose,
  projectId,
  milestone,
  canManage = false,
  onDodUpdated,
}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // New item form
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsRequired, setNewIsRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete item confirmation modal state
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!projectId || !milestone?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tech/projects/${projectId}/milestones/${milestone.id}/dod`);
      if (res.data && res.data.data) {
        setItems(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải danh sách tiêu chí DoD', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, milestone?.id, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      setIsAdding(false);
      setNewTitle('');
      setNewDesc('');
      setNewIsRequired(true);
    }
  }, [isOpen, fetchItems]);

  const handleToggle = async (item) => {
    try {
      setTogglingId(item.id);
      const nextStatus = !item.isCompleted;
      const res = await api.patch(
        `/api/tech/projects/${projectId}/milestones/${milestone.id}/dod/${item.id}/toggle`,
        null,
        { params: { completed: nextStatus } }
      );
      if (res.data?.data) {
        setItems((prev) => prev.map((it) => (it.id === item.id ? res.data.data : it)));
        toast?.show('Cập nhật', `Đã đánh dấu tiêu chí: ${nextStatus ? 'Đạt' : 'Chưa đạt'}`, 'success');
        if (onDodUpdated) onDodUpdated();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật trạng thái tiêu chí', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập tên tiêu chí nghiệm thu', 'warning');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        isRequired: newIsRequired,
      };
      const res = await api.post(
        `/api/tech/projects/${projectId}/milestones/${milestone.id}/dod`,
        payload
      );
      if (res.data?.data) {
        setItems((prev) => [...prev, res.data.data]);
        toast?.show('Thành công', 'Đã thêm tiêu chí DoD mới', 'success');
        setNewTitle('');
        setNewDesc('');
        setNewIsRequired(true);
        setIsAdding(false);
        if (onDodUpdated) onDodUpdated();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tạo tiêu chí DoD', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      setDeletingItem(true);
      await api.delete(`/api/tech/projects/${projectId}/milestones/${milestone.id}/dod/${deleteItemTarget.id}`);
      setItems((prev) => prev.filter((it) => it.id !== deleteItemTarget.id));
      toast?.show('Đã xóa', 'Đã xóa tiêu chí DoD', 'info');
      setDeleteItemTarget(null);
      if (onDodUpdated) onDodUpdated();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa tiêu chí DoD', 'error');
    } finally {
      setDeletingItem(false);
    }
  };

  if (!isOpen || !milestone) return null;

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.isCompleted).length;
  const uncompletedRequiredCount = items.filter((i) => i.isRequired && !i.isCompleted).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-[#0F2557] px-6 py-4.5 text-white flex items-center justify-between gap-3 shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <ListChecks size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Checklist Nghiệm thu Mốc (DoD)</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-blue-100">
                  {milestone.weightPercent}% trọng số
                </span>
              </div>
              <p className="text-xs text-blue-200/80 truncate max-w-md" title={milestone.title}>
                Mốc: <strong>{milestone.title}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/75 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress & Quality Gate Status */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 flex items-center gap-1.5">
              <span>Tiến độ nghiệm thu tiêu chuẩn:</span>
              <strong className="text-[#0F2557]">
                {completedCount}/{totalCount} tiêu chí ({percent}%)
              </strong>
            </span>
            {uncompletedRequiredCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold text-[11px]">
                <ShieldCheck size={12} />
                Đủ điều kiện nghiệm thu 100%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold text-[11px]">
                <ShieldAlert size={12} />
                Còn {uncompletedRequiredCount} tiêu chí bắt buộc
              </span>
            )}
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                uncompletedRequiredCount === 0 && totalCount > 0 ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {uncompletedRequiredCount > 0 && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>
                Hệ thống áp dụng Quality Gate: Mốc tiến độ không thể chốt Hoàn thành 100% khi còn tiêu chí bắt buộc chưa đạt.
              </span>
            </p>
          )}
        </div>

        {/* DoD Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách tiêu chí DoD...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <ListChecks size={36} className="mx-auto text-slate-300" />
              <p className="text-xs text-slate-500 font-medium">
                Chưa có tiêu chí Definition of Done (DoD) nào cho mốc tiến độ này.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Thêm tiêu chí đầu tiên</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                    item.isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200/90 text-slate-800'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={togglingId === item.id}
                      onClick={() => handleToggle(item)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 transition cursor-pointer shrink-0 disabled:opacity-50"
                      title={item.isCompleted ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu đã hoàn thành'}
                    >
                      {item.isCompleted ? (
                        <CheckSquare size={18} className="text-emerald-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold ${
                            item.isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </span>

                        {item.isRequired ? (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Bắt buộc
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Khuyến nghị
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
                      )}

                      {item.isCompleted && (
                        <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-semibold tabular pt-0.5">
                          <CheckCircle2 size={11} />
                          <span>
                            Nghiệm thu bởi {item.completedByName || 'Kỹ sư'} lúc {formatDateTimeVN(item.completedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeleteItemTarget(item)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                      title="Xóa tiêu chí"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Item Form */}
          <AnimatePresence>
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddItem}
                className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Plus size={13} className="text-blue-600" />
                    <span>Thêm Tiêu chí DoD Nghiệm thu mới</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="VD: SonarQube Clean Code 0 blocker, Test Coverage >= 80%..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Mô tả chi tiết bằng chứng hoặc cách kiểm tra nghiệm thu (tùy chọn)..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 resize-none"
                  />
                  <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={newIsRequired}
                      onChange={(e) => setNewIsRequired(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Bắt buộc phải đạt mới được nghiệm thu hoàn thành 100% mốc
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0F2557] hover:bg-blue-900 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : 'Thêm tiêu chí'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {canManage && !isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm tiêu chí DoD</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )}

  {/* Delete DoD Item Confirmation Modal */}
  {deleteItemTarget &&
    createPortal(
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget && !deletingItem) {
            setDeleteItemTarget(null);
          }
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4 my-auto"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa tiêu chí DoD</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa tiêu chí{' '}
                <strong className="text-slate-900">{deleteItemTarget.title}</strong> khỏi mốc tiến độ này không? Thao tác này không thể hoàn tác.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={deletingItem}
              onClick={() => setDeleteItemTarget(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={deletingItem}
              onClick={handleConfirmDeleteItem}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {deletingItem ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    )}
    </>
  );
}

