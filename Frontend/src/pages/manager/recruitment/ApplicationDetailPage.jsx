import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, ShieldAlert, Sparkles, Loader2, FileText } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import api, { apiAi } from '../../../services/api';

import ApplicationAttachmentsBlock from './components/ApplicationAttachmentsBlock';
import ApplicationPersonalInfoForm from './components/ApplicationPersonalInfoForm';
import CandidateExperienceList from './components/CandidateExperienceList';
import AIFitScoreCard from './components/AIFitScoreCard';
import AIFraudFlagCard from './components/AIFraudFlagCard';
import AIDecisionReasonModal from './components/AIDecisionReasonModal';
import AIInterviewQuestionsList from './components/AIInterviewQuestionsList';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extractedData, setExtractedData] = useState(null);
  const [aiLogs, setAiLogs] = useState([]);
  const [decisionLogModal, setDecisionLogModal] = useState({ isOpen: false, log: null });
  const [runningAi, setRunningAi] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const { role } = useAuth();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, status: null, currentLabel: '', newLabel: '' });
  const [submitModal, setSubmitModal] = useState({ isOpen: false, isPriority: false });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, reason: '' });

  useEffect(() => {
    const fetchApp = api.get(`/api/recruitment/applications/${id}`);
    const fetchLogs = api.get(`/api/recruitment/applications/${id}/ai-logs`);
    
    Promise.all([fetchApp, fetchLogs])
      .then(([appRes, logsRes]) => {
        if (appRes.data.success) {
          setApplication(appRes.data.data);
          try {
            if (appRes.data.data.extractedData) {
              setExtractedData(JSON.parse(appRes.data.data.extractedData));
            }
          } catch (e) { console.error("Parse JSON lỗi", e); }
        }
        if (logsRes.data.success) {
          setAiLogs(logsRes.data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleUpdateDecision = async (status) => {
    // legacy method, removed.
  };

  const executeSubmitToDirector = async () => {
    try {
      const res = await api.post(`/api/recruitment/applications/${id}/submit-to-director`, { isPriority: submitModal.isPriority });
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã trình lên Giám đốc', 'success');
        setSubmitModal({ isOpen: false, isPriority: false });
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể trình GĐ', 'error');
    }
  };

  const executeHrReject = async () => {
    try {
      const res = await api.post(`/api/recruitment/applications/${id}/reject-hr`);
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã loại hồ sơ', 'success');
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể loại hồ sơ', 'error');
    }
  };

  const executeDirectorApprove = async () => {
    try {
      const res = await api.post(`/api/recruitment/applications/${id}/approve-director`);
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã phê duyệt hồ sơ', 'success');
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể phê duyệt', 'error');
    }
  };

  const executeDirectorReject = async () => {
    if (!rejectModal.reason.trim()) {
      showNotification('Lỗi', 'Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    try {
      const res = await api.post(`/api/recruitment/applications/${id}/reject-director`, { reason: rejectModal.reason });
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã từ chối hồ sơ', 'success');
        setRejectModal({ isOpen: false, reason: '' });
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể từ chối', 'error');
    }
  };

  const handleRunAi = async () => {
    setRunningAi(true);
    try {
      const res = await apiAi.post(`/api/recruitment/applications/${id}/run-ai`);
      if (res.data.success) {
        const updated = res.data.data;
        setApplication(updated);
        try {
          if (updated.extractedData) setExtractedData(JSON.parse(updated.extractedData));
        } catch (e) { /* ignore */ }
        
        // Fetch lại logs mới sau khi AI chạy xong
        api.get(`/api/recruitment/applications/${id}/ai-logs`).then(lRes => {
           if (lRes.data.success) setAiLogs(lRes.data.data);
        });
        
        showNotification('Hoàn tất', 'AI đã đánh giá hồ sơ thành công!', 'success');
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'AI đánh giá thất bại';
      showNotification('Lỗi AI', msg, 'error');
    } finally {
      setRunningAi(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải hồ sơ...</div>;
  if (!application) return <div className="p-8 text-center text-rose-500">Không tìm thấy hồ sơ!</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Thông tin ứng viên</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ứng tuyển: <span className="font-medium text-slate-700">{application.jobPosting?.title}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Trạng thái:</span>
            <span className={`font-bold px-3 py-1.5 rounded-lg border text-sm ${
              {
                'PENDING_AI_REVIEW': 'bg-blue-50 text-blue-700 border-blue-200',
                'AI_EVALUATED':      'bg-indigo-50 text-indigo-700 border-indigo-200',
                'PENDING':           'bg-amber-50 text-amber-700 border-amber-200',
                'NEEDS_VERIFICATION':'bg-purple-50 text-purple-700 border-purple-200',
                'APPROVED':          'bg-emerald-50 text-emerald-700 border-emerald-200',
                'REJECTED':          'bg-rose-50 text-rose-700 border-rose-200',
              }[application.decisionStatus] || 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {application.approvalStatus === 'PENDING' && 'Chờ HR xử lý'}
              {application.approvalStatus === 'PENDING_DIRECTOR' && 'Chờ GĐ duyệt'}
              {application.approvalStatus === 'APPROVED' && 'Đã duyệt'}
              {application.approvalStatus === 'REJECTED' && 'Đã loại'}
            </span>
            {application.isPriority && (
              <span className="font-bold px-3 py-1.5 rounded-lg border text-sm bg-rose-50 text-rose-700 border-rose-200 ml-2">Ưu tiên</span>
            )}
            {application.needsVerification && (
              <span className="font-bold px-3 py-1.5 rounded-lg border text-sm bg-purple-50 text-purple-700 border-purple-200 ml-2">Cần xác minh</span>
            )}
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            {role === 'truong_phong' && application.approvalStatus === 'PENDING' && (
              <>
                <button 
                  onClick={() => setSubmitModal({ isOpen: true, isPriority: false })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  <Check size={16} /> Trình GĐ
                </button>
                <button 
                  onClick={executeHrReject}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                >
                  <X size={16} /> Loại
                </button>
              </>
            )}
            {role === 'giam_doc' && application.approvalStatus === 'PENDING_DIRECTOR' && (
              <>
                <button 
                  onClick={executeDirectorApprove}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                >
                  <Check size={16} /> Phê duyệt
                </button>
                <button 
                  onClick={() => setRejectModal({ isOpen: true, reason: '' })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                >
                  <X size={16} /> Từ chối
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAiDrawer(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 ml-2"
          >
            <Sparkles size={18} /> Chẩn đoán AI
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {application.approvalStatus === 'REJECTED' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <X className="text-rose-600 mt-0.5 shrink-0" size={20} />
          <div>
            <h3 className="text-rose-800 font-bold text-sm">Hồ sơ đã bị từ chối</h3>
            <p className="text-rose-700 text-sm mt-1">
              Lý do: {aiLogs.find(l => l.actionType === 'MANUAL_REJECTION')?.decisionReason || 'Không có lý do chi tiết.'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* CỘT TRÁI (Dữ liệu bóc tách) - Khoảng 45% */}
          <div className="lg:w-5/12 space-y-8 pr-4">
            <ApplicationAttachmentsBlock application={application} />
            <ApplicationPersonalInfoForm application={application} mode="manager" />
            
            <div className="w-full h-px bg-slate-100 my-8"></div>
            
            <CandidateExperienceList experienceList={extractedData?.experience || []} />
          </div>

          {/* Đường line chia cột (chỉ hiện trên màn hình lớn) */}
          <div className="hidden lg:block w-px bg-slate-100 shrink-0"></div>

          {/* CỘT PHẢI (Hiển thị file CV gốc) - Khoảng 55% */}
          <div className="lg:w-7/12 flex flex-col h-[800px]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Bản gốc CV
              </h3>
              {application.cvUrl && (
                <a href={application.cvUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                  Mở tab mới
                </a>
              )}
            </div>
            
            <div className="flex-1 min-h-0 rounded-xl border border-slate-200 shadow-inner bg-slate-50 overflow-hidden">
              {application.cvUrl ? (
                application.cvUrl.includes('mock.cloudinary.com') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                      <FileText size={40} className="text-slate-400" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-700">Dữ liệu mẫu (Mock Data)</h4>
                    <p className="text-slate-500 mt-2 max-w-sm">
                      Đây là hồ sơ được tạo tự động để test hệ thống. Không có file PDF thực tế được lưu trữ trên Cloudinary.
                    </p>
                    <p className="text-slate-500 mt-1 max-w-sm">
                      Vui lòng tự nộp một hồ sơ thực tế ở trang tuyển dụng để trải nghiệm trình xem PDF gốc.
                    </p>
                  </div>
                ) : application.cvUrl.toLowerCase().endsWith('.pdf') ? (
                  <embed 
                    src={`${application.cvUrl}${application.cvUrl.includes('#') ? '&' : '#'}navpanes=0&view=FitH`}
                    type="application/pdf"
                    className="w-full h-full block"
                    title="Candidate CV"
                  />
                ) : (
                  <div className="w-full h-full overflow-auto flex justify-center p-4">
                    <img src={application.cvUrl} alt="Candidate CV" className="max-w-full h-auto object-contain" />
                  </div>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-slate-500 font-medium">Không tìm thấy file CV đính kèm.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Drawer AI */}
      {showAiDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowAiDrawer(false)}></div>
          
          <div className="relative w-full max-w-md bg-slate-50 h-full shadow-2xl flex flex-col animate-slide-in-right">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 flex justify-between items-center text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-10 blur-xl"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/20 shadow-inner">
                  <Sparkles size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-wide">Chẩn đoán AI</h2>
                  <p className="text-indigo-100 text-xs mt-0.5">Phân tích CV tự động</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiDrawer(false)} 
                className="p-2 text-indigo-100 hover:text-white hover:bg-white/20 rounded-full transition-colors relative z-10"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
              {!application.extractedData && application.approvalStatus === 'PENDING' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Sparkles size={32} className="text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Hồ sơ chưa được đánh giá</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Bấm nút bên dưới để AI phân tích CV, chấm điểm và kiểm tra gian lận. Quá trình mất khoảng 10–20 giây.
                    </p>
                  </div>
                  <button
                    onClick={handleRunAi}
                    disabled={runningAi}
                    className="mt-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-md"
                  >
                    {runningAi ? (
                      <><Loader2 size={18} className="animate-spin" /> Đang phân tích...</>
                    ) : (
                      <><Sparkles size={18} /> Chạy AI ngay</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleRunAi}
                      disabled={runningAi}
                      className="flex items-center justify-center gap-2 w-full bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 disabled:text-slate-400 disabled:bg-slate-100 px-4 py-2.5 rounded-lg font-semibold transition-colors shadow-sm"
                    >
                      {runningAi ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang chạy lại...</>
                      ) : (
                        <><Sparkles size={16} /> Chạy lại AI đánh giá</>
                      )}
                    </button>
                  </div>
                  
                  <AIFitScoreCard 
                    fitScore={application.fitScore} 
                    decisionLog={[...aiLogs].reverse().find(l => l.actionType === 'FIT_SCORE') || { actionType: 'FIT_SCORE', decisionReason: 'Chưa có dữ liệu lý do', rawRequest: '', rawResponse: '' }}
                    onOpenReasonModal={(log) => setDecisionLogModal({ isOpen: true, log })}
                  />
                  
                  <AIFraudFlagCard 
                    isFraud={application.fraudFlagged} 
                    decisionLog={application.fraudFlagged ? ([...aiLogs].reverse().find(l => l.actionType === 'FRAUD_DETECTION') || { actionType: 'FRAUD_DETECTION', decisionReason: 'Chưa có dữ liệu lý do', rawRequest: '', rawResponse: '' }) : null}
                    onOpenReasonModal={(log) => setDecisionLogModal({ isOpen: true, log })}
                  />
                  
                  <AIInterviewQuestionsList questions={extractedData?.suggestedQuestions || []} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AIDecisionReasonModal 
        isOpen={decisionLogModal.isOpen} 
        onClose={() => setDecisionLogModal({ isOpen: false, log: null })}
        log={decisionLogModal.log}
      />

      {/* Submit To Director Modal */}
      {submitModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSubmitModal({ isOpen: false, isPriority: false })}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Trình Giám đốc phê duyệt</h3>
            <p className="text-sm text-slate-600 mb-4">Bạn sắp gửi hồ sơ này cho Giám đốc. Vui lòng xác nhận.</p>
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer mb-6 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={submitModal.isPriority} 
                onChange={(e) => setSubmitModal({ ...submitModal, isPriority: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Đánh dấu Ưu tiên (Gấp)
            </label>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSubmitModal({ isOpen: false, isPriority: false })}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button 
                onClick={executeSubmitToDirector}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                Gửi Giám đốc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Director Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRejectModal({ isOpen: false, reason: '' })}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Từ chối hồ sơ</h3>
            <p className="text-sm text-slate-600 mb-3">Vui lòng ghi rõ lý do từ chối để bộ phận nhân sự nắm thông tin.</p>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 min-h-[100px] mb-6 outline-none"
              placeholder="Ví dụ: Chưa đủ kinh nghiệm quản lý dự án..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRejectModal({ isOpen: false, reason: '' })}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button 
                onClick={executeDirectorReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg"
              >
                Xác nhận Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
