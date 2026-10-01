import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Sparkles, Loader2, FileText, XCircle } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import api, { apiAi } from '../../../services/api';

import ApplicationAttachmentsBlock from './components/ApplicationAttachmentsBlock';
import ApplicationPersonalInfoForm from './components/ApplicationPersonalInfoForm';
import CandidateExperienceList from './components/CandidateExperienceList';
import AIDecisionReasonModal from './components/AIDecisionReasonModal';
import AIInterviewQuestionsList from './components/AIInterviewQuestionsList';
import InterviewPanel from './components/InterviewPanel';
import OfferComposer from './components/OfferComposer';
import OfferReviewPanel from './components/OfferReviewPanel';
import OfferActivityCard from './components/OfferActivityCard';
import {
  buildOfferDetails,
  createEmptyOfferFields,
  legacyAllowancesFromFields,
  offerToFields,
  validateOfferFields,
} from '../../../utils/offer';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extractedData, setExtractedData] = useState(null);
  const [, setAiLogs] = useState([]);
  const [aiAnalyses, setAiAnalyses] = useState([]);
  const [decisionLogModal, setDecisionLogModal] = useState({ isOpen: false, log: null });
  const [runningAi, setRunningAi] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const { role, user } = useAuth();
  const [submitModal, setSubmitModal] = useState({ isOpen: false, isPriority: false });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, reason: '' });
  const [offerLink, setOfferLink] = useState('');
  const [offerHistory, setOfferHistory] = useState([]);
  const [offerActivity, setOfferActivity] = useState([]);
  const [offerModalLoading, setOfferModalLoading] = useState(false);
  const [approveActionLoading, setApproveActionLoading] = useState(false);
  const latestAi = aiAnalyses[0];
  const aiComputedResult = latestAi?.computedResult || {};
  const aiCriteria = Array.isArray(aiComputedResult.criteria) ? aiComputedResult.criteria : [];
  const aiFlags = Array.isArray(aiComputedResult.flags) ? aiComputedResult.flags : [];
  const aiVerifyPoints = Array.isArray(aiComputedResult.verify_points) ? aiComputedResult.verify_points : [];
  const [approveModal, setApproveModal] = useState({ 
    isOpen: false, 
    feedback: '', 
    fields: createEmptyOfferFields()
  });

  const emptyOfferFields = () => createEmptyOfferFields(application);

  const openApproveModal = async () => {
    const state = application?.approvalStatus;
    setApproveModal({ isOpen: true, feedback: '', fields: createEmptyOfferFields(application) });
    if (!['PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL', 'OFFER_INTERNALLY_APPROVED', 'OFFER_EXPIRED'].includes(state)) return;

    setOfferModalLoading(true);
    try {
      const [offersResponse, departmentsResponse] = await Promise.all([
        api.get(`/api/recruitment/applications/${id}/offers`),
        api.get('/api/departments'),
      ]);
      const offers = offersResponse.data.data || [];
      const departments = departmentsResponse.data.data || [];
      const departmentName = departments.find(item => Number(item.id) === Number(application?.jobPosting?.departmentId))?.tenPhong || '';
      const latest = offers[0];
      setOfferHistory(offers);
      setApproveModal({
        isOpen: true,
        feedback: state === 'PENDING_HR_OFFER' ? latest?.contractTerms || '' : '',
        fields: state === 'PENDING_HR_OFFER'
          ? offerToFields(latest, application, departmentName)
          : createEmptyOfferFields(application, departmentName),
      });
    } catch (error) {
      showNotification('Lỗi', error.response?.data?.message || 'Không thể tải dữ liệu offer', 'error');
    } finally {
      setOfferModalLoading(false);
    }
  };

  const reloadApplication = async () => {
    const response = await api.get(`/api/recruitment/applications/${id}`);
    if (response.data.success) setApplication(response.data.data);
  };

  useEffect(() => {
    const fetchApp = api.get(`/api/recruitment/applications/${id}`);
    const fetchLogs = api.get(`/api/recruitment/applications/${id}/ai-logs`);
    const fetchAnalyses = api.get(`/api/recruitment/applications/${id}/ai-analyses`);
    
    Promise.all([fetchApp, fetchLogs, fetchAnalyses])
      .then(([appRes, logsRes, analysesRes]) => {
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
        if (analysesRes.data.success) setAiAnalyses(analysesRes.data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const canView = role === 'admin' || role === 'ceo'
      || ((role === 'truong_phong' || role === 'giam_doc_phong_ban') && user?.tenPhong === 'Nhân sự');
    if (!application || !canView || (!application.approvalStatus?.includes('OFFER') && application.approvalStatus !== 'PENDING_HR_OFFER')) {
      setOfferActivity([]);
      return;
    }
    let active = true;
    api.get(`/api/recruitment/applications/${id}/offer-activity`)
      .then(response => { if (active) setOfferActivity(response.data.data || []); })
      .catch(() => { if (active) setOfferActivity([]); });
    return () => { active = false; };
  }, [id, application, role, user?.tenPhong]);

  const executeApprove = async () => {
    if (approveActionLoading || offerModalLoading) return;
    setApproveActionLoading(true);
    try {
      const state = application?.approvalStatus;
      const operationKey = crypto.randomUUID();

      if (state === 'PENDING_HR_OFFER') {
        const salary = Number(approveModal.fields.luongCoBan.replace(/\D/g, ''));
        const validationError = validateOfferFields(approveModal.fields, approveModal.feedback);
        if (validationError) {
          showNotification('Thiếu thông tin', validationError, 'error');
          return;
        }
        const draft = await api.post(`/api/recruitment/applications/${id}/offers`, {
          baseSalary: salary,
          allowances: legacyAllowancesFromFields(approveModal.fields),
          probationMonths: Number(approveModal.fields.probationMonths),
          probationSalaryRate: Number(approveModal.fields.probationRate),
          expectedStartDate: approveModal.fields.startDate,
          contractTerms: approveModal.feedback,
          offerDetails: buildOfferDetails(approveModal.fields),
          fileUrl: null,
          outOfRangeReason: approveModal.fields.salaryRangeReason || null
        });
        await api.post(`/api/recruitment/offers/${draft.data.data.id}/submit`, null, {
          headers: { 'Idempotency-Key': operationKey }
        });
        await reloadApplication();
        showNotification('Thành công', 'Đã tạo offer version mới và gửi duyệt', 'success');
        setApproveModal({ isOpen: false, feedback: '', fields: emptyOfferFields() });
        return;
      }

      if (state === 'PENDING_OFFER_APPROVAL') {
        const offers = await api.get(`/api/recruitment/applications/${id}/offers`);
        const pendingOffer = offers.data.data.find(item => item.status === 'PENDING_APPROVAL');
        if (!pendingOffer) throw new Error('Không tìm thấy offer đang chờ duyệt');
        await api.post(`/api/recruitment/offers/${pendingOffer.id}/decision`, {
          decision: 'APPROVE', comment: approveModal.feedback || null
        }, { headers: { 'Idempotency-Key': operationKey } });
        await reloadApplication();
        showNotification('Thành công', 'Offer đã được duyệt nội bộ', 'success');
        setApproveModal({ isOpen: false, feedback: '', fields: emptyOfferFields() });
        return;
      }

      if (state === 'OFFER_INTERNALLY_APPROVED' || state === 'OFFER_EXPIRED') {
        if (!approveModal.fields.responseDeadline) {
          showNotification('Thiếu thông tin', 'Vui lòng chọn hạn phản hồi offer', 'error');
          return;
        }
        const offers = await api.get(`/api/recruitment/applications/${id}/offers`);
        const approvedOffer = offers.data.data.find(item => item.status === 'APPROVED');
        if (!approvedOffer) throw new Error('Không tìm thấy offer đã duyệt');
        const sent = await api.post(`/api/recruitment/offers/${approvedOffer.id}/send`, {
          responseDeadline: approveModal.fields.responseDeadline,
          overbookConfirmed: approveModal.fields.overbookConfirmed,
          overbookReason: approveModal.fields.overbookReason || null
        }, { headers: { 'Idempotency-Key': operationKey } });
        setOfferLink(`${window.location.origin}/offer/${sent.data.data.responseToken}`);
        await reloadApplication();
        showNotification('Thành công', 'Đã gửi offer và giữ suất tuyển', 'success');
        setApproveModal({ isOpen: false, feedback: '', fields: emptyOfferFields() });
        return;
      }

      let payload = {};
      if (approveModal.feedback) {
        payload.feedback = approveModal.feedback;
      }

      const feedbackRequired = [
        'PENDING_HR_CV_REVIEW',
        'PENDING_TECH_CV_REVIEW',
        'PENDING_INTERVIEW_1',
        'PENDING_INTERVIEW_2'
      ].includes(application?.approvalStatus);
      if (feedbackRequired && !approveModal.feedback.trim()) {
        showNotification('Thiếu thông tin', 'Vui lòng nhập nhận xét trước khi chuyển bước', 'error');
        return;
      }

      const res = await api.post(`/api/recruitment/applications/${id}/approve`, payload, {
        headers: { 'Idempotency-Key': operationKey }
      });
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã duyệt hồ sơ sang bước tiếp theo', 'success');
        setApproveModal({ isOpen: false, feedback: '', fields: emptyOfferFields() });
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể phê duyệt', 'error');
    } finally {
      setApproveActionLoading(false);
    }
  };

  const executeReject = async () => {
    if (!rejectModal.reason.trim()) {
      showNotification('Lỗi', 'Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    try {
      if (application?.approvalStatus === 'PENDING_OFFER_APPROVAL') {
        const offers = await api.get(`/api/recruitment/applications/${id}/offers`);
        const pendingOffer = offers.data.data.find(item => item.status === 'PENDING_APPROVAL');
        if (!pendingOffer) throw new Error('Không tìm thấy offer đang chờ duyệt');
        await api.post(`/api/recruitment/offers/${pendingOffer.id}/decision`, {
          decision: 'REJECT', comment: rejectModal.reason
        }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
        await reloadApplication();
        showNotification('Đã từ chối offer', 'Offer được trả về để HR soạn phiên bản mới', 'success');
        setRejectModal({ isOpen: false, reason: '' });
        return;
      }

      const res = await api.post(`/api/recruitment/applications/${id}/reject`, { reason: rejectModal.reason }, {
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      });
      if (res.data.success) {
        setApplication(res.data.data);
        showNotification('Thành công', 'Đã từ chối hồ sơ', 'success');
        setRejectModal({ isOpen: false, reason: '' });
      }
    } catch (e) {
      showNotification('Lỗi', e.response?.data?.message || 'Không thể từ chối', 'error');
    }
  };

  const canApprove = () => {
    if (!application) return false;
    const s = application.approvalStatus;
    const targetRole = application.jobPosting?.targetRole || 'NHAN_VIEN';
    
    if (['OFFER_SENT', 'OFFER_ACCEPTED', 'REJECTED', 'TALENT_POOL',
      'WITHDRAWN', 'OFFER_DECLINED', 'OFFER_REVOKED'].includes(s)) return false;
    if (role === 'admin') return s === 'PENDING_OFFER_APPROVAL';
    
    // CEO Logic
    if (role === 'ceo') {
      if (s === 'PENDING_OFFER_APPROVAL') return true;
      if (s === 'OFFER_INTERNALLY_APPROVED' || s === 'OFFER_EXPIRED') return true;
      if (targetRole === 'TRUONG_PHONG' || targetRole === 'GIAM_DOC_PHONG_BAN') {
        if (s === 'PENDING_TECH_CV_REVIEW' || s === 'PENDING_INTERVIEW_1' || s === 'PENDING_INTERVIEW_2') return true;
      }
      return false;
    }

    // Giám đốc phòng ban Logic
    if (role === 'giam_doc_phong_ban') {
      if (user?.tenPhong === 'Nhân sự'
        && ['PENDING_HR_OFFER', 'OFFER_INTERNALLY_APPROVED', 'OFFER_EXPIRED'].includes(s)) return true;
      if (targetRole === 'TRUONG_PHONG') {
        if (s === 'PENDING_TECH_CV_REVIEW' || s === 'PENDING_INTERVIEW_1' || s === 'PENDING_INTERVIEW_2') return true;
      }
      return false;
    }

    // Trưởng phòng Logic
    if (role === 'truong_phong') {
      if (s === 'PENDING_HR_CV_REVIEW' && user?.tenPhong === 'Nhân sự') return true;
      if (s === 'PENDING_HR_OFFER' && user?.tenPhong === 'Nhân sự') return true; // Chỉ HR mới được soạn Offer
      if ((s === 'OFFER_INTERNALLY_APPROVED' || s === 'OFFER_EXPIRED') && user?.tenPhong === 'Nhân sự') return true;
      if (targetRole === 'NHAN_VIEN') {
        if (s === 'PENDING_TECH_CV_REVIEW' || s === 'PENDING_INTERVIEW_1' || s === 'PENDING_INTERVIEW_2') {
          // Chỉ Trưởng phòng của đúng phòng ban đó mới có quyền duyệt chuyên môn
          if (user?.departmentId === application?.jobPosting?.departmentId) return true;
        }
      }
      return false;
    }

    return false;
  };

  const canReject = () => {
    if (!application) return false;
    const s = application.approvalStatus;
    if (['OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_INTERNALLY_APPROVED', 'REJECTED', 'TALENT_POOL',
      'WITHDRAWN', 'OFFER_DECLINED', 'OFFER_EXPIRED', 'OFFER_REVOKED'].includes(s)) return false;
    if (role === 'admin') return s === 'PENDING_OFFER_APPROVAL';
    if (role === 'ceo') return true;

    if (s === 'PENDING_HR_OFFER') {
      return role === 'giam_doc_phong_ban' && user?.tenPhong === 'Nhân sự';
    }
    
    // Trưởng phòng Nhân sự luôn có quyền từ chối ở bất kỳ bước nào
    if (role === 'truong_phong' && user?.tenPhong === 'Nhân sự') return true;
    
    return canApprove();
  };

  const approveActionLabel = {
    PENDING_HR_OFFER: 'Soạn và gửi duyệt',
    PENDING_OFFER_APPROVAL: 'Duyệt offer',
    OFFER_INTERNALLY_APPROVED: 'Gửi offer',
    OFFER_EXPIRED: 'Gửi lại offer'
  }[application?.approvalStatus] || 'Duyệt chuyển bước';

  const approveModalTitle = {
    PENDING_HR_OFFER: 'Soạn đề xuất offer',
    PENDING_OFFER_APPROVAL: 'Phê duyệt offer',
    OFFER_INTERNALLY_APPROVED: 'Gửi offer cho ứng viên',
    OFFER_EXPIRED: 'Gửi lại offer cho ứng viên'
  }[application?.approvalStatus] || 'Xác nhận duyệt hồ sơ';

  const handleRunAi = async () => {
    setRunningAi(true);
    try {
      const res = await apiAi.post(`/api/recruitment/applications/${id}/run-ai`);
      if (res.data.success) {
        const updated = res.data.data;
        setApplication(updated);
        try {
          if (updated.extractedData) setExtractedData(JSON.parse(updated.extractedData));
        } catch { /* Dữ liệu cũ có thể không phải JSON hợp lệ. */ }
        
        // Chờ lấy kết quả chi tiết mới nhất trước khi báo hoàn tất.
        const [logsResponse, analysesResponse] = await Promise.all([
          api.get(`/api/recruitment/applications/${id}/ai-logs`),
          api.get(`/api/recruitment/applications/${id}/ai-analyses`)
        ]);
        if (logsResponse.data.success) setAiLogs(logsResponse.data.data);
        if (analysesResponse.data.success) setAiAnalyses(analysesResponse.data.data || []);
        
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
              }[application.approvalStatus] || 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {application.approvalStatus === 'PENDING_HR_CV_REVIEW' && 'HR Duyệt CV'}
              {application.approvalStatus === 'PENDING_TECH_CV_REVIEW' && 'Chuyên môn Duyệt CV'}
              {application.approvalStatus === 'PENDING_INTERVIEW_1' && 'Phỏng vấn 1'}
              {application.approvalStatus === 'PENDING_INTERVIEW_2' && 'Phỏng vấn 2'}
              {application.approvalStatus === 'PENDING_HR_OFFER' && 'Chờ HR lên Offer'}
              {application.approvalStatus === 'PENDING_OFFER_APPROVAL' && 'Chờ duyệt Offer'}
              {application.approvalStatus === 'OFFER_INTERNALLY_APPROVED' && 'Offer đã duyệt nội bộ'}
              {application.approvalStatus === 'OFFER_SENT' && 'Đã gửi Offer'}
              {application.approvalStatus === 'OFFER_ACCEPTED' && 'Ứng viên đã chấp nhận'}
              {application.approvalStatus === 'TALENT_POOL' && 'Talent Pool'}
              {application.approvalStatus === 'WITHDRAWN' && 'Ứng viên đã rút'}
              {application.approvalStatus === 'OFFER_DECLINED' && 'Ứng viên từ chối Offer'}
              {application.approvalStatus === 'OFFER_EXPIRED' && 'Offer hết hạn'}
              {application.approvalStatus === 'OFFER_REVOKED' && 'Offer đã thu hồi'}
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
            {canApprove() && (
                <button 
                  onClick={openApproveModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                >
                  <Check size={16} /> {approveActionLabel}
                </button>
            )}
            {canReject() && (
                <button 
                  onClick={() => setRejectModal({ isOpen: true, reason: '' })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors text-sm border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                >
                  <X size={16} /> Từ chối
                </button>
            )}
          </div>

          <button
            onClick={() => setShowAiDrawer(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 ml-2"
          >
            <Sparkles size={18} /> Chẩn đoán AI
          </button>
        </div>
      </div>

      {offerLink && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Link phản hồi offer vừa tạo</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={offerLink}
              className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700" />
            <button onClick={() => navigator.clipboard.writeText(offerLink)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Sao chép
            </button>
          </div>
          <p className="mt-2 text-xs text-blue-700">Trong môi trường thật, link được chuyển qua outbox/email.</p>
        </div>
      )}

      <OfferActivityCard activity={offerActivity} />

      <InterviewPanel
        applicationId={Number(id)}
        applicationStatus={application.approvalStatus}
        verifyPoints={latestAi?.computedResult?.verify_points || []}
      />

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* CỘT TRÁI (Dữ liệu bóc tách) - Khoảng 45% */}
          <div className="lg:w-5/12 space-y-8 pr-4">
            <ApplicationAttachmentsBlock application={application} />
            <ApplicationPersonalInfoForm application={application} mode="manager" />
            
            <div className="w-full h-px bg-slate-100 my-8"></div>
            
            <CandidateExperienceList experienceList={extractedData?.experience || []} />
            
            {/* Hiển thị Lịch sử Nhận xét */}
            {(application.hrReviewFeedback || application.techReviewFeedback || application.interview1Feedback || application.interview2Feedback || application.rejectionReason) && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-blue-800 font-bold text-lg mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-blue-600" /> Lịch sử nhận xét
                </h3>
                <div className="space-y-4">
                  {application.hrReviewFeedback && (
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                        HR Duyệt CV {application.hrReviewer && <span className="text-blue-600 normal-case font-medium ml-1">(Bởi: {application.hrReviewer})</span>}
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.hrReviewFeedback}</p>
                    </div>
                  )}
                  {application.techReviewFeedback && (
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                        Chuyên môn duyệt CV {application.techReviewer && <span className="text-blue-600 normal-case font-medium ml-1">(Bởi: {application.techReviewer})</span>}
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.techReviewFeedback}</p>
                    </div>
                  )}
                  {application.interview1Feedback && (
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                        Phỏng vấn lần 1 {application.interview1Reviewer && <span className="text-blue-600 normal-case font-medium ml-1">(Bởi: {application.interview1Reviewer})</span>}
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.interview1Feedback}</p>
                    </div>
                  )}
                  {application.interview2Feedback && (
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                        Phỏng vấn lần 2 {application.interview2Reviewer && <span className="text-blue-600 normal-case font-medium ml-1">(Bởi: {application.interview2Reviewer})</span>}
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.interview2Feedback}</p>
                    </div>
                  )}
                  {application.rejectionReason && (
                    <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 shadow-sm">
                      <p className="text-xs font-bold text-rose-600 uppercase mb-1">
                        Từ chối hồ sơ {application.rejectorName && <span className="text-rose-700 normal-case font-medium ml-1">(Bởi: {application.rejectorName})</span>}
                      </p>
                      <p className="text-sm text-rose-800 whitespace-pre-wrap">{application.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Hiển thị Bảng Đề xuất Offer (Nếu có) */}
            {application.offerDetails && (
              <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-emerald-800 font-bold text-lg mb-3 flex items-center gap-2">
                  <Check size={20} className="text-emerald-600" /> Bảng Đề xuất Offer (Từ HR)
                </h3>
                <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                  {application.offerDetails}
                </div>
              </div>
            )}
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
            <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 p-6 flex justify-between items-center text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-10 blur-xl"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/20 shadow-inner">
                  <Sparkles size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-wide">Chẩn đoán AI</h2>
                  <p className="text-blue-100 text-xs mt-0.5">Phân tích CV tự động</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiDrawer(false)} 
                className="p-2 text-blue-100 hover:text-white hover:bg-white/20 rounded-full transition-colors relative z-10"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
              {!latestAi || ['QUEUED', 'RUNNING'].includes(latestAi.status) ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <Sparkles size={32} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Hồ sơ chưa được đánh giá</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      AI chỉ trích xuất bằng chứng theo JD. Điểm được backend tính theo phiên bản cấu hình; con người quyết định tuyển dụng.
                    </p>
                  </div>
                  <button
                    onClick={handleRunAi}
                    disabled={runningAi}
                    className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-md"
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
                      className="flex items-center justify-center gap-2 w-full bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 disabled:text-slate-400 disabled:bg-slate-100 px-4 py-2.5 rounded-lg font-semibold transition-colors shadow-sm"
                    >
                      {runningAi ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang chạy lại...</>
                      ) : (
                        <><Sparkles size={16} /> Chạy lại AI đánh giá</>
                      )}
                    </button>
                  </div>
                  
                  <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">Bằng chứng AI theo JD</h3>
                        <p className="text-xs text-slate-500">Chỉ so sánh trong cùng cặp phiên bản tiêu chí và cấu hình chấm điểm.</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{latestAi?.status}</span>
                    </div>
                    {latestAi?.status === 'DONE' ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-blue-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Độ phủ lời khai theo JD</p>
                            <p className="mt-1 text-2xl font-bold text-blue-700">{Number(latestAi.claimCoverage || 0).toFixed(0)}%</p>
                          </div>
                          <div className="rounded-lg bg-indigo-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Mức bằng chứng</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-700">{Number(latestAi.evidenceScore || 0).toFixed(0)}%</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">Profile #{latestAi.scoringProfileVersionId} · Criteria #{latestAi.criteriaVersionId}</p>

                        <div className="mt-5 border-t border-slate-100 pt-5">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-sm font-bold text-slate-900">Tiêu chí đã dùng để đánh giá</h4>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {aiCriteria.length} tiêu chí
                            </span>
                          </div>

                          {aiCriteria.length === 0 ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                              Kết quả này chưa chứa chi tiết tiêu chí. Hãy chạy lại AI để tạo kết quả theo phiên bản hiện tại.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {aiCriteria.map((criterion, index) => {
                                const evidence = Array.isArray(criterion.evidence) ? criterion.evidence : [];
                                const levelLabels = {
                                  NONE: 'Không có bằng chứng',
                                  LISTED_ONLY: 'Chỉ được liệt kê',
                                  MENTIONED_IN_EXPERIENCE: 'Có trong kinh nghiệm',
                                  DEMONSTRATED: 'Có bằng chứng thực hành'
                                };
                                const levelClasses = {
                                  NONE: 'bg-rose-50 text-rose-700 border-rose-200',
                                  LISTED_ONLY: 'bg-amber-50 text-amber-700 border-amber-200',
                                  MENTIONED_IN_EXPERIENCE: 'bg-blue-50 text-blue-700 border-blue-200',
                                  DEMONSTRATED: 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                };

                                return (
                                  <div key={criterion.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900">{criterion.name || `Tiêu chí ${index + 1}`}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {criterion.type === 'MUST' ? 'Bắt buộc' : 'Ưu tiên'} · Trọng số {criterion.weight || 0}%
                                        </p>
                                      </div>
                                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${levelClasses[criterion.evidence_level] || levelClasses.NONE}`}>
                                        {levelLabels[criterion.evidence_level] || criterion.evidence_level || 'Chưa xác định'}
                                      </span>
                                    </div>

                                    {criterion.missing && (
                                      <div className="mt-3 rounded-lg border border-rose-100 bg-white p-3">
                                        <p className="text-xs font-semibold text-rose-700">Lý do chưa đạt</p>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{criterion.missing}</p>
                                      </div>
                                    )}

                                    {criterion.downgrade_reason && (
                                      <p className="mt-3 text-xs text-amber-700">Bị hạ mức: {criterion.downgrade_reason}</p>
                                    )}

                                    {evidence.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bằng chứng xác minh từ CV</p>
                                        {evidence.map((item, evidenceIndex) => (
                                          <div key={evidenceIndex} className="rounded-lg border border-emerald-100 bg-white p-3">
                                            <p className="text-sm italic leading-relaxed text-slate-700">“{item.quote}”</p>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                                              <span className="rounded bg-slate-100 px-2 py-0.5">Mục: {item.section}</span>
                                              {(item.detail_types || []).map((detail) => (
                                                <span key={detail} className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{detail}</span>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {aiVerifyPoints.length > 0 && (
                          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <h4 className="text-sm font-bold text-amber-900">Nội dung cần xác minh thêm</h4>
                            <div className="mt-3 space-y-3">
                              {aiVerifyPoints.map((point, index) => (
                                <div key={index} className="text-sm text-amber-900">
                                  <p className="font-semibold">{point.claim}</p>
                                  <p className="mt-0.5">{point.why}</p>
                                  {(point.suggested_questions || []).map((question, questionIndex) => (
                                    <p key={questionIndex} className="mt-1 text-xs italic text-amber-800">Gợi ý hỏi: {question}</p>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {aiFlags.length > 0 && (
                          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="text-sm font-bold text-slate-900">Cảnh báo kiểm tra</h4>
                            <div className="mt-3 space-y-3">
                              {aiFlags.map((flag, index) => (
                                <div key={`${flag.code || 'flag'}-${index}`} className="rounded-lg bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-800">{flag.code}</p>
                                  <p className="mt-1 text-slate-600">{flag.detail}</p>
                                  {flag.suggested_question && <p className="mt-1 text-xs italic text-blue-700">Gợi ý hỏi: {flag.suggested_question}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-700">{latestAi?.errorMessage || 'Hồ sơ cần HR kiểm tra thủ công.'}</p>
                    )}
                  </div>
                  
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

      {/* Modal Từ chối */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setRejectModal({isOpen: false, reason: ''})}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <XCircle className="text-rose-500" /> Từ chối và Loại ứng viên
            </h3>
            <p className="text-sm text-slate-600 mb-4">Bạn có chắc chắn muốn từ chối ứng viên này không? Hãy nhập lý do (thông tin này sẽ được lưu trong hệ thống).</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-slate-50 min-h-[100px] mb-6 text-sm"
              placeholder="Nhập lý do chi tiết..."
              value={rejectModal.reason}
              onChange={e => setRejectModal({...rejectModal, reason: e.target.value})}
            />
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setRejectModal({isOpen: false, reason: ''})}
                className="px-4 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg"
              >
                Xác nhận Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duyệt & Lên Offer */}
      {approveModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setApproveModal({...approveModal, isOpen: false})}></div>
          <div className={`bg-white rounded-2xl shadow-xl w-full relative p-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto ${application?.approvalStatus === 'PENDING_HR_OFFER' || application?.approvalStatus === 'PENDING_OFFER_APPROVAL' ? 'max-w-5xl' : 'max-w-2xl'}`}>
            <h3 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Check className="text-emerald-500" /> {approveModalTitle}
            </h3>
            {offerModalLoading ? (
              <div className="grid min-h-56 place-items-center text-slate-500"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
            ) : application?.approvalStatus === 'PENDING_HR_OFFER' ? (
              <div className="mb-6">
                <OfferComposer
                  application={application}
                  fields={approveModal.fields}
                  onFieldsChange={fields => setApproveModal(current => ({ ...current, fields }))}
                  terms={approveModal.feedback}
                  onTermsChange={feedback => setApproveModal(current => ({ ...current, feedback }))}
                />
              </div>
            ) : application?.approvalStatus === 'PENDING_OFFER_APPROVAL' ? (
              <div className="mb-6 space-y-5">
                <OfferReviewPanel offers={offerHistory} application={application} />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nhận xét phê duyệt (tùy chọn)</label>
                  <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="Ghi chú nội bộ cho phiên bản offer này..." value={approveModal.feedback} onChange={event => setApproveModal({ ...approveModal, feedback: event.target.value })} />
                </div>
              </div>
            ) : ['OFFER_INTERNALLY_APPROVED', 'OFFER_EXPIRED'].includes(application?.approvalStatus) ? (
              <div className="space-y-4 mb-6">
                <OfferReviewPanel offers={offerHistory} application={application} />
                <p className="text-sm text-slate-600">Khi gửi, hệ thống sẽ giữ một suất tuyển và phát hành link phản hồi mới.</p>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Hạn phản hồi</label>
                  <input type="datetime-local"
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-sm"
                    value={approveModal.fields.responseDeadline}
                    onChange={(e) => setApproveModal({...approveModal, fields: {...approveModal.fields, responseDeadline: e.target.value}})} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={approveModal.fields.overbookConfirmed}
                    onChange={(e) => setApproveModal({...approveModal, fields: {...approveModal.fields, overbookConfirmed: e.target.checked}})} />
                  Xác nhận gửi offer dự phòng nếu đã hết suất
                </label>
                {approveModal.fields.overbookConfirmed && (
                  <textarea className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm"
                    placeholder="Lý do gửi vượt suất"
                    value={approveModal.fields.overbookReason}
                    onChange={(e) => setApproveModal({...approveModal, fields: {...approveModal.fields, overbookReason: e.target.value}})} />
                )}
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-sm text-slate-600 mb-4">Bạn có chắc chắn muốn duyệt ứng viên này sang bước tiếp theo? Nhận xét là bắt buộc tại các bước đánh giá CV và phỏng vấn.</p>
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50 min-h-[100px] text-sm"
                  placeholder="Nhập nhận xét của bạn..."
                  value={approveModal.feedback}
                  onChange={e => setApproveModal({...approveModal, feedback: e.target.value})}
                />
              </div>
            )}
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setApproveModal({...approveModal, isOpen: false})}
                className="px-4 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeApprove}
                disabled={approveActionLoading || offerModalLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveActionLoading && <Loader2 className="animate-spin" size={16} />}{approveActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
