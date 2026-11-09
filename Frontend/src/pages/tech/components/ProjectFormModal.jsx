import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Code2,
  Calendar,
  Link2,
  FileText,
  CheckCircle2,
  Lock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

const PRESET_TECH_STACK = [
  'Java', 'Spring Boot', 'React', 'TypeScript', 'Node.js', 'NestJS',
  'Next.js', 'Python', 'Django', 'FastAPI', 'Flutter', 'Go',
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Tailwind CSS',
];

const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextDayStr = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function ProjectFormModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    projectCode: '',
    projectType: 'INTERNAL',
    status: 'PLANNING',
    techStack: [],
    startDate: '',
    endDate: '',
    gitRepoUrl: '',
    jiraUrl: '',
    figmaUrl: '',
    description: '',
  });

  const [customTech, setCustomTech] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [touchedDates, setTouchedDates] = useState({ startDate: false, endDate: false });
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isEditing = Boolean(initialData?.id);
  const today = getTodayStr();

  useEffect(() => {
    setErrorMessage('');
    setTouchedDates({ startDate: false, endDate: false });
    setHasAttemptedSubmit(false);
    if (initialData) {
      setFormData({
        projectName: initialData.projectName || '',
        projectCode: initialData.projectCode || '',
        projectType: initialData.projectType || 'INTERNAL',
        status: initialData.status || 'PLANNING',
        techStack: initialData.techStack || [],
        startDate: initialData.startDate || '',
        endDate: initialData.endDate || '',
        gitRepoUrl: initialData.gitRepoUrl || '',
        jiraUrl: initialData.jiraUrl || '',
        figmaUrl: initialData.figmaUrl || '',
        description: initialData.description || '',
      });
    } else {
      const todayStr = getTodayStr();
      setFormData({
        projectName: '',
        projectCode: '',
        projectType: 'INTERNAL',
        status: 'PLANNING',
        techStack: ['Java', 'Spring Boot', 'React'],
        startDate: todayStr,
        endDate: getNextDayStr(todayStr),
        gitRepoUrl: '',
        jiraUrl: '',
        figmaUrl: '',
        description: '',
      });
    }
  }, [initialData, isOpen]);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
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
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleToggleTech = (tech) => {
    setFormData((prev) => {
      const exists = prev.techStack.includes(tech);
      return {
        ...prev,
        techStack: exists ? prev.techStack.filter((t) => t !== tech) : [...prev.techStack, tech],
      };
    });
  };

  const handleAddCustomTech = (e) => {
    e.preventDefault();
    if (customTech.trim() && !formData.techStack.includes(customTech.trim())) {
      setFormData((prev) => ({
        ...prev,
        techStack: [...prev.techStack, customTech.trim()],
      }));
      setCustomTech('');
    }
  };

  const getDateErrors = () => {
    let startErr = '';
    let endErr = '';

    if (!isEditing) {
      if (!formData.startDate) {
        startErr = 'Vui lòng chọn ngày bắt đầu dự án';
      } else if (formData.startDate < today) {
        startErr = `Ngày bắt đầu không được chọn ngày trong quá khứ (phải từ ngày ${formatDateVN(today)} trở đi)!`;
      }
    }

    if (!formData.endDate) {
      endErr = 'Vui lòng chọn ngày kết thúc dự kiến';
    } else if (formData.endDate < today) {
      endErr = `Ngày kết thúc không được chọn ngày trong quá khứ (phải từ ngày ${formatDateVN(today)} trở đi)!`;
    } else if (formData.startDate) {
      const minEndDate = getNextDayStr(formData.startDate);
      if (formData.endDate < minEndDate) {
        endErr = `Ngày kết thúc dự kiến phải sau ngày bắt đầu ít nhất 24 giờ (phải từ ngày ${formatDateVN(minEndDate)} trở đi)!`;
      }
    }

    return { startErr, endErr };
  };

  const { startErr: startDateError, endErr: endDateError } = getDateErrors();
  const showStartError = (touchedDates.startDate || hasAttemptedSubmit) && Boolean(startDateError);
  const showEndError = (touchedDates.endDate || hasAttemptedSubmit) && Boolean(endDateError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setErrorMessage('');

    if (!formData.projectName.trim()) {
      const msg = 'Vui lòng nhập tên dự án!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    const { startErr, endErr } = getDateErrors();
    if (startErr) {
      setErrorMessage(startErr);
      toast.show('Lỗi ngày bắt đầu', startErr, 'error');
      return;
    }

    if (endErr) {
      setErrorMessage(endErr);
      toast.show('Lỗi ngày kết thúc', endErr, 'error');
      return;
    }

    try {
      setLoading(true);
      if (initialData?.id) {
        await api.put(`/api/tech/projects/${initialData.id}`, formData);
        toast.show('Thành công', 'Cập nhật dự án thành công!', 'success');
      } else {
        await api.post('/api/tech/projects', formData);
        toast.show('Thành công', 'Khởi tạo dự án công nghệ mới thành công!', 'success');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dự án';
      setErrorMessage(msg);
      toast.show('Thất bại', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Deep Sapphire */}
        <div className="shrink-0 px-6 py-4.5 sm:py-5 bg-[#0F2557] text-white flex items-center justify-between border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Code2 size={21} />
            </div>
            <div className="min-w-0">
              <h2 id="project-form-modal-title" className="text-lg font-bold text-white truncate">
                {initialData ? 'Chỉnh sửa Dự án Công nghệ' : 'Khởi tạo Dự án Công nghệ mới'}
              </h2>
              <p className="text-xs text-blue-100/80 mt-0.5 truncate">
                Thiết lập thông tin dự án, lộ trình thời gian và công nghệ sử dụng (Tech Stack)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Đóng cửa sổ (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 shadow-2xs">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-rose-800">Không thể lưu dự án:</p>
                  <p className="mt-0.5 leading-relaxed font-medium">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                  aria-label="Đóng cảnh báo"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tên dự án <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="Ví dụ: Nền tảng HRM AI, Ví điện tử FinTech..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Mã dự án (Code)</label>
                <input
                  type="text"
                  value={formData.projectCode}
                  onChange={(e) => setFormData({ ...formData, projectCode: e.target.value.toUpperCase() })}
                  placeholder="Tự động (PRJ-...)"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono uppercase transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Loại dự án</label>
                <select
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white cursor-pointer"
                >
                  <option value="INTERNAL">Nội bộ (R&amp;D / Sản phẩm công ty)</option>
                  <option value="CLIENT">Khách hàng (Dự án phần mềm Outsource)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Trạng thái dự án</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white cursor-pointer"
                >
                  <option value="PLANNING">Đang lên kế hoạch (Planning)</option>
                  <option value="IN_PROGRESS">Đang phát triển (In Progress)</option>
                  <option value="MAINTENANCE">Bảo trì &amp; Hỗ trợ (Maintenance)</option>
                  <option value="COMPLETED">Đã hoàn thành (Completed)</option>
                  <option value="PAUSED">Tạm dừng (Paused)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    <span>
                      Ngày bắt đầu <span className="text-rose-500">*</span>
                    </span>
                  </span>
                  {isEditing && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 whitespace-nowrap">
                      <Lock size={10} /> Không thể thay đổi
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  required
                  disabled={isEditing}
                  value={formData.startDate}
                  onBlur={() => setTouchedDates((prev) => ({ ...prev, startDate: true }))}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setTouchedDates((prev) => ({ ...prev, startDate: true }));
                    setFormData((prev) => ({ ...prev, startDate: newStart }));
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl outline-none transition tabular ${
                    isEditing
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed select-none border-slate-200'
                      : showStartError
                      ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                  }`}
                />
                {showStartError ? (
                  <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1">
                    <AlertCircle size={13} className="shrink-0 text-rose-500" />
                    <span>{startDateError}</span>
                  </p>
                ) : !isEditing ? (
                  <p className="text-[11px] text-slate-400">Không được chọn ngày trong quá khứ</p>
                ) : (
                  <p className="text-[11px] text-slate-400">Ngày bắt đầu dự án được giữ nguyên khi chỉnh sửa</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" />
                  <span>
                    Ngày kết thúc dự kiến <span className="text-rose-500">*</span>
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onBlur={() => setTouchedDates((prev) => ({ ...prev, endDate: true }))}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    setTouchedDates((prev) => ({ ...prev, endDate: true }));
                    setFormData((prev) => ({ ...prev, endDate: newEnd }));
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl outline-none transition tabular ${
                    showEndError
                      ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                  }`}
                />
                {showEndError ? (
                  <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 mt-1">
                    <AlertCircle size={13} className="shrink-0 text-rose-500" />
                    <span>{endDateError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {isEditing
                      ? 'Không được chọn ngày trong quá khứ và phải sau ngày bắt đầu'
                      : 'Phải sau ngày bắt đầu ít nhất 24 giờ'}
                  </p>
                )}
              </div>
            </div>

            {/* Tech Stack Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Code2 size={14} className="text-blue-600" />
                <span>Công nghệ sử dụng (Tech Stack)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                {PRESET_TECH_STACK.map((tech) => {
                  const selected = formData.techStack.includes(tech);
                  return (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => handleToggleTech(tech)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        selected
                          ? 'bg-[#1E3A8A] text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}
                      {tech}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 items-center mt-2">
                <input
                  type="text"
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomTech(e);
                    }
                  }}
                  placeholder="Thêm công nghệ khác..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTech}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Thêm tag
                </button>
              </div>
            </div>

            {/* Links */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Link2 size={14} className="text-blue-600" />
                <span>Tài nguyên &amp; Liên kết phát triển</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Git Repository (GitHub/GitLab)</label>
                  <input
                    type="url"
                    value={formData.gitRepoUrl}
                    onChange={(e) => setFormData({ ...formData, gitRepoUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Jira / Trello / Linear Board</label>
                  <input
                    type="url"
                    value={formData.jiraUrl}
                    onChange={(e) => setFormData({ ...formData, jiraUrl: e.target.value })}
                    placeholder="https://jira.company.com/..."
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Figma Design URL</label>
                  <input
                    type="url"
                    value={formData.figmaUrl}
                    onChange={(e) => setFormData({ ...formData, figmaUrl: e.target.value })}
                    placeholder="https://figma.com/file/..."
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" />
                <span>Mô tả mục tiêu dự án</span>
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ghi chú về phạm vi sản phẩm, mục tiêu kỹ thuật, khách hàng..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang lưu...' : initialData ? 'Lưu thay đổi' : 'Tạo dự án'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
