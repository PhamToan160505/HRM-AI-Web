import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/Toast';
import api from '../../../services/api';

const CAP_BAC_PLACEHOLDER = '-- Chọn cấp bậc --';

const countWords = (value) => value.trim().split(/\s+/).filter(Boolean).length;

const parseBudget = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const formatBudget = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
};

export default function JobRequisitionForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});

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
    capBac: CAP_BAC_PLACEHOLDER,
    capBacKhac: '',
    hinhThucLamViec: 'Toàn thời gian (Full-time)',
    hinhThucLamViecKhac: '',
    description: ''
  });

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = 'Vui lòng nhập chức danh cụ thể.';
    }
    if (formData.capBac === CAP_BAC_PLACEHOLDER) {
      nextErrors.capBac = 'Vui lòng chọn cấp bậc.';
    }
    if (formData.capBac === 'Khác' && !formData.capBacKhac.trim()) {
      nextErrors.capBacKhac = 'Vui lòng nhập cấp bậc khác.';
    }
    if (formData.hinhThucLamViec === 'Khác' && !formData.hinhThucLamViecKhac.trim()) {
      nextErrors.hinhThucLamViecKhac = 'Vui lòng nhập hình thức làm việc khác.';
    }
    if (!Number.isInteger(Number(formData.soLuong)) || Number(formData.soLuong) <= 0) {
      nextErrors.soLuong = 'Số lượng phải là số nguyên lớn hơn 0.';
    }
    if ((user?.role === 'ceo' || user?.role === 'admin') && !formData.departmentId) {
      nextErrors.departmentId = 'Vui lòng chọn phòng ban.';
    }
    if (!formData.reason.trim()) {
      nextErrors.reason = 'Vui lòng nhập lý do tuyển.';
    }

    const descriptionWordCount = countWords(formData.description);
    if (!formData.description.trim()) {
      nextErrors.description = 'Vui lòng nhập mô tả công việc (JD).';
    } else if (descriptionWordCount < 10) {
      nextErrors.description = `Mô tả công việc phải có ít nhất 10 từ (hiện tại ${descriptionWordCount} từ).`;
    }

    const hasBudget = Boolean(formData.budgetMin || formData.budgetMax);
    if (hasBudget) {
      const budgetMin = parseBudget(formData.budgetMin);
      const budgetMax = parseBudget(formData.budgetMax);

      if (budgetMin <= 0) {
        nextErrors.budgetMin = 'Ngân sách tối thiểu phải lớn hơn 0.';
      }
      if (budgetMax <= 0) {
        nextErrors.budgetMax = 'Ngân sách tối đa phải lớn hơn 0.';
      }
      if (budgetMin > 0 && budgetMax > 0 && budgetMin > budgetMax) {
        nextErrors.budgetMax = 'Ngân sách tối đa phải lớn hơn hoặc bằng mức tối thiểu.';
      }
    }

    return nextErrors;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
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
          capBac: CAP_BAC_PLACEHOLDER,
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
          <form onSubmit={handleCreateSubmit} noValidate className="space-y-6">
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Chức danh cụ thể (Tiêu đề) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required 
                value={formData.title} 
                onChange={(e) => updateField('title', e.target.value)}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'title-error' : undefined}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                placeholder="VD: Lập trình viên Backend, Trưởng phòng Kinh doanh..."
              />
              {errors.title && <p id="title-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.title}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Cấp bậc <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.capBac} 
                  onChange={(e) => updateField('capBac', e.target.value)}
                  aria-invalid={Boolean(errors.capBac)}
                  aria-describedby={errors.capBac ? 'cap-bac-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.capBac ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
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
                {errors.capBac && <p id="cap-bac-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.capBac}</p>}
                {formData.capBac === 'Khác' && (
                  <>
                    <input
                      type="text"
                      required
                      value={formData.capBacKhac}
                      onChange={(e) => updateField('capBacKhac', e.target.value)}
                      aria-invalid={Boolean(errors.capBacKhac)}
                      aria-describedby={errors.capBacKhac ? 'cap-bac-khac-error' : undefined}
                      placeholder="Nhập cấp bậc khác..."
                      className={`mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.capBacKhac ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                    />
                    {errors.capBacKhac && <p id="cap-bac-khac-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.capBacKhac}</p>}
                  </>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Hình thức làm việc <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.hinhThucLamViec} 
                  onChange={(e) => updateField('hinhThucLamViec', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  <option value="Toàn thời gian (Full-time)">Toàn thời gian (Full-time)</option>
                  <option value="Bán thời gian (Part-time)">Bán thời gian (Part-time)</option>
                  <option value="Làm việc từ xa (Remote)">Làm việc từ xa (Remote)</option>
                  <option value="Linh hoạt (Hybrid)">Linh hoạt (Hybrid)</option>
                  <option value="Khác">Khác</option>
                </select>
                {formData.hinhThucLamViec === 'Khác' && (
                  <>
                    <input
                      type="text"
                      required
                      value={formData.hinhThucLamViecKhac}
                      onChange={(e) => updateField('hinhThucLamViecKhac', e.target.value)}
                      aria-invalid={Boolean(errors.hinhThucLamViecKhac)}
                      aria-describedby={errors.hinhThucLamViecKhac ? 'hinh-thuc-khac-error' : undefined}
                      placeholder="Nhập hình thức làm việc khác..."
                      className={`mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.hinhThucLamViecKhac ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                    />
                    {errors.hinhThucLamViecKhac && <p id="hinh-thuc-khac-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.hinhThucLamViecKhac}</p>}
                  </>
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
                  step="1"
                  required 
                  value={formData.soLuong} 
                  onChange={(e) => updateField('soLuong', e.target.value === '' ? '' : Number(e.target.value))}
                  aria-invalid={Boolean(errors.soLuong)}
                  aria-describedby={errors.soLuong ? 'so-luong-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.soLuong ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                />
                {errors.soLuong && <p id="so-luong-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.soLuong}</p>}
              </div>
            </div>

            {(user.role === 'ceo' || user.role === 'admin') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phòng ban <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.departmentId || ''} 
                  onChange={(e) => updateField('departmentId', e.target.value ? parseInt(e.target.value, 10) : null)}
                  aria-invalid={Boolean(errors.departmentId)}
                  aria-describedby={errors.departmentId ? 'department-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.departmentId ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.tenPhong}</option>
                  ))}
                </select>
                {errors.departmentId && <p id="department-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.departmentId}</p>}
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
                onChange={(e) => updateField('reason', e.target.value)}
                aria-invalid={Boolean(errors.reason)}
                aria-describedby={errors.reason ? 'reason-error' : undefined}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.reason ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                placeholder="Nêu rõ lý do cần bổ sung nhân sự..."
              />
              {errors.reason && <p id="reason-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.reason}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Mô tả công việc (JD) <span className="text-red-500">*</span>
              </label>
              <textarea 
                required 
                rows={5} 
                value={formData.description} 
                onChange={(e) => updateField('description', e.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'description-error' : 'description-hint'}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                placeholder="Mô tả chi tiết nhiệm vụ, trách nhiệm và kết quả mong đợi..."
              />
              <div className="mt-1.5 flex items-start justify-between gap-4">
                <div>
                  {errors.description ? (
                    <p id="description-error" className="text-xs font-medium text-red-600">{errors.description}</p>
                  ) : (
                    <p id="description-hint" className="text-xs text-slate-400">Nội dung tối thiểu 10 từ để AI có đủ dữ liệu phân tích.</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs ${formData.description && countWords(formData.description) < 10 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {countWords(formData.description)}/10 từ
                </span>
              </div>
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
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.budgetMin}
                    onChange={(e) => updateField('budgetMin', formatBudget(e.target.value))}
                    aria-invalid={Boolean(errors.budgetMin)}
                    aria-describedby={errors.budgetMin ? 'budget-min-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.budgetMin ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                    placeholder="Từ (VD: 15.000.000)"
                  />
                  {errors.budgetMin && <p id="budget-min-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.budgetMin}</p>}
                </div>
                <span className="pt-2 text-slate-500 font-medium">-</span>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.budgetMax}
                    onChange={(e) => updateField('budgetMax', formatBudget(e.target.value))}
                    aria-invalid={Boolean(errors.budgetMax)}
                    aria-describedby={errors.budgetMax ? 'budget-max-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.budgetMax ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'}`}
                    placeholder="Đến (VD: 20.000.000)"
                  />
                  {errors.budgetMax && <p id="budget-max-error" className="mt-1.5 text-xs font-medium text-red-600">{errors.budgetMax}</p>}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Chỉ nhập số dương; hệ thống sẽ tự định dạng theo VNĐ.</p>
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
