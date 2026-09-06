import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/Toast';
import api from '../../../services/api';

export default function JobRequisitionForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (user?.role === 'ceo' || user?.role === 'admin') {
      api.get('/api/departments')
        .then(res => {
          if (res.data.success) {
            setDepartments(res.data.data);
          }
        })
        .catch(err => console.error("Error fetching departments", err));
    }
  }, [user]);

  const getDefaultRole = (role) => {
    if (role === 'ceo' || role === 'admin') return 'GIAM_DOC_PHONG_BAN';
    if (role === 'giam_doc_phong_ban') return 'TRUONG_PHONG';
    return 'NHAN_VIEN';
  };

  const roleOptions = () => {
    const role = user?.role;
    if (role === 'ceo' || role === 'admin') {
      return [
        { value: 'GIAM_DOC_PHONG_BAN', label: 'Giám đốc phòng ban' },
        { value: 'TRUONG_PHONG', label: 'Trưởng phòng' },
        { value: 'NHAN_VIEN', label: 'Nhân viên' }
      ];
    } else if (role === 'giam_doc_phong_ban') {
      return [
        { value: 'TRUONG_PHONG', label: 'Trưởng phòng' },
        { value: 'NHAN_VIEN', label: 'Nhân viên' }
      ];
    }
    return [{ value: 'NHAN_VIEN', label: 'Nhân viên' }];
  };

  const [formData, setFormData] = useState({
    title: '',
    targetRole: getDefaultRole(user?.role),
    soLuong: 1,
    reason: '',
    requirements: '',
    budgetMin: '',
    budgetMax: '',
    departmentId: user?.departmentId || null,
    capBac: '-- Chọn cấp bậc --',
    capBacKhac: '',
    hinhThucLamViec: 'Toàn thời gian (Full-time)',
    hinhThucLamViecKhac: '',
    description: ''
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Setup payload correctly
      const payload = {
        title: formData.title,
        targetRole: formData.targetRole,
        soLuong: formData.soLuong,
        reason: formData.reason,
        requirements: formData.requirements,
        description: formData.description,
        budget: (formData.budgetMin || formData.budgetMax) 
          ? `${formData.budgetMin || '0'} - ${formData.budgetMax || '0'} VNĐ` 
          : '',
        departmentId: formData.departmentId,
        capBac: formData.capBac === 'Khác' ? formData.capBacKhac : formData.capBac,
        hinhThucLamViec: formData.hinhThucLamViec === 'Khác' ? formData.hinhThucLamViecKhac : formData.hinhThucLamViec
      };
      
      const res = await api.post('/api/job-requisitions', payload);
      
      if (res.data.success) {
        if (user?.role === 'ceo' || user?.role === 'admin') {
          show('Thành công', 'Tạo yêu cầu tuyển dụng và tự động duyệt thành công', 'success');
        } else {
          show('Thành công', 'Đã gửi yêu cầu lên Tổng Giám đốc thành công', 'success');
        }
        // Xóa form
        setFormData({
          title: '',
          targetRole: getDefaultRole(user?.role),
          soLuong: 1,
          reason: '',
          requirements: '',
          budgetMin: '',
          budgetMax: '',
          description: '',
          departmentId: user?.departmentId || null,
          capBac: '-- Chọn cấp bậc --',
          capBacKhac: '',
          hinhThucLamViec: 'Toàn thời gian (Full-time)',
          hinhThucLamViecKhac: ''
        });
      }
    } catch (err) {
      show('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra khi tạo yêu cầu', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('../requisitions')}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tạo yêu cầu tuyển dụng</h1>
          <p className="text-slate-500 text-sm mt-1">
            Điền thông tin chi tiết về nhu cầu nhân sự để trình duyệt.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleCreateSubmit} className="space-y-6">
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Chức danh cụ thể (Tiêu đề) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                placeholder="VD: Lập trình viên Backend, Trưởng phòng Kinh doanh..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Cấp bậc <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.capBac} 
                  onChange={(e) => setFormData({...formData, capBac: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  <option value="-- Chọn cấp bậc --">-- Chọn cấp bậc --</option>
                  <option value="Thực tập sinh (Intern)">Thực tập sinh (Intern)</option>
                  <option value="Nhân viên (Junior)">Nhân viên (Junior)</option>
                  <option value="Chuyên viên (Mid-level)">Chuyên viên (Mid-level)</option>
                  <option value="Chuyên viên cao cấp (Senior)">Chuyên viên cao cấp (Senior)</option>
                  <option value="Quản lý (Manager)">Quản lý (Manager)</option>
                  <option value="Giám đốc (Director)">Giám đốc (Director)</option>
                  <option value="Khác">Khác</option>
                </select>
                {formData.capBac === 'Khác' && (
                  <input 
                    type="text"
                    required
                    value={formData.capBacKhac}
                    onChange={(e) => setFormData({...formData, capBacKhac: e.target.value})}
                    placeholder="Nhập cấp bậc khác..."
                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Hình thức làm việc <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.hinhThucLamViec} 
                  onChange={(e) => setFormData({...formData, hinhThucLamViec: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  <option value="Toàn thời gian (Full-time)">Toàn thời gian (Full-time)</option>
                  <option value="Bán thời gian (Part-time)">Bán thời gian (Part-time)</option>
                  <option value="Làm việc từ xa (Remote)">Làm việc từ xa (Remote)</option>
                  <option value="Linh hoạt (Hybrid)">Linh hoạt (Hybrid)</option>
                  <option value="Khác">Khác</option>
                </select>
                {formData.hinhThucLamViec === 'Khác' && (
                  <input 
                    type="text"
                    required
                    value={formData.hinhThucLamViecKhac}
                    onChange={(e) => setFormData({...formData, hinhThucLamViecKhac: e.target.value})}
                    placeholder="Nhập hình thức làm việc khác..."
                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Cấp bậc (Phân quyền duyệt) <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.targetRole} 
                  onChange={(e) => setFormData({...formData, targetRole: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  {roleOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Số lượng <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  value={formData.soLuong} 
                  onChange={(e) => setFormData({...formData, soLuong: parseInt(e.target.value)})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors" 
                />
              </div>
            </div>

            {(user.role === 'ceo' || user.role === 'admin') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phòng ban <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.departmentId || ''} 
                  onChange={(e) => setFormData({...formData, departmentId: e.target.value ? parseInt(e.target.value) : null})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.tenPhong}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Lý do tuyển <span className="text-red-500">*</span>
              </label>
              <textarea 
                required 
                rows={3} 
                value={formData.reason} 
                onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                placeholder="Nêu rõ lý do cần bổ sung nhân sự..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Mô tả công việc (JD) <span className="text-red-500">*</span>
              </label>
              <textarea 
                required 
                rows={5} 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                placeholder="Mô tả chi tiết các công việc cần làm..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Yêu cầu sơ bộ <span className="text-slate-400 font-normal">(Tùy chọn)</span>
              </label>
              <textarea 
                rows={2} 
                value={formData.requirements} 
                onChange={(e) => setFormData({...formData, requirements: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                placeholder="Yêu cầu bằng cấp, kỹ năng cơ bản..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Ngân sách dự kiến <span className="text-slate-400 font-normal">(Tùy chọn)</span>
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="text" 
                  value={formData.budgetMin} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\./g, '');
                    const formatted = val.replace(/\d+/g, (match) => {
                      return parseInt(match, 10).toLocaleString('vi-VN');
                    });
                    setFormData({...formData, budgetMin: formatted});
                  }} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors" 
                  placeholder="Từ (VD: 15.000.000)"
                />
                <span className="text-slate-500 font-medium">-</span>
                <input 
                  type="text" 
                  value={formData.budgetMax} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\./g, '');
                    const formatted = val.replace(/\d+/g, (match) => {
                      return parseInt(match, 10).toLocaleString('vi-VN');
                    });
                    setFormData({...formData, budgetMax: formatted});
                  }} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors" 
                  placeholder="Đến (VD: 20.000.000)"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => navigate('../requisitions')} 
                className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {loading ? 'Đang lưu...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
