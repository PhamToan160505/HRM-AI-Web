import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Copy, CheckCircle2, X } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import api from '../../../services/api';

export default function JobPostingForm() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [createdJob, setCreatedJob] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    soLuongTuyen: '',
    diaDiem: '',
    hinhThucLamViec: 'FULL_TIME',
    ngayBatDau: '',
    hanNopHoSo: '',
    mucLuong: '',
    coThoaThuan: false,
    capBac: '',
    description: '',
    requirements: '',
    quyenLoi: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/api/recruitment/jobs', formData);
      
      if (res.data.success) {
        showNotification('Thành công', 'Đã tạo chiến dịch tuyển dụng mới', 'success');
        setCreatedJob(res.data.data);
      } else {
        showNotification('Lỗi', res.data.message || 'Có lỗi xảy ra', 'error');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không thể kết nối đến server';
      showNotification('Lỗi', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/public/apply/${createdJob.slug}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tạo chiến dịch tuyển dụng</h1>
          <p className="text-sm text-slate-500 mt-1">Điền thông tin chi tiết (JD) để AI dùng làm cơ sở chấm điểm ứng viên.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        
        {/* Section 1: Thông tin cơ bản */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Thông tin cơ bản</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vị trí tuyển dụng <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Số lượng cần tuyển <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                min="1"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.soLuongTuyen}
                onChange={(e) => setFormData({...formData, soLuongTuyen: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Cấp bậc
              </label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.capBac}
                onChange={(e) => setFormData({...formData, capBac: e.target.value})}
              >
                <option value="">-- Chọn cấp bậc --</option>
                <option value="INTERN">Thực tập sinh (Intern)</option>
                <option value="JUNIOR">Nhân viên (Junior)</option>
                <option value="MID">Chuyên viên (Mid-level)</option>
                <option value="SENIOR">Chuyên viên cao cấp (Senior)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hình thức làm việc <span className="text-red-500">*</span>
              </label>
              <select 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.hinhThucLamViec}
                onChange={(e) => setFormData({...formData, hinhThucLamViec: e.target.value})}
              >
                <option value="FULL_TIME">Toàn thời gian (Full-time)</option>
                <option value="PART_TIME">Bán thời gian (Part-time)</option>
                <option value="REMOTE">Làm việc từ xa (Remote)</option>
                <option value="HYBRID">Linh hoạt (Hybrid)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Địa điểm làm việc <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.diaDiem}
                onChange={(e) => setFormData({...formData, diaDiem: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mức lương
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  disabled={formData.coThoaThuan}
                  placeholder="VD: 10.000.000 - 15.000.000 VNĐ"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-50"
                  value={formData.coThoaThuan ? '' : formData.mucLuong}
                  onChange={(e) => setFormData({...formData, mucLuong: e.target.value})}
                />
                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.coThoaThuan}
                    onChange={(e) => setFormData({...formData, coThoaThuan: e.target.checked})}
                  />
                  <span className="text-sm text-slate-700">Thỏa thuận</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Thời gian bắt đầu nhận hồ sơ <span className="text-red-500">*</span>
              </label>
              <input 
                type="datetime-local" 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.ngayBatDau}
                onChange={(e) => setFormData({...formData, ngayBatDau: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hạn nộp hồ sơ <span className="text-red-500">*</span>
              </label>
              <input 
                type="datetime-local" 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={formData.hanNopHoSo}
                onChange={(e) => setFormData({...formData, hanNopHoSo: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Mô tả chi tiết */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Chi tiết tin tuyển dụng</h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mô tả công việc (JD) <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">AI sẽ dùng văn bản này để so khớp với CV ứng viên (Semantic Fit Score).</p>
            <textarea 
              required
              rows={6}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Yêu cầu công việc
            </label>
            <textarea 
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={formData.requirements}
              onChange={(e) => setFormData({...formData, requirements: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quyền lợi được hưởng
            </label>
            <textarea 
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={formData.quyenLoi}
              onChange={(e) => setFormData({...formData, quyenLoi: e.target.value})}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium disabled:opacity-70"
          >
            <Save size={18} />
            {loading ? 'Đang lưu...' : 'Lưu và Đăng tin'}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {createdJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Tạo chiến dịch thành công!</h3>
              <p className="text-sm text-slate-600">
                Chiến dịch tuyển dụng <span className="font-semibold">{createdJob.title}</span> đã được mở.
                Bạn có thể sao chép liên kết dưới đây và gửi cho ứng viên hoặc đăng lên các trang tuyển dụng.
              </p>
              
              <div className="mt-6 flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/public/apply/${createdJob.slug}`} 
                  className="flex-1 bg-transparent text-sm text-slate-700 outline-none px-2"
                />
                <button 
                  onClick={handleCopyLink}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {isCopied ? 'Đã copy' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => navigate('/manager/recruitment/campaigns')}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors text-sm"
              >
                Về danh sách chiến dịch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
