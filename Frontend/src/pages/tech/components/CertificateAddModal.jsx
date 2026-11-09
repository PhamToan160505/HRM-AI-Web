import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Calendar, Link2, Hash, Building, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

export default function CertificateAddModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    certificateName: '',
    issuingOrganization: '',
    issueDate: '',
    expiryDate: '',
    credentialId: '',
    credentialUrl: '',
  });

  const isEdit = Boolean(initialData);
  const todayStr = new Date().toISOString().split('T')[0];
  const minIssueDate = new Date(new Date().setFullYear(new Date().getFullYear() - 40)).toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setErrorMessage('');
      if (initialData) {
        setFormData({
          certificateName: initialData.certificateName || '',
          issuingOrganization: initialData.issuingOrganization || '',
          issueDate: initialData.issueDate || '',
          expiryDate: initialData.expiryDate || '',
          credentialId: initialData.credentialId || '',
          credentialUrl: initialData.credentialUrl || '',
        });
      } else {
        setFormData({
          certificateName: '',
          issuingOrganization: '',
          issueDate: '',
          expiryDate: '',
          credentialId: '',
          credentialUrl: '',
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
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.certificateName.trim()) {
      const msg = 'Vui lòng nhập tên chứng chỉ!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    if (!formData.issuingOrganization.trim()) {
      const msg = 'Vui lòng nhập tổ chức cấp chứng chỉ!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    if (!formData.issueDate) {
      const msg = 'Vui lòng chọn ngày cấp chứng chỉ!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    if (formData.issueDate > todayStr) {
      const msg = 'Ngày cấp chứng chỉ không được ở tương lai!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    if (formData.issueDate < minIssueDate) {
      const msg = 'Ngày cấp chứng chỉ không hợp lệ (không quá 40 năm trước)!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    if (formData.expiryDate && formData.expiryDate <= formData.issueDate) {
      const msg = 'Ngày hết hạn phải sau ngày cấp chứng chỉ!';
      setErrorMessage(msg);
      toast.show('Lỗi', msg, 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        certificateName: formData.certificateName.trim(),
        issuingOrganization: formData.issuingOrganization.trim(),
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate || null,
        credentialId: formData.credentialId.trim() || null,
        credentialUrl: formData.credentialUrl.trim() || null,
      };

      if (isEdit) {
        await api.put(`/api/tech/skills/certificates/${initialData.id}`, payload);
        toast.show('Thành công', 'Cập nhật chứng chỉ công nghệ thành công!', 'success');
      } else {
        await api.post('/api/tech/skills/certificates', payload);
        toast.show('Thành công', 'Thêm chứng chỉ công nghệ thành công!', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || (isEdit ? 'Có lỗi xảy ra khi cập nhật chứng chỉ' : 'Có lỗi xảy ra khi lưu chứng chỉ');
      setErrorMessage(msg);
      toast.show('Thất bại', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div data-tech-modal="true" className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEdit ? 'Chỉnh sửa Chứng chỉ Công nghệ' : 'Thêm Chứng chỉ Công nghệ'}
              </h3>
              <p className="text-xs text-white/80">
                {isEdit
                  ? 'Cập nhật thông tin bằng cấp & chứng nhận chuyên môn'
                  : 'Lưu trữ bằng cấp & chứng nhận chuyên môn quốc tế'}
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

        {/* Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 animate-fadeIn text-xs font-medium">
                <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button type="button" onClick={() => setErrorMessage('')}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tên chứng chỉ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.certificateName}
                onChange={(e) => setFormData({ ...formData, certificateName: e.target.value })}
                placeholder="Ví dụ: AWS Certified Solutions Architect, Oracle OCP Java..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} className="text-slate-500" />
                Tổ chức cấp chứng chỉ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.issuingOrganization}
                onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                placeholder="Ví dụ: Amazon Web Services, Oracle, Scrum.org, ISTQB..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  Ngày cấp <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  max={todayStr}
                  min={minIssueDate}
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-400">Không được ở tương lai (trong 40 năm trở lại)</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  Ngày hết hạn (Nếu có)
                </label>
                <input
                  type="date"
                  min={formData.issueDate || undefined}
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-400">Phải sau ngày cấp (để trống nếu vĩnh viễn)</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={14} className="text-slate-500" />
                Mã định danh chứng chỉ (Credential ID)
              </label>
              <input
                type="text"
                value={formData.credentialId}
                onChange={(e) => setFormData({ ...formData, credentialId: e.target.value })}
                placeholder="Ví dụ: AWS-SAA-982341"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 size={14} className="text-slate-500" />
                Đường dẫn xác thực online (URL)
              </label>
              <input
                type="url"
                value={formData.credentialUrl}
                onChange={(e) => setFormData({ ...formData, credentialUrl: e.target.value })}
                placeholder="https://www.credly.com/badges/..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>
          </div>

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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Lưu chứng chỉ')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

