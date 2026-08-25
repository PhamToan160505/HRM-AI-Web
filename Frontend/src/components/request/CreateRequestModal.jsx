import React, { useState } from 'react';
import { X, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';
import { requestService } from '../../services/request.service';
import { useToast } from '../common/Toast';

export default function CreateRequestModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    requestType: 'NORMAL_LEAVE',
    reason: '',
    startDate: '',
    endDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const [leaveQuota, setLeaveQuota] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      requestService.getLeaveQuota()
        .then(quota => setLeaveQuota(quota))
        .catch(err => console.error('Failed to load leave quota', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast.show('Lỗi', 'Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.show('Lỗi', 'Ngày bắt đầu không thể lớn hơn ngày kết thúc', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestService.createRequest(formData);
      toast.show('Thành công', 'Gửi đơn yêu cầu thành công', 'success');
      onSuccess();
    } catch (error) {
      toast.show('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tạo đơn yêu cầu mới</h2>
              <p className="text-sm text-slate-500">Gửi yêu cầu nghỉ phép, làm thêm giờ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Loại đơn <span className="text-rose-500">*</span>
            </label>
            <select
              name="requestType"
              value={formData.requestType}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white text-slate-700"
            >
              <option value="NORMAL_LEAVE">
                Nghỉ phép {leaveQuota !== null ? `- Còn ${leaveQuota} ngày phép có lương` : ''}
              </option>
              <option value="HALF_DAY_LEAVE">Nghỉ nửa ngày</option>
              <option value="SPECIAL_WFH_LEAVE">Làm việc từ xa (WFH)</option>
              <option value="OVERTIME">Làm thêm giờ (Overtime)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Từ ngày <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors pl-10 text-slate-700"
                />
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Đến ngày <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors pl-10 text-slate-700"
                />
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Lý do chi tiết <span className="text-rose-500">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={4}
              placeholder="Vui lòng nêu rõ lý do..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none text-slate-700"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="flex-1"
              icon={CheckCircle2}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang gửi...' : 'Gửi đơn'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
