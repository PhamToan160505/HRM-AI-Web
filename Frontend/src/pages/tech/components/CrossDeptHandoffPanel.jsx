import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  Loader2,
  ShieldAlert,
  FileSignature,
  UserCheck,
  UserMinus,
  Wrench,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatDateVN } from '../techHelpers';

const TASK_TYPE_CONFIG = {
  TECH_PREBOARDING_SETUP: {
    label: 'Onboarding Kỹ thuật',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Wrench,
  },
  PROBATION_OFFICIAL_CONTRACT: {
    label: 'Đạt thử việc → HĐ Chính thức',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: UserCheck,
  },
  PROBATION_TERMINATION_REVIEW: {
    label: 'Không đạt thử việc',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: ShieldAlert,
  },
  CONTRACT_ADDENDUM_REQUIRED: {
    label: 'Lập Phụ lục HĐ (Thăng chức / C&B)',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: FileSignature,
  },
  TECH_OFFBOARDING_HANDOVER: {
    label: 'Bàn giao Kỹ thuật Nghỉ việc',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: UserMinus,
  },
};

const PRIORITY_BADGE = {
  URGENT: 'bg-rose-100 text-rose-800 border-rose-200',
  HIGH: 'bg-amber-100 text-amber-800 border-amber-200',
  NORMAL: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_BADGE = {
  OPEN: { label: 'Chờ xử lý', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Đã hoàn tất', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function parseMetadata(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Bảng Điều phối Tác vụ Liên phòng ban (Công nghệ <-> Nhân sự).
 * Hỗ trợ 2 chế độ:
 * - isModal=true: Hiển thị dạng Popup (trên TechProjectListPage)
 * - isModal=false: Hiển thị trực tiếp inline (trên EmployeeLifecyclePage của HR hoặc CeoTechProjectsPage)
 */
export default function CrossDeptHandoffPanel({
  isModal = false,
  isOpen = true,
  onClose,
  isReadOnly = false,
  title = 'Trung tâm Phối hợp Liên phòng (Công nghệ ↔ Nhân sự)',
  direction = 'ALL',
  showSlaBar = true,
  onTasksUpdated,
}) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [sla, setSla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resolvingTaskId, setResolvingTaskId] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, slaRes] = await Promise.all([
        api.get('/api/tech-hr/handoff-tasks', { params: { direction, status: 'ALL' } }),
        showSlaBar
          ? api.get('/api/tech-hr/handoff-tasks/sla-summary').catch(() => ({ data: { data: null } }))
          : Promise.resolve({ data: { data: null } }),
      ]);
      setTasks(tasksRes.data?.data || []);
      setSla(slaRes.data?.data || null);
    } catch (err) {
      toast?.show('Lỗi tải tác vụ liên phòng', err.response?.data?.message || 'Không thể kết nối máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  }, [direction, showSlaBar, toast]);

  useEffect(() => {
    if (!isModal || isOpen) {
      loadData();
    }
  }, [isModal, isOpen, loadData]);

  const handleUpdateStatus = async (taskId, newStatus, note = '') => {
    try {
      setSubmittingId(taskId);
      await api.put(`/api/tech-hr/handoff-tasks/${taskId}`, {
        status: newStatus,
        resolutionNote: note.trim() || null,
      });
      toast?.show(
        'Đã cập nhật',
        newStatus === 'COMPLETED' ? 'Đã hoàn tất tác vụ phối hợp liên phòng' : 'Đã cập nhật trạng thái tác vụ',
        'success'
      );
      setResolvingTaskId(null);
      setResolutionNote('');
      await loadData();
      onTasksUpdated?.();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật tác vụ', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  if (isModal && !isOpen) return null;

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ACTIVE') return t.status === 'OPEN' || t.status === 'IN_PROGRESS';
    if (statusFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const openCount = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;

  const content = (
    <div className="space-y-4">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0F2557] text-white flex items-center justify-center shrink-0">
            <ArrowLeftRight size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              Đồng bộ tự động giữa Phòng Công nghệ &amp; Phòng Nhân sự (Onboarding, Thử việc, Phụ lục C&amp;B, Bàn giao)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
            {[
              { id: 'ALL', label: `Tất cả (${tasks.length})` },
              { id: 'ACTIVE', label: `Chờ xử lý (${openCount})` },
              { id: 'COMPLETED', label: 'Đã xong' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === tab.id ? 'bg-white text-[#0F2557] shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-[#0F2557] hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* SLA Bar */}
      {showSlaBar && sla && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
            <span className="text-[10px] font-bold text-blue-700 uppercase">Chờ xử lý</span>
            <p className="text-lg font-extrabold text-[#0F2557] tabular">{sla.openTasks + sla.inProgressTasks}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Đã hoàn tất</span>
            <p className="text-lg font-extrabold text-emerald-700 tabular">{sla.completedTasks}</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Quá hạn SLA</span>
            <p className="text-lg font-extrabold text-rose-700 tabular">{sla.overdueTasks}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase">CN → NS / NS → CN</span>
            <p className="text-sm font-extrabold text-slate-800 tabular mt-1">
              {sla.techToHrCount} / {sla.hrToTechCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-100 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-violet-700 uppercase">Đúng hạn SLA</span>
            <p className="text-lg font-extrabold text-violet-700 tabular">{sla.onTimeCompletionRate}%</p>
          </div>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 size={15} className="animate-spin" />
          <span>Đang tải danh sách tác vụ phối hợp...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 space-y-1">
          <CheckCircle2 size={26} className="mx-auto text-emerald-400" />
          <p className="text-xs font-bold text-slate-700">Không có tác vụ liên phòng nào trong mục này</p>
          <p className="text-[11px] text-slate-400">
            Mọi yêu cầu bàn giao giữa Phòng Công nghệ và Phòng Nhân sự đều sẽ được tự động tổng hợp tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const typeCfg = TASK_TYPE_CONFIG[task.taskType] || {
              label: task.taskType,
              badge: 'bg-slate-100 text-slate-700 border-slate-200',
              icon: ArrowLeftRight,
            };
            const TypeIcon = typeCfg.icon;
            const stCfg = STATUS_BADGE[task.status] || STATUS_BADGE.OPEN;
            const meta = parseMetadata(task.metadataJson);
            const isActionable = !isReadOnly && (task.status === 'OPEN' || task.status === 'IN_PROGRESS');

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border bg-white space-y-2.5 transition ${
                  task.overdue ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.badge}`}>
                        <TypeIcon size={11} />
                        <span>{typeCfg.label}</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stCfg.cls}`}>
                        {stCfg.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.NORMAL}`}>
                        {task.priority}
                      </span>
                      {task.overdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> Quá hạn SLA
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{task.title}</h4>
                    {task.summary && <p className="text-[11px] text-slate-600 leading-relaxed">{task.summary}</p>}
                  </div>

                  <div className="text-right text-[10px] text-slate-500 shrink-0 tabular space-y-0.5">
                    {task.sourceDepartmentName && task.targetDepartmentName && (
                      <div className="font-semibold text-slate-700">
                        {task.sourceDepartmentName} → {task.targetDepartmentName}
                      </div>
                    )}
                    {task.dueDate && (
                      <div className={task.overdue ? 'text-rose-600 font-bold' : ''}>
                        Hạn SLA: {formatDateVN(task.dueDate)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata detail snippet (B-10 safe) */}
                {meta && (meta.newTitle || meta.newBaseSalary || meta.finalScore != null) && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 flex items-center gap-3 flex-wrap">
                    {meta.finalScore != null && (
                      <span>
                        Điểm thử việc: <strong>{meta.finalScore}đ ({meta.finalGrade})</strong>
                      </span>
                    )}
                    {meta.newTitle && (
                      <span>
                        Chức danh mới: <strong className="text-[#0F2557]">{meta.newTitle}</strong>
                      </span>
                    )}
                    {meta.newBaseSalary != null && (
                      <span>
                        Lương CB mới:{' '}
                        <strong className="text-emerald-700">
                          {typeof meta.newBaseSalary === 'number'
                            ? `${meta.newBaseSalary.toLocaleString('vi-VN')} VNĐ`
                            : meta.newBaseSalary}
                        </strong>
                      </span>
                    )}
                  </div>
                )}

                {task.resolutionNote && (
                  <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900">
                    <strong>Kết quả xử lý{task.completedByName ? ` (${task.completedByName})` : ''}:</strong>{' '}
                    {task.resolutionNote}
                  </div>
                )}

                {/* Actions */}
                {isActionable && (
                  <div className="pt-2 border-t border-slate-100">
                    {resolvingTaskId === task.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="Nhập ghi chú xử lý (VD: Đã lập Phụ lục HĐ số PL-2026/08, Đã chuyển Tech Lead...)"
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingTaskId(null);
                              setResolutionNote('');
                            }}
                            className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            disabled={submittingId === task.id}
                            onClick={() => handleUpdateStatus(task.id, 'COMPLETED', resolutionNote)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {submittingId === task.id && <Loader2 size={12} className="animate-spin" />}
                            <span>Xác nhận Hoàn tất</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {task.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={submittingId === task.id}
                            onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS', '')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                          >
                            <Clock size={12} />
                            <span>Tiếp nhận xử lý</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingTaskId(task.id);
                            setResolutionNote('');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer"
                        >
                          <CheckCircle2 size={12} />
                          <span>Đánh dấu Hoàn tất</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isModal) {
    return <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">{content}</div>;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
      >
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ArrowLeftRight size={17} />
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">{content}</div>
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
