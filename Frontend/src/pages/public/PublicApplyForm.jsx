import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle2, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

// Components
import ApplicationPersonalInfoForm from '../manager/recruitment/components/ApplicationPersonalInfoForm';

export default function PublicApplyForm() {
  const { jobSlug } = useParams();
  const { showNotification } = useNotification();
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [step, setStep] = useState(1);
  const [cvFile, setCvFile] = useState(null);
  const [cccdFile, setCccdFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/public/apply/${jobSlug}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJob(data.data);
        } else {
          setErrorMsg(data.message || 'URL không hợp lệ hoặc tin tuyển dụng đã bị đóng.');
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('Lỗi kết nối đến máy chủ.');
        setLoading(false);
      });
  }, [jobSlug]);

  const handleNextToStep2 = () => {
    if (!cvFile) {
      showNotification('Lỗi', 'Vui lòng upload CV của bạn', 'error');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (formData) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('fullName', formData.fullName);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      if (cvFile) data.append('cvFile', cvFile);
      if (cccdFile) data.append('cccdFile', cccdFile);
      
      // Backend sẽ tự động đọc file PDF để trích xuất chữ. Frontend không cần gửi rawCvText giả nữa.
      data.append('rawCvText', '');
      
      // Gửi toàn bộ thông tin ứng viên đã nhập làm extractedData ban đầu
      const formattedData = {};
      Object.keys(formData).forEach(key => {
        formattedData[key] = { value: formData[key], confidence: 100 };
      });
      data.append('extractedData', JSON.stringify(formattedData));

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/public/apply/${jobSlug}`, {
        method: 'POST',
        body: data
      });
      const result = await res.json();
      
      if (result.success) {
        setStep(3);
      } else {
        showNotification('Lỗi', result.message || 'Lỗi nộp hồ sơ', 'error');
      }
    } catch (err) {
      showNotification('Lỗi', 'Lỗi kết nối', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  
  if (!job) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full">
        <h2 className="text-xl font-bold text-rose-600 mb-2">Thông báo</h2>
        <p className="text-slate-600">{errorMsg || 'Không tìm thấy tin tuyển dụng.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-md">
            <Building2 size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Ứng tuyển vị trí</h1>
            <h2 className="text-xl text-blue-600 font-semibold mt-1">{job.title}</h2>
            {job.hanNopHoSo && (
              <p className="text-sm font-medium text-rose-600 mt-2">
                Hạn nộp: {new Date(job.hanNopHoSo).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
        </div>

        {/* Job Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block mb-1">Cấp bậc</span>
              <span className="font-semibold text-slate-800">{job.capBac}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block mb-1">Hình thức</span>
              <span className="font-semibold text-slate-800">{job.hinhThucLamViec}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block mb-1">Mức lương</span>
              <span className="font-semibold text-slate-800">{job.coThoaThuan ? 'Thoả thuận' : job.mucLuong}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block mb-1">Địa điểm</span>
              <span className="font-semibold text-slate-800">{job.diaDiem}</span>
            </div>
          </div>

          <div className="space-y-4">
            {job.description && (
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Mô tả công việc</h3>
                <div className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                  {job.description}
                </div>
              </div>
            )}
            
            {job.requirements && (
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Yêu cầu công việc</h3>
                <div className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                  {job.requirements}
                </div>
              </div>
            )}
            
            {job.quyenLoi && (
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Quyền lợi</h3>
                <div className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                  {job.quyenLoi}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>1</span>
            <span className="font-medium text-sm hidden sm:block">Tải lên hồ sơ</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200">
            <div className={`h-full bg-blue-600 transition-all ${step >= 2 ? 'w-full' : 'w-0'}`}></div>
          </div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>2</span>
            <span className="font-medium text-sm hidden sm:block">Xác nhận thông tin</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200">
            <div className={`h-full bg-blue-600 transition-all ${step >= 3 ? 'w-full' : 'w-0'}`}></div>
          </div>
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>3</span>
            <span className="font-medium text-sm hidden sm:block">Hoàn tất</span>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 text-center mb-6">Bạn đã sẵn sàng gia nhập HRM AI?</h3>
            
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 block mb-2">Tải lên CV (Bắt buộc)</span>
                <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center hover:bg-blue-50 transition-colors cursor-pointer relative">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Upload size={32} className="text-blue-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-blue-700">
                    {cvFile ? cvFile.name : 'Nhấn để chọn file hoặc kéo thả vào đây'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Hỗ trợ PDF, DOCX (Tối đa 5MB)</p>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 block mb-2">Tải lên Ảnh CCCD/CMND (Tuỳ chọn)</span>
                <div className="border border-slate-200 rounded-lg p-4 flex items-center gap-4">
                  <input type="file" accept="image/*" onChange={(e) => setCccdFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
              </label>
            </div>

            <div className="pt-6 flex justify-end">
              <button 
                onClick={handleNextToStep2}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Tiếp tục <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirm Info */}
        {step === 2 && (
          <div className="space-y-6 relative">
            {submitting && (
              <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-xl">
                <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3 font-medium text-blue-600">
                  <Loader2 className="animate-spin" size={24} /> Hệ thống đang gửi hồ sơ...
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm text-center">
              Hệ thống đã nhận được CV của bạn. Vui lòng điền thêm hoặc kiểm tra các thông tin liên lạc cơ bản trước khi nộp.
            </div>

            <ApplicationPersonalInfoForm 
              mode="public" 
              initialData={{ fullName: { value: '' } }} // Form trống, chờ User điền
              onSave={handleSubmit}
            />
            
            <div className="text-center">
              <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                Quay lại bước tải CV
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Nộp hồ sơ thành công!</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              Hồ sơ của bạn đã được gửi đến bộ phận Tuyển dụng và đang được Trí tuệ Nhân tạo (AI) của chúng tôi phân tích sơ bộ. Chúng tôi sẽ phản hồi qua Email trong thời gian sớm nhất.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
