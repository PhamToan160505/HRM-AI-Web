import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Copy, CheckCircle2, X } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import api from '../../../services/api';

const getMinStartDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getMinEndDate = (startDateStr) => {
  if (!startDateStr) return getMinStartDate();
  const startDate = new Date(startDateStr);
  startDate.setDate(startDate.getDate() + 1);
  
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  const hours = String(startDate.getHours()).padStart(2, '0');
  const minutes = String(startDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function JobPostingForm() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [createdJob, setCreatedJob] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [errors, setErrors] = useState({});
  const [requisitions, setRequisitions] = useState([]);

  const location = useLocation();
  const prefillReq = location.state?.reqData;
  const searchParams = new URLSearchParams(location.search);
  const isReopen = searchParams.get('reopen') === 'true';

  const standardCapBac = ['', '-- Chọn cấp bậc --', 'Thực tập sinh (Intern)', 'Nhân viên (Junior)', 'Chuyên viên (Mid-level)', 'Chuyên viên cao cấp (Senior)', 'Quản lý (Manager)', 'Giám đốc (Director)'];
  const standardHinhThuc = ['Toàn thời gian (Full-time)', 'Bán thời gian (Part-time)', 'Làm việc từ xa (Remote)', 'Linh hoạt (Hybrid)'];

  const initCapBac = prefillReq?.capBac || '';
  const isCustomCapBac = initCapBac && !standardCapBac.includes(initCapBac);

  const initHinhThuc = prefillReq?.hinhThucLamViec || 'Toàn thời gian (Full-time)';
  const isCustomHinhThuc = initHinhThuc && !standardHinhThuc.includes(initHinhThuc);

  const [formData, setFormData] = useState({
    title: prefillReq ? prefillReq.title : '',
    soLuongTuyen: prefillReq ? prefillReq.soLuong : '',
    diaDiem: '',
    hinhThucLamViec: isCustomHinhThuc ? 'Khác' : initHinhThuc,
    hinhThucLamViecKhac: isCustomHinhThuc ? initHinhThuc : '',
    ngayBatDau: '',
    hanNopHoSo: '',
    mucLuong: prefillReq ? prefillReq.budget || '' : '',
    coThoaThuan: false,
    capBac: isCustomCapBac ? 'Khác' : initCapBac,
    capBacKhac: isCustomCapBac ? initCapBac : '',
    description: prefillReq ? prefillReq.description || '' : '',
    requirements: prefillReq ? prefillReq.requirements || '' : '',
    quyenLoi: '',
    targetRole: prefillReq ? prefillReq.targetRole : 'NHAN_VIEN',
    departmentId: prefillReq ? prefillReq.departmentId : '',
    jobRequisitionId: prefillReq ? prefillReq.id : ''
  });

  useEffect(() => {
    if (isEditMode) {
      const fetchJobData = async () => {
        try {
          const res = await api.get(`/api/recruitment/jobs/${id}`);
          if (res.data.success) {
            const data = res.data.data;
            const fetchedCapBac = data.capBac || '';
            const isFetchedCustomCapBac = fetchedCapBac && !standardCapBac.includes(fetchedCapBac);
            
            const fetchedHinhThuc = data.hinhThucLamViec || 'Toàn thời gian (Full-time)';
            const isFetchedCustomHinhThuc = fetchedHinhThuc && !standardHinhThuc.includes(fetchedHinhThuc);

            setFormData({
              title: data.title || '',
              soLuongTuyen: data.soLuongTuyen || '',
              diaDiem: data.diaDiem || '',
              hinhThucLamViec: isFetchedCustomHinhThuc ? 'Khác' : fetchedHinhThuc,
              hinhThucLamViecKhac: isFetchedCustomHinhThuc ? fetchedHinhThuc : '',
              ngayBatDau: data.ngayBatDau ? data.ngayBatDau.substring(0, 16) : '',
              hanNopHoSo: data.hanNopHoSo ? data.hanNopHoSo.substring(0, 16) : '',
              mucLuong: data.mucLuong || '',
              coThoaThuan: data.coThoaThuan || false,
              capBac: isFetchedCustomCapBac ? 'Khác' : fetchedCapBac,
              capBacKhac: isFetchedCustomCapBac ? fetchedCapBac : '',
              description: data.description || '',
              requirements: data.requirements || '',
              quyenLoi: data.quyenLoi || ''
            });
          }
        } catch (err) {
          showNotification('Lỗi', 'Không thể tải dữ liệu chiến dịch', 'error');
          navigate('/manager/recruitment/campaigns');
        } finally {
          setInitialLoading(false);
        }
      };
      fetchJobData();
    }
    
    // Fetch approved requisitions for creation mode
    if (!isEditMode) {
      const fetchReqs = async () => {
        try {
          const res = await api.get('/api/job-requisitions');
          if (res.data.success) {
            setRequisitions(res.data.data.filter(r => r.status === 'APPROVED'));
          }
        } catch (err) {}
      };
      fetchReqs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  const handleRequisitionSelect = (reqId) => {
    const req = requisitions.find(r => r.id === Number(reqId));
    if (req) {
      const initCapBac = req.capBac || '';
      const isCustomCapBac = initCapBac && !standardCapBac.includes(initCapBac);
      const initHinhThuc = req.hinhThucLamViec || 'Toàn thời gian (Full-time)';
      const isCustomHinhThuc = initHinhThuc && !standardHinhThuc.includes(initHinhThuc);

      setFormData({
        ...formData,
        jobRequisitionId: req.id,
        title: req.title,
        targetRole: req.targetRole,
        departmentId: req.departmentId,
        soLuongTuyen: req.soLuong,
        mucLuong: req.budget || '',
        requirements: req.requirements || '',
        description: req.description || '',
        capBac: isCustomCapBac ? 'Khác' : initCapBac,
        capBacKhac: isCustomCapBac ? initCapBac : '',
        hinhThucLamViec: isCustomHinhThuc ? 'Khác' : initHinhThuc,
        hinhThucLamViecKhac: isCustomHinhThuc ? initHinhThuc : ''
      });
      if (errors.title) setErrors({...errors, title: null});
      if (errors.soLuongTuyen) setErrors({...errors, soLuongTuyen: null});
    } else {
      setFormData({
        ...formData,
        jobRequisitionId: '',
        title: '',
        soLuongTuyen: '',
        requirements: ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Vui lòng nhập vị trí tuyển dụng';
    
    if (!formData.soLuongTuyen) {
      newErrors.soLuongTuyen = 'Vui lòng nhập số lượng cần tuyển';
    } else if (isNaN(formData.soLuongTuyen) || Number(formData.soLuongTuyen) <= 0) {
      newErrors.soLuongTuyen = 'Số lượng cần tuyển phải là một số lớn hơn 0';
    }

    if (!formData.hinhThucLamViec) newErrors.hinhThucLamViec = 'Vui lòng chọn hình thức làm việc';
    if (!formData.diaDiem.trim()) newErrors.diaDiem = 'Vui lòng nhập địa điểm làm việc';
    if (!formData.ngayBatDau) {
      newErrors.ngayBatDau = 'Vui lòng chọn thời gian bắt đầu';
    } else if (!isEditMode || isReopen) {
      // Chỉ kiểm tra quá khứ khi tạo mới hoặc mở lại đợt
      const minStart = getMinStartDate();
      if (formData.ngayBatDau < minStart) {
        newErrors.ngayBatDau = 'Thời gian bắt đầu không được trong quá khứ';
      }
    }
    
    if (!formData.hanNopHoSo) {
      newErrors.hanNopHoSo = 'Vui lòng chọn hạn nộp hồ sơ';
    } else if (formData.ngayBatDau) {
      const minEnd = getMinEndDate(formData.ngayBatDau);
      if (formData.hanNopHoSo < minEnd) {
        newErrors.hanNopHoSo = 'Hạn nộp hồ sơ phải sau thời gian bắt đầu ít nhất 1 ngày';
      }
    }
    if (!formData.description.trim()) newErrors.description = 'Vui lòng nhập mô tả công việc (JD)';
    
    if (!formData.coThoaThuan && formData.mucLuong && formData.mucLuong.trim().startsWith('-')) {
      newErrors.mucLuong = 'Mức lương không hợp lệ (không được là số âm)';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      showNotification('Lỗi', 'Vui lòng điền đầy đủ các trường bắt buộc', 'error');
      return;
    }
    
    setErrors({});

    try {
      let payload = {
        ...formData,
        capBac: formData.capBac === 'Khác' ? formData.capBacKhac : formData.capBac,
        hinhThucLamViec: formData.hinhThucLamViec === 'Khác' ? formData.hinhThucLamViecKhac : formData.hinhThucLamViec
      };

      let res;
      if (isEditMode) {
        res = await api.put(`/api/recruitment/jobs/${id}`, payload);
      } else {
        res = await api.post('/api/recruitment/jobs', payload);
      }
      
      if (res.data.success) {
        if (isReopen) {
          await api.patch(`/api/recruitment/jobs/${id}/status`, { status: 'OPEN' });
        }
        showNotification('Thành công', isReopen ? 'Đã mở lại chiến dịch' : (isEditMode ? 'Đã cập nhật chiến dịch' : 'Đã tạo chiến dịch tuyển dụng mới'), 'success');
        if (isEditMode) {
          navigate('/manager/recruitment/campaigns');
        } else {
          setCreatedJob(res.data.data);
        }
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

  if (initialLoading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Đang tải dữ liệu...</div>;
  }

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
          <h1 className="text-2xl font-bold text-slate-800">
            {isReopen ? 'Mở lại chiến dịch tuyển dụng' : (isEditMode ? 'Sửa chiến dịch tuyển dụng' : 'Tạo chiến dịch tuyển dụng')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Điền thông tin chi tiết (JD) để AI dùng làm cơ sở chấm điểm ứng viên.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        
        {/* Section 1: Thông tin cơ bản */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Thông tin cơ bản</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isEditMode && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Chọn từ Yêu cầu tuyển dụng đã duyệt
                </label>
                <select 
                  value={formData.jobRequisitionId}
                  onChange={(e) => handleRequisitionSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Tạo tự do (Không liên kết) --</option>
                  {requisitions.map(req => (
                    <option key={req.id} value={req.id}>{req.title}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vị trí tuyển dụng <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.title ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.title}
                onChange={(e) => {
                  setFormData({...formData, title: e.target.value});
                  if (errors.title) setErrors({...errors, title: null});
                }}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Số lượng cần tuyển <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                min="1"
                required
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.soLuongTuyen ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.soLuongTuyen}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  setFormData({...formData, soLuongTuyen: e.target.value});
                  if (errors.soLuongTuyen) setErrors({...errors, soLuongTuyen: null});
                }}
              />
              {errors.soLuongTuyen && <p className="mt-1 text-xs text-red-500">{errors.soLuongTuyen}</p>}
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
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hình thức làm việc <span className="text-red-500">*</span>
              </label>
              <select 
                required
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.hinhThucLamViec ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.hinhThucLamViec}
                onChange={(e) => {
                  setFormData({...formData, hinhThucLamViec: e.target.value});
                  if (errors.hinhThucLamViec) setErrors({...errors, hinhThucLamViec: null});
                }}
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
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              )}
              {errors.hinhThucLamViec && <p className="mt-1 text-xs text-red-500">{errors.hinhThucLamViec}</p>}
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
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.diaDiem ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.diaDiem}
                onChange={(e) => {
                  setFormData({...formData, diaDiem: e.target.value});
                  if (errors.diaDiem) setErrors({...errors, diaDiem: null});
                }}
              />
              {errors.diaDiem && <p className="mt-1 text-xs text-red-500">{errors.diaDiem}</p>}
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
                  className={`flex-1 px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-50 ${errors.mucLuong ? 'border-red-500' : 'border-slate-200'}`}
                  value={formData.coThoaThuan ? '' : formData.mucLuong}
                  onChange={(e) => {
                    setFormData({...formData, mucLuong: e.target.value});
                    if (errors.mucLuong) setErrors({...errors, mucLuong: null});
                  }}
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
              {errors.mucLuong && <p className="mt-1 text-xs text-red-500">{errors.mucLuong}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Thời gian bắt đầu nhận hồ sơ <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, ngayBatDau: getMinStartDate()})}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Hôm nay
                </button>
              </div>
              <input 
                type="datetime-local" 
                required
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.ngayBatDau ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.ngayBatDau}
                onChange={(e) => {
                  setFormData({...formData, ngayBatDau: e.target.value});
                  if (errors.ngayBatDau) setErrors({...errors, ngayBatDau: null});
                }}
              />
              {errors.ngayBatDau && <p className="mt-1 text-xs text-red-500">{errors.ngayBatDau}</p>}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Hạn nộp hồ sơ <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, hanNopHoSo: getMinEndDate(formData.ngayBatDau || getMinStartDate())})}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Gợi ý (+1 ngày)
                </button>
              </div>
              <input 
                type="datetime-local" 
                required
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.hanNopHoSo ? 'border-red-500' : 'border-slate-200'}`}
                value={formData.hanNopHoSo}
                onChange={(e) => {
                  setFormData({...formData, hanNopHoSo: e.target.value});
                  if (errors.hanNopHoSo) setErrors({...errors, hanNopHoSo: null});
                }}
              />
              {errors.hanNopHoSo && <p className="mt-1 text-xs text-red-500">{errors.hanNopHoSo}</p>}
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
            <p className="text-xs text-slate-500 mb-2">AI sẽ dùng văn bản này để so khớp với CV ứng viên (Điểm phù hợp AI).</p>
            <textarea 
              required
              rows={6}
              className={`w-full px-4 py-3 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.description ? 'border-red-500' : 'border-slate-200'}`}
              value={formData.description}
              onChange={(e) => {
                setFormData({...formData, description: e.target.value});
                if (errors.description) setErrors({...errors, description: null});
              }}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
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
            {loading ? 'Đang lưu...' : (isReopen ? 'Lưu và Mở lại đợt' : (isEditMode ? 'Lưu cập nhật' : 'Lưu và Đăng tin'))}
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
