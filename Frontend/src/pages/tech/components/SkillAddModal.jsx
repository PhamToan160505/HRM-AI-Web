import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Award, CheckCircle2, AlertTriangle, Layers, Clock, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

const PROFICIENCY_OPTIONS = [
  { value: 'FRESHER', label: 'Fresher (Mới tiếp cận - Dưới 1 năm)', desc: 'Nắm lý thuyết, cần có mentor kèm cặp', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'JUNIOR', label: 'Junior (Cơ bản - 1 đến 2 năm)', desc: 'Độc lập làm các task vừa và nhỏ', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  { value: 'MIDDLE', label: 'Middle (Thành thạo - 2 đến 4 năm)', desc: 'Xử lý tính năng phức tạp, tối ưu code', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { value: 'SENIOR', label: 'Senior (Chuyên sâu - 4 đến 6 năm)', desc: 'Làm chủ kiến trúc, tối ưu hiệu năng, review code', color: 'text-amber-800 bg-amber-50 border-amber-300' },
  { value: 'EXPERT', label: 'Expert (Chuyên gia - Trên 6 năm)', desc: 'Định hướng giải pháp & kiến trúc toàn dự án', color: 'text-purple-800 bg-purple-50 border-purple-300 font-bold' },
];

export default function SkillAddModal({ isOpen, onClose, onSuccess, initialSkill = null, existingSkillIds = [] }) {
  const toast = useToast();
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

  // Lọc bỏ các skill đã có trong hồ sơ (nếu đang ở chế độ thêm mới)
  const filteredSkills = isEditing
    ? availableSkills
    : availableSkills.filter((s) => !existingSkillIds.includes(s.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isEditing && !formData.skillId) {
      const msg = 'Vui lòng chọn kỹ năng công nghệ!';
      setErrorMessage(msg);
      toast.show('Lỗi nhập liệu', msg, 'error');
      return;
    }

    const years = Number(formData.yearsOfExperience);
    if (isNaN(years) || years < 0) {
      const msg = 'Số năm kinh nghiệm không được âm!';
      setErrorMessage(msg);
      toast.show('Lỗi nhập liệu', msg, 'error');
      return;
    }

    if (years > 40) {
      const msg = 'Số năm kinh nghiệm không hợp lệ (tối đa không quá 40 năm)!';
      setErrorMessage(msg);
      toast.show('Lỗi nhập liệu', msg, 'error');
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
        toast.show('Thành công', 'Cập nhật kỹ năng thành công!', 'success');
      } else {
        await api.post('/api/tech/skills/my-skills', {
          skillId: Number(formData.skillId),
          proficiencyLevel: formData.proficiencyLevel,
          yearsOfExperience: Number(formData.yearsOfExperience),
          highlightProject: formData.highlightProject.trim(),
        });
        toast.show('Thành công', 'Khai báo kỹ năng mới thành công!', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu kỹ năng';
      setErrorMessage(msg);
      toast.show('Thất bại', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div data-tech-modal="true" className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Award size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEditing ? 'Chỉnh sửa Kỹ năng' : 'Khai báo Kỹ năng mới'}
              </h3>
              <p className="text-xs text-white/80">
                {isEditing ? `Cập nhật cấp bậc & kinh nghiệm (${initialSkill?.skillName})` : 'Bổ sung kỹ năng công nghệ vào hồ sơ kỹ thuật của bạn'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {/* Alert Error */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 animate-fadeIn text-xs font-medium">
                <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button type="button" onClick={() => setErrorMessage('')}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Chọn Kỹ năng */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                Kỹ năng công nghệ <span className="text-red-500">*</span>
              </label>

              {isEditing ? (
                <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm flex items-center justify-between">
                  <span>{initialSkill?.skillName}</span>
                  <span className="text-xs text-slate-500 font-normal">Danh mục: {initialSkill?.category}</span>
                </div>
              ) : (
                <select
                  value={formData.skillId}
                  onChange={(e) => setFormData({ ...formData, skillId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                >
                  <option value="">-- Chọn kỹ năng từ danh mục chuẩn --</option>
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
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                Cấp bậc thành thạo <span className="text-red-500">*</span>
              </label>

              <div className="space-y-2">
                {PROFICIENCY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      formData.proficiencyLevel === opt.value
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="proficiencyLevel"
                      value={opt.value}
                      checked={formData.proficiencyLevel === opt.value}
                      onChange={(e) => setFormData({ ...formData, proficiencyLevel: e.target.value })}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Số năm kinh nghiệm */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600" />
                Số năm kinh nghiệm thực tế (Năm) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="40"
                value={formData.yearsOfExperience}
                onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                placeholder="Ví dụ: 2.5"
              />
              <p className="text-[11px] text-slate-400">Số năm kinh nghiệm thực tế (từ 0 đến tối đa 40 năm)</p>
            </div>

            {/* Dự án tiêu biểu */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Dự án tiêu biểu hoặc Ghi chú kinh nghiệm
              </label>
              <input
                type="text"
                value={formData.highlightProject}
                onChange={(e) => setFormData({ ...formData, highlightProject: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                placeholder="Ví dụ: Đã áp dụng tối ưu hiệu năng Microservices cho dự án HRM AI"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Khai báo kỹ năng'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

