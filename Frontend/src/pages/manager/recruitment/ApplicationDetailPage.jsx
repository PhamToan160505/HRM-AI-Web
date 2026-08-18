import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, ShieldAlert, Sparkles, Loader2, FileText } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
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
    try {
      const res = await api.patch(`/api/recruitment/applications/${id}/decision`, { status });
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã cập nhật quyết định', 'success');
      }
    } catch (e) {
      showNotification('Lỗi', 'Lỗi hệ thống', 'error');
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
            <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              {application.decisionStatus}
            </span>
          </div>
          
          <button
            onClick={() => setShowAiDrawer(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <Sparkles size={18} /> Xem Đánh giá AI
          </button>
        </div>
      </div>

      {/* Main Content Area */}
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
            <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles size={24} />
                <h2 className="text-xl font-bold">Chẩn đoán AI</h2>
              </div>
              <button onClick={() => setShowAiDrawer(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!application.extractedData || application.decisionStatus === 'PENDING_AI_REVIEW' ? (
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
            
            {/* Vùng Action phê duyệt */}
            <div className="bg-white border-t border-slate-200 p-5 space-y-3">
               <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quyết định thủ công</p>
               <button 
                  onClick={() => { handleUpdateDecision('APPROVED'); setShowAiDrawer(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Check size={18} /> Duyệt hồ sơ
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { handleUpdateDecision('REJECTED'); setShowAiDrawer(false); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    <X size={18} /> Từ chối
                  </button>
                  <button 
                    onClick={() => { handleUpdateDecision('NEEDS_VERIFICATION'); setShowAiDrawer(false); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
                  >
                    <ShieldAlert size={16} /> Xác minh
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      <AIDecisionReasonModal 
        isOpen={decisionLogModal.isOpen} 
        onClose={() => setDecisionLogModal({ isOpen: false, log: null })}
        log={decisionLogModal.log}
      />
    </div>
  );
}
