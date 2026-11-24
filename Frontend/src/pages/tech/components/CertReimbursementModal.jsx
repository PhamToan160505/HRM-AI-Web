import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Award, X, Loader2, Send, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatVndInput, parseVndInput } from '../techHelpers';

export default function CertReimbursementModal({ isOpen, onClose, certificate, onSuccess }) {
  const toast = useToast();
  const [examFeeStr, setExamFeeStr] = useState('');
  const [requestedStr, setRequestedStr] = useState('');
  const [supportPercent, setSupportPercent] = useState(100);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [commitmentMonths, setCommitmentMonths] = useState(6);
  const [employeeNote, setEmployeeNote] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setExamFeeStr('');
    setRequestedStr('');
    setSupportPercent(100);
    setInvoiceNumber('');
    setReceiptUrl('');
    setCommitmentMonths(6);
    setEmployeeNote('');
    setErrors({});
  }, [isOpen, certificate?.id]);

  if (!isOpen || !certificate) return null;

  const handleExamFeeChange = (raw) => {
    const formatted = formatVndInput(raw);
    setExamFeeStr(formatted);
    const fee = parseVndInput(formatted);
    if (fee && fee > 0) {
      setRequestedStr(formatVndInput(Math.round((fee * Number(supportPercent || 100)) / 100)));
    } else {
      setRequestedStr('');
    }
    if (errors.examFee) setErrors((p) => ({ ...p, examFee: undefined }));
  };

  const handlePercentChange = (pct) => {
    setSupportPercent(pct);
    const fee = parseVndInput(examFeeStr);
    if (fee && fee > 0) {
      setRequestedStr(formatVndInput(Math.round((fee * Number(pct)) / 100)));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErr = {};
    const examFee = parseVndInput(examFeeStr);
    const requested = parseVndInput(requestedStr);

    if (!examFee || examFee <= 0) {
      nextErr.examFee = 'Vui lòng nhập lệ phí thi thực tế (> 0 VNĐ).';
    }
    if (!requested || requested <= 0) {
      nextErr.requested = 'Vui lòng nhập số tiền đề xuất hỗ trợ (> 0 VNĐ).';
    } else if (examFee && requested > examFee) {
      nextErr.requested = 'Số tiền đề xuất không được vượt quá lệ phí thi thực tế.';
    }
    if (!invoiceNumber.trim() && !receiptUrl.trim()) {
      nextErr.invoice = 'Vui lòng nhập Số hóa đơn/biên lai hoặc Link minh chứng thanh toán.';
    }
    if (receiptUrl.trim() && !/^https?:\/\//i.test(receiptUrl.trim())) {
      nextErr.receiptUrl = 'Link hóa đơn/biên lai phải bắt đầu bằng http:// hoặc https://';
    }

    if (Object.keys(nextErr).length > 0) {
      setErrors(nextErr);
      toast?.show('Thông tin chưa hợp lệ', Object.values(nextErr)[0], 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/api/tech-finance/cert-reimbursements', {
        certificateId: certificate.id,
        examFeeVnd: examFee,
        requestedAmountVnd: requested,
        supportPercent: Number(supportPercent),
        invoiceNumber: invoiceNumber.trim() || null,
        receiptUrl: receiptUrl.trim() || null,
        commitmentMonths: Number(commitmentMonths || 0),
        employeeNote: employeeNote.trim() || null,
      });
      toast?.show(
        'Đã gửi đề xuất hoàn ứng',
        'Yêu cầu đã được gửi tới Trưởng phòng / Giám đốc Công nghệ để xác thực chuyên môn trước khi chuyển Tài chính.',
        'success'
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast?.show('Không thể gửi đề xuất', err.response?.data?.message || 'Đã có lỗi xảy ra', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award size={16} className="text-amber-300 shrink-0" />
              <span>Đề xuất Tài trợ / Hoàn ứng Lệ phí Chứng chỉ</span>
            </h3>
            <p className="text-xs text-blue-200/85 mt-0.5 truncate">
              {certificate.certificateName} • {certificate.issuingOrganization}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs">
          {!certificate.credentialId && !certificate.credentialUrl && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                Chứng chỉ này chưa có <strong>Mã xác thực (Credential ID)</strong> hoặc <strong>Link xác thực</strong>. Vui lòng cập nhật chứng chỉ trước khi gửi đề xuất hoàn ứng.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Lệ phí thi thực tế (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={examFeeStr}
                  onChange={(e) => handleExamFeeChange(e.target.value)}
                  placeholder="VD: 3.800.000"
                  className={`w-full pl-3 pr-12 py-2 text-xs font-semibold border rounded-xl outline-none focus:border-blue-500 tabular-nums ${
                    errors.examFee ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 bg-slate-50 focus:bg-white'
                  }`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  VNĐ
                </span>
              </div>
              {errors.examFee && <p className="text-[11px] text-rose-600 mt-1">{errors.examFee}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mức hỗ trợ đề xuất (%)
              </label>
              <select
                value={supportPercent}
                onChange={(e) => handlePercentChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              >
                <option value={100}>100% lệ phí thi (Chứng chỉ trọng tâm)</option>
                <option value={80}>80% lệ phí thi</option>
                <option value={50}>50% lệ phí thi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Số tiền đề xuất hoàn ứng <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={requestedStr}
                  onChange={(e) => {
                    setRequestedStr(formatVndInput(e.target.value));
                    if (errors.requested) setErrors((p) => ({ ...p, requested: undefined }));
                  }}
                  placeholder="VD: 3.800.000"
                  className={`w-full pl-3 pr-12 py-2 text-xs font-bold text-emerald-800 border rounded-xl outline-none focus:border-blue-500 tabular-nums ${
                    errors.requested ? 'border-rose-400 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40 focus:bg-white'
                  }`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">
                  VNĐ
                </span>
              </div>
              {errors.requested && <p className="text-[11px] text-rose-600 mt-1">{errors.requested}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Cam kết gắn bó sau tài trợ
              </label>
              <select
                value={commitmentMonths}
                onChange={(e) => setCommitmentMonths(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              >
                <option value={0}>Không yêu cầu cam kết</option>
                <option value={6}>6 tháng</option>
                <option value={12}>12 tháng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Số hóa đơn / Mã biên lai <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  if (errors.invoice) setErrors((p) => ({ ...p, invoice: undefined }));
                }}
                placeholder="VD: INV-AWS-2026-0912"
                className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:border-blue-500 ${
                  errors.invoice ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 bg-slate-50 focus:bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Link hóa đơn / biên lai (tùy chọn)
              </label>
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => {
                  setReceiptUrl(e.target.value);
                  if (errors.receiptUrl || errors.invoice) {
                    setErrors((p) => ({ ...p, receiptUrl: undefined, invoice: undefined }));
                  }
                }}
                placeholder="https://drive.google.com/..."
                className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:border-blue-500 ${
                  errors.receiptUrl ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 bg-slate-50 focus:bg-white'
                }`}
              />
            </div>
          </div>
          {(errors.invoice || errors.receiptUrl) && (
            <p className="text-[11px] text-rose-600 -mt-2">{errors.invoice || errors.receiptUrl}</p>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Ghi chú gửi Quản lý &amp; Phòng Tài chính
            </label>
            <textarea
              rows={2}
              value={employeeNote}
              onChange={(e) => setEmployeeNote(e.target.value)}
              placeholder="VD: Đã hoàn thành kỳ thi AWS Solutions Architect Associate phục vụ dự án Cloud HRM..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onClose?.()}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-55"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Gửi đề xuất hoàn ứng</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
