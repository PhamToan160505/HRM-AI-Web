import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Award, AlertTriangle, Layers, Clock, Cpu } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { PROFICIENCY_OPTIONS } from '../techHelpers';

export default function SkillAddModal({
  isOpen,
  onClose,
  onSuccess,
  initialSkill = null,
  existingSkillIds = [],
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [availableSkills, setAvailableSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    skillId: '',
    proficiencyLevel: 'MIDDLE',
    yearsOfExperience: 2.0,
    highlightProject: '',
  });

  const isEditing = Boolean(initialSkill?.id);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setErrorMessage('');
      fetchStandardSkills();

      if (initialSkill) {
        setFormData({
          skillId: initialSkill.skillId || '',
          proficiencyLevel: initialSkill.proficiencyLevel || 'MIDDLE',
          yearsOfExperience: initialSkill.yearsOfExperience ?? 2.0,
          highlightProject: initialSkill.highlightProject || '',
        });
      } else {
        setFormData({
          skillId: '',
          proficiencyLevel: 'MIDDLE',
          yearsOfExperience: 2.0,
          highlightProject: '',
        });
      }
    }

    return () => {
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, initialSkill]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleClose]);

  const fetchStandardSkills = async () => {
    try {
      setLoadingSkills(true);
      const res = await api.get('/api/tech/skills');
      if (res.data?.data) {
        setAvailableSkills(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSkills(false);
    }
  };

  if (!isOpen) return null;

  const filteredSkills = isEditing
    ? availableSkills
    : availableSkills.filter((s) => !existingSkillIds.includes(s.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isEditing && !formData.skillId) {
      const msg = 'Vui lòng chọn kỹ năng công nghệ!';
      setErrorMessage(msg);
      toastRef.current?.show('Lỗi nhập liệu', msg, 'error');
      return;
    }

    const years = Number(formData.yearsOfExperience);
    if (isNaN(years) || years < 0) {
      const msg = 'Số năm kinh nghiệm không được âm!';
      setErrorMessage(msg);
      toastRef.current?.show('Lỗi nhập liệu', msg, 'error');
      return;
    }

    if (years > 40) {
      const msg = 'Số năm kinh nghiệm không hợp lệ (tối đa không quá 40 năm)!';
      setErrorMessage(msg);
      toastRef.current?.show('Lỗi nhập liệu', msg, 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing) {
        await api.put(`/api/tech/skills/my-skills/${initialSkill.id}`, {
          proficiencyLevel: formData.proficiencyLevel,
          yearsOfExperience: Number(formData.yearsOfExperience),
          highlightProject: formData.highlightProject.trim(),
        });
        toastRef.current?.show('Thành công', 'Cập nhật kỹ năng thành công!', 'success');
      } else {
        await api.post('/api/tech/skills/my-skills', {
          skillId: Number(formData.skillId),
          proficiencyLevel: formData.proficiencyLevel,
          yearsOfExperience: Number(formData.yearsOfExperience),
          highlightProject: formData.highlightProject.trim(),
        });
        toastRef.current?.show('Thành công', 'Khai báo kỹ năng mới thành công!', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu kỹ năng';
      setErrorMessage(msg);
      toastRef.current?.show('Thất bại', msg, 'error');
    } finally {
      setSubmitting(false);
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
        aria-labelledby="skill-add-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header — Deep Sapphire Corporate */}
        <div className="px-6 py-4.5 bg-[#0F2557] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <Award size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 id="skill-add-modal-title" className="font-bold text-base text-white truncate">
                {isEditing ? 'Chỉnh sửa Kỹ năng Chuyên môn' : 'Khai báo Kỹ năng mới'}
              </h3>
              <p className="text-xs text-blue-100/80 truncate mt-0.5">
                {isEditing
                  ? `Cập nhật cấp bậc & kinh nghiệm (${initialSkill?.skillName})`
                  : 'Bổ sung kỹ năng công nghệ vào hồ sơ năng lực kỹ thuật'}
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

        {/* Modal Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs font-medium">
                <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="text-rose-400 hover:text-rose-600 cursor-pointer"
                  aria-label="Đóng thông báo lỗi"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Chọn Kỹ năng */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                <span>
                  Kỹ năng công nghệ <span className="text-rose-500">*</span>
                </span>
              </label>

              {isEditing ? (
                <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm flex items-center justify-between">
                  <span>{initialSkill?.skillName}</span>
                  <span className="text-xs text-slate-500 font-medium">Danh mục: {initialSkill?.category}</span>
                </div>
              ) : (
                <select
                  value={formData.skillId}
                  disabled={loadingSkills}
                  onChange={(e) => setFormData({ ...formData, skillId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white cursor-pointer"
                >
                  <option value="">
                    {loadingSkills ? '-- Đang tải danh mục kỹ năng --' : '-- Chọn kỹ năng từ danh mục chuẩn --'}
                  </option>
                  {filteredSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.skillName} ({s.category})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Cấp độ thành thạo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Cpu size={14} className="text-blue-600" />
                <span>
                  Cấp bậc thành thạo <span className="text-rose-500">*</span>
                </span>
              </label>

              <div className="space-y-2">
                {PROFICIENCY_OPTIONS.map((opt) => {
                  const selected = formData.proficiencyLevel === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        selected
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-2xs'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="proficiencyLevel"
                        value={opt.value}
                        checked={selected}
                        onChange={(e) => setFormData({ ...formData, proficiencyLevel: e.target.value })}
                        className="mt-1 accent-blue-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] border ${opt.badgeClass}`}>
                            {opt.value.charAt(0) + opt.value.slice(1).toLowerCase()}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Số năm kinh nghiệm */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-blue-600" />
                <span>
                  Số năm kinh nghiệm thực tế (Năm) <span className="text-rose-500">*</span>
                </span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="40"
                value={formData.yearsOfExperience}
                onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white tabular"
                placeholder="Ví dụ: 2.5"
              />
              <p className="text-[11px] text-slate-400">Số năm kinh nghiệm thực chiến (từ 0 đến tối đa 40 năm)</p>
            </div>

            {/* Dự án tiêu biểu */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Dự án tiêu biểu hoặc Ghi chú kinh nghiệm
              </label>
              <input
                type="text"
                value={formData.highlightProject}
                onChange={(e) => setFormData({ ...formData, highlightProject: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                placeholder="Ví dụ: Thiết kế hệ thống Microservices cho nền tảng HRM AI"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Khai báo kỹ năng'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}