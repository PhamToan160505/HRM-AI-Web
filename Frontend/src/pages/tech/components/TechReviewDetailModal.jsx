import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Activity,
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Lock,
  ExternalLink,
  Copy,
  RotateCcw,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import {
  REVIEW_STATUS_CONFIG,
  REVIEW_TYPE_CONFIG,
  RATING_GRADE_CONFIG,
  COMPENSATION_STATUS_CONFIG,
  PROMOTION_ITEM_STATUS_CONFIG,
  computeProjectedGrade,
  formatDateVN,
  formatDateTimeVN,
  formatCurrencyVND,
} from '../techHelpers';

function extractRoadmapFromAiSummary(text) {
  if (!text) return '';
  const marker = /(?:3\.\s*)?Lộ\s*trình\s*(?:hành\s*động\s*)?90\s*ngày(?:\s*tới)?\s*:\s*\n?/i;
  const parts = text.split(marker);
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return '';
}

export default function TechReviewDetailModal({
  isOpen,
  onClose,
  reviewId,
  initialReview = null,
  viewerRole = 'truong_phong',
  currentUserId = null,
  readOnlyMode = false,
  onSuccess,
  onInspectEngineer,
  hasTopModalOpen = false,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [review, setReview] = useState(initialReview);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiCopilotResult, setAiCopilotResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const modalBodyRef = useRef(null);

  const reportError = (msg) => {
    setErrorMsg(msg);
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    toastRef.current?.show('Thông tin chưa hợp lệ', msg, 'error');
  };

  // Manager qualitative form states
  const [qualCraftScore, setQualCraftScore] = useState(20);
  const [qualOwnershipScore, setQualOwnershipScore] = useState(20);
  const [qualCollabScore, setQualCollabScore] = useState(20);
  const [qualGrowthScore, setQualGrowthScore] = useState(20);
  const [calibrationDelta, setCalibrationDelta] = useState(0);
  const [calibrationReason, setCalibrationReason] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [managerFeedbackGoals, setManagerFeedbackGoals] = useState('');
  const [skillDecisions, setSkillDecisions] = useState({});

  // Promotion & Compensation proposal states
  const [recommendPromotion, setRecommendPromotion] = useState(false);
  const [recommendedTitle, setRecommendedTitle] = useState('');
  const [recommendedSalaryIncreasePct, setRecommendedSalaryIncreasePct] = useState('');
  const [compensationReason, setCompensationReason] = useState('');
  const [exceptionJustification, setExceptionJustification] = useState('');
  const [recommendedNewBaseSalary, setRecommendedNewBaseSalary] = useState('');
  const [recommendedNewAllowance, setRecommendedNewAllowance] = useState('');

  // Final decision (Director / CEO) states
  const [approveCompensation, setApproveCompensation] = useState(true);
  const [overrideTitle, setOverrideTitle] = useState('');
  const [ceoNewBaseSalary, setCeoNewBaseSalary] = useState('');
  const [ceoNewAllowance, setCeoNewAllowance] = useState('');
  const [compensationNote, setCompensationNote] = useState('');
  const [ceoCalDelta, setCeoCalDelta] = useState(0);
  const [ceoCalReason, setCeoCalReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const hydrateFromReview = useCallback((r) => {
    if (!r) return;
    setReview(r);
    setQualCraftScore(r.qualCraftScore ?? 20);
    setQualOwnershipScore(r.qualOwnershipScore ?? 20);
    setQualCollabScore(r.qualCollabScore ?? 20);
    setQualGrowthScore(r.qualGrowthScore ?? 20);
    setCalibrationDelta(r.calibrationDelta ?? 0);
    setCalibrationReason(r.calibrationReason || '');
    setManagerComment(r.managerComment || '');
    setManagerFeedbackGoals(r.managerFeedbackGoals || '');

    const decMap = {};
    (r.skillPromotionItems || []).forEach((item) => {
      decMap[item.id] = {
        status: item.status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
        reviewerNote: item.reviewerNote || '',
      };
    });
    setSkillDecisions(decMap);

    setRecommendPromotion(Boolean(r.recommendPromotion));
    setRecommendedTitle(r.recommendedTitle || '');
    setRecommendedSalaryIncreasePct(
      r.recommendedSalaryIncreasePct !== null && r.recommendedSalaryIncreasePct !== undefined
        ? String(r.recommendedSalaryIncreasePct)
        : ''
    );
    setCompensationReason(r.compensationReason || '');
    setExceptionJustification('');
    setRecommendedNewBaseSalary(
      r.recommendedNewBaseSalary !== null && r.recommendedNewBaseSalary !== undefined
        ? String(r.recommendedNewBaseSalary)
        : ''
    );
    setRecommendedNewAllowance(
      r.recommendedNewAllowance !== null && r.recommendedNewAllowance !== undefined
        ? String(r.recommendedNewAllowance)
        : ''
    );

    setApproveCompensation(r.compensationStatus !== 'REJECTED');
    setOverrideTitle(r.recommendedTitle || '');
    setCeoNewBaseSalary(
      r.recommendedNewBaseSalary !== null && r.recommendedNewBaseSalary !== undefined
        ? String(r.recommendedNewBaseSalary)
        : ''
    );
    setCeoNewAllowance(
      r.recommendedNewAllowance !== null && r.recommendedNewAllowance !== undefined
        ? String(r.recommendedNewAllowance)
        : ''
    );
    setCompensationNote(r.compensationReason || '');
    setCeoCalDelta(r.calibrationDelta ?? 0);
    setCeoCalReason(r.calibrationReason || '');
    setShowRejectBox(false);
    setRejectReason('');
    setAiCopilotResult(null);
    setErrorMsg('');
  }, []);

  const fetchFreshReview = useCallback(
    async (id) => {
      if (!id) return;
      try {
        setLoadingDetail(true);
        const res = await api.get(`/api/tech/reviews/${id}`);
        if (res.data?.data) {
          hydrateFromReview(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi tải chi tiết phiếu đánh giá:', err);
        setErrorMsg(err.response?.data?.message || 'Không thể tải chi tiết phiếu đánh giá.');
      } finally {
        setLoadingDetail(false);
      }
    },
    [hydrateFromReview]
  );

  const lastLoadedReviewIdRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      lastLoadedReviewIdRef.current = null;
      return;
    }
    // Chỉ hydrate dữ liệu ban đầu khi mở modal hoặc khi chuyển sang phiếu khác,
    // chống việc cha re-render (do WebSocket / background fetch) làm đè mất dữ liệu form đang nhập
    if (reviewId && lastLoadedReviewIdRef.current !== reviewId) {
      lastLoadedReviewIdRef.current = reviewId;
      if (initialReview) {
        hydrateFromReview(initialReview);
      }
      fetchFreshReview(reviewId);
    }
  }, [isOpen, reviewId, initialReview, hydrateFromReview, fetchFreshReview]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting && !hasTopModalOpen) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, submitting, hasTopModalOpen, onClose]);

  const roleNorm = (viewerRole || '').toLowerCase();
  const isCeoOrAdmin = roleNorm === 'ceo' || roleNorm === 'admin';
  const isDirector = roleNorm === 'giam_doc_phong_ban';
  const isTruongPhong = roleNorm === 'truong_phong';
  const isManagerRole = isCeoOrAdmin || isDirector || isTruongPhong;
  const isOwnReview = Boolean(
    currentUserId && review?.employeeId && String(currentUserId) === String(review.employeeId)
  );
  // B-10 Strict Masking
  const canViewSalaryMoney = isCeoOrAdmin || (isDirector && !isOwnReview);
  const isEvaluatableStatus =
    review?.status === 'SELF_REVIEW_PENDING' ||
    review?.status === 'MANAGER_REVIEW_PENDING' ||
    review?.status === 'REJECTED_FOR_REVISION';
  const isDirectorPending = review?.status === 'DIRECTOR_APPROVAL_PENDING';
  const isApproved = review?.status === 'APPROVED';

  const canEvaluate = !readOnlyMode && !isOwnReview && isManagerRole && isEvaluatableStatus;
  const canRecalculate = !readOnlyMode && !isOwnReview && (isDirector || isTruongPhong || roleNorm === 'admin') && !isApproved;
  const canGenerateAi = !readOnlyMode && !isOwnReview && isManagerRole && !isApproved;

  const hasPendingComp = Boolean(
    review &&
      (review.compensationStatus === 'PENDING_CEO' ||
        review.recommendPromotion ||
        Number(review.recommendedSalaryIncreasePct || 0) > 0 ||
        (review.recommendedTitle && review.recommendedTitle.trim().length > 0))
  );
  const isFinalApproverRole = isCeoOrAdmin || isDirector;
  const canShowFinalDecisionPanel = !readOnlyMode && !isOwnReview && isFinalApproverRole && isDirectorPending;
  const canApproveFinalHere =
    canShowFinalDecisionPanel &&
    (isCeoOrAdmin || (!hasPendingComp && review?.employeeRole !== 'GIAM_DOC_PHONG_BAN'));

  const projectedQualTotal = useMemo(() => {
    return (
      Number(qualCraftScore || 0) +
      Number(qualOwnershipScore || 0) +
      Number(qualCollabScore || 0) +
      Number(qualGrowthScore || 0)
    );
  }, [qualCraftScore, qualOwnershipScore, qualCollabScore, qualGrowthScore]);

  const projectedFinalScore = useMemo(() => {
    const tele = Number(review?.telemetryTotalScore || 0);
    const cal = isTruongPhong ? 0 : Number(calibrationDelta || 0);
    const raw = tele * 0.6 + projectedQualTotal * 0.4 + cal;
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  }, [review?.telemetryTotalScore, projectedQualTotal, calibrationDelta, isTruongPhong]);

  const projectedGrade = computeProjectedGrade(projectedFinalScore);

  const hasFormCompProposal = Boolean(
    recommendPromotion ||
      Number(recommendedSalaryIncreasePct || 0) > 0 ||
      recommendedTitle.trim().length > 0
  );

  const handleRecalculateTelemetry = async () => {
    if (!review?.id || recalculating) return;
    try {
      setRecalculating(true);
      const res = await api.post(`/api/tech/reviews/${review.id}/recalculate-telemetry`);
      if (res.data?.data) {
        const fresh = res.data.data;
        // Cập nhật dữ liệu Telemetry và đối tượng review mới nhất,
        // TUYỆT ĐỐI KHÔNG gọi hydrateFromReview để giữ nguyên 100% dữ liệu form đang nhập
        // (điểm định tính, nhận xét quản lý, đề xuất thăng chức/lương, trợ lý AI...)
        setReview((prev) => ({
          ...prev,
          ...fresh,
        }));
        toastRef.current?.show(
          'Đã đồng bộ Telemetry',
          'Điểm Telemetry 4 trụ cột đã được cập nhật từ dữ liệu mới nhất (thông tin bạn đang nhập được giữ nguyên).',
          'success'
        );
        if (onSuccess) await onSuccess();
      }
    } catch (err) {
      toastRef.current?.show('Lỗi', err.response?.data?.message || 'Không thể đồng bộ lại Telemetry', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleGenerateAiCopilot = async () => {
    if (!review?.id || generatingAi) return;
    try {
      setGeneratingAi(true);
      const res = await api.post(`/api/tech/reviews/${review.id}/ai-copilot`);
      const data = res.data?.data;
      setAiCopilotResult(data || null);
      if (data?.formattedSummary) {
        setReview((prev) => (prev ? { ...prev, aiCopilotSummary: data.formattedSummary } : prev));
      }
      toastRef.current?.show(
        'Trợ lý AI hoàn tất',
        data?.generatedByAi
          ? 'Đã tổng hợp nhận xét từ Trợ lý AI (Gemini).'
          : 'Đã tổng hợp nhận xét từ Trợ lý AI (bộ quy tắc dữ liệu kỹ thuật).',
        'success'
      );
    } catch (err) {
      toastRef.current?.show(
        'Lỗi',
        err.response?.data?.message || 'Không thể chạy Trợ lý AI Tổng hợp Nhận xét Kỹ thuật',
        'error'
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleApplyAiToComment = () => {
    const summaryText = aiCopilotResult?.formattedSummary || review?.aiCopilotSummary;
    if (!summaryText) return;
    setManagerComment((prev) => (prev?.trim() ? `${prev.trim()}\n\n${summaryText}` : summaryText));

    const roadmapText =
      aiCopilotResult?.roadmap90Days ||
      review?.aiCopilotRoadmap ||
      extractRoadmapFromAiSummary(summaryText);

    if (roadmapText) {
      setManagerFeedbackGoals(roadmapText);
    }
  };

  const handleSubmitEvaluate = async (e) => {
    e.preventDefault();
    if (!review?.id || submitting) return;
    setErrorMsg('');

    const rawScores = [qualCraftScore, qualOwnershipScore, qualCollabScore, qualGrowthScore];
    if (rawScores.some((s) => String(s).trim() === '')) {
      reportError('Vui lòng nhập đầy đủ cả 4 tiêu chí định tính trong khoảng 0 – 25 điểm.');
      return;
    }
    const scores = rawScores.map(Number);
    if (scores.some((s) => Number.isNaN(s) || s < 0 || s > 25)) {
      reportError('Mỗi tiêu chí định tính phải nằm trong khoảng 0 – 25 điểm.');
      return;
    }
    if (!managerComment.trim()) {
      reportError('Vui lòng nhập nhận xét đánh giá của quản lý.');
      return;
    }
    const cal = isTruongPhong ? 0 : Number(calibrationDelta || 0);
    if (Number.isNaN(cal) || Math.abs(cal) > 5) {
      reportError('Điểm hiệu chỉnh (Calibration Delta) tối đa ±5.0 điểm.');
      return;
    }
    if (Math.abs(cal) > 0.0001 && !calibrationReason.trim()) {
      reportError('Vui lòng nhập lý do bắt buộc khi hiệu chỉnh điểm (Calibration).');
      return;
    }
    if (hasFormCompProposal && projectedFinalScore < 75.0 && !exceptionJustification.trim()) {
      reportError('Điểm Tổng hợp dự kiến dưới 75.0đ — vui lòng nhập Giải trình Ngoại lệ nếu vẫn đề xuất thăng chức/tăng lương.');
      return;
    }

    try {
      setSubmitting(true);
      const skillList = (review.skillPromotionItems || []).map((item) => ({
        itemId: item.id,
        skillId: item.skillId,
        targetLevel: item.targetLevel,
        evidenceNote: item.evidenceNote,
        evidenceUrl: item.evidenceUrl,
        status: skillDecisions[item.id]?.status || 'APPROVED',
        reviewerNote: skillDecisions[item.id]?.reviewerNote || null,
      }));

      const payload = {
        qualCraftScore: Number(qualCraftScore),
        qualOwnershipScore: Number(qualOwnershipScore),
        qualCollabScore: Number(qualCollabScore),
        qualGrowthScore: Number(qualGrowthScore),
        calibrationDelta: !isTruongPhong ? Number(calibrationDelta || 0) : 0,
        calibrationReason: !isTruongPhong ? calibrationReason.trim() || null : null,
        managerComment: managerComment.trim(),
        managerFeedbackGoals: managerFeedbackGoals.trim() || null,
        skillDecisions: skillList,
        recommendPromotion: hasFormCompProposal,
        recommendedTitle: recommendedTitle.trim() || null,
        recommendedSalaryIncreasePct:
          recommendedSalaryIncreasePct !== '' ? Number(recommendedSalaryIncreasePct) : null,
        compensationReason: compensationReason.trim() || null,
        exceptionJustification: exceptionJustification.trim() || null,
        // B-10 Strict Masking: Trường lương tuyệt đối CHỈ gửi nếu actor được phép xem/nhập tiền lương
        ...(canViewSalaryMoney && recommendedNewBaseSalary !== ''
          ? { recommendedNewBaseSalary: Number(recommendedNewBaseSalary) }
          : {}),
        ...(canViewSalaryMoney && recommendedNewAllowance !== ''
          ? { recommendedNewAllowance: Number(recommendedNewAllowance) }
          : {}),
      };

      const res = await api.put(`/api/tech/reviews/${review.id}/evaluate`, payload);
      const updated = res.data?.data;
      toastRef.current?.show(
        'Đã lưu đánh giá',
        res.data?.message || 'Đã lưu kết quả đánh giá kỹ sư thành công.',
        'success'
      );
      if (updated) hydrateFromReview(updated);
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      reportError(err.response?.data?.message || 'Không thể lưu kết quả đánh giá.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalDecision = async (decisionType) => {
    if (!review?.id || submitting) return;
    setErrorMsg('');

    if (decisionType === 'REJECTED_FOR_REVISION' && !rejectReason.trim()) {
      reportError('Vui lòng nhập lý do trả lại phiếu đánh giá để hiệu chỉnh.');
      return;
    }

    const cal = Number(ceoCalDelta || 0);
    if (decisionType === 'APPROVED' && (Number.isNaN(cal) || Math.abs(cal) > 5)) {
      reportError('Điểm hiệu chỉnh cuối (Calibration Delta) tối đa ±5.0 điểm.');
      return;
    }
    if (decisionType === 'APPROVED' && Math.abs(cal) > 0.0001 && !ceoCalReason.trim() && !review.calibrationReason) {
      reportError('Vui lòng nhập lý do hiệu chỉnh điểm (Calibration).');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        decision: decisionType,
        ...(decisionType === 'REJECTED_FOR_REVISION'
          ? { rejectionReason: rejectReason.trim() }
          : {
              calibrationDelta: Number(ceoCalDelta || 0),
              calibrationReason: ceoCalReason.trim() || null,
              approveCompensation: hasPendingComp ? approveCompensation : null,
              overrideTitle: hasPendingComp && approveCompensation ? overrideTitle.trim() || null : null,
              newBaseSalary:
                hasPendingComp && approveCompensation && isCeoOrAdmin && ceoNewBaseSalary !== ''
                  ? Number(ceoNewBaseSalary)
                  : null,
              newAllowance:
                hasPendingComp && approveCompensation && isCeoOrAdmin && ceoNewAllowance !== ''
                  ? Number(ceoNewAllowance)
                  : null,
              compensationNote: compensationNote.trim() || null,
            }),
      };

      const res = await api.put(`/api/tech/reviews/${review.id}/final-decision`, payload);
      toastRef.current?.show(
        decisionType === 'APPROVED' ? 'Phê duyệt thành công' : 'Đã trả lại hiệu chỉnh',
        res.data?.message || 'Đã cập nhật quyết định phê duyệt.',
        'success'
      );
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      reportError(err.response?.data?.message || 'Không thể thực hiện quyết định phê duyệt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || (!review && !loadingDetail)) return null;

  const statusCfg = REVIEW_STATUS_CONFIG[review?.status] || REVIEW_STATUS_CONFIG.SELF_REVIEW_PENDING;
  const typeCfg = REVIEW_TYPE_CONFIG[review?.reviewType] || REVIEW_TYPE_CONFIG.QUARTERLY;
  const gradeKey = review?.finalGrade || projectedGrade;
  const gradeCfg = RATING_GRADE_CONFIG[gradeKey] || RATING_GRADE_CONFIG.B;
  const compCfg = COMPENSATION_STATUS_CONFIG[review?.compensationStatus || 'NONE'] || COMPENSATION_STATUS_CONFIG.NONE;
  const bd = review?.telemetryBreakdown;

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9988] bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-review-detail-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* Header — Deep Sapphire Corporate */}
        <div className="px-6 py-4 bg-[#0F2557] text-white flex items-start justify-between gap-4 shrink-0 border-b border-blue-900/60">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 border border-white/20 text-blue-100">
                {review?.cycleCode}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.badgeClass}`}>
                {typeCfg.shortLabel}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </span>
              {isOwnReview && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-blue-100 border border-white/25">
                  Phiếu của bạn (Chỉ xem)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="tech-review-detail-title" className="text-base sm:text-lg font-bold text-white truncate">
                {review?.hoTen || 'Đang tải...'}
              </h2>
              {review?.maNhanVien && (
                <span className="font-mono text-[11px] text-blue-200 tabular">{review.maNhanVien}</span>
              )}
              <span className="text-xs text-blue-100/80">• {review?.chucVu || 'Kỹ sư Công nghệ'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onInspectEngineer && review?.employeeId && (
              <button
                type="button"
                onClick={() => onInspectEngineer(review.employeeId)}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition cursor-pointer"
              >
                <ShieldCheck size={14} />
                <span>Xem Radar Năng lực</span>
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Đóng cửa sổ"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="px-5 sm:px-6 pt-3.5 pb-1 shrink-0">
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-medium text-rose-700 shadow-2xs"
            >
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div ref={modalBodyRef} className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">

          {review?.rejectionReason && review.status === 'REJECTED_FOR_REVISION' && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <RotateCcw size={14} className="text-rose-600" />
                <span>Lý do trả lại chỉnh sửa từ cấp phê duyệt:</span>
              </p>
              <p className="text-[11px] leading-relaxed">{review.rejectionReason}</p>
            </div>
          )}

          {loadingDetail && !review ? (
            <div className="h-80 skeleton rounded-2xl" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* ── LEFT COLUMN (5 cols): Telemetry 4 Pillars + Self Review ── */}
              <div className="lg:col-span-5 space-y-4">
                {/* Score Summary Ribbon */}
                <div className="p-4 rounded-2xl bg-[#0F2557] text-white space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] text-blue-200 block">
                        Điểm Telemetry Thực tế (60%)
                      </span>
                      <p className="text-2xl font-extrabold tabular">
                        {Number(review?.telemetryTotalScore || 0).toFixed(1)}{' '}
                        <span className="text-xs font-semibold text-blue-200">/ 100</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-blue-200 block">
                        {review?.finalScore != null ? 'Kết quả chốt' : 'Dự kiến Tổng hợp'}
                      </span>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-xl font-extrabold tabular">
                          {Number(review?.finalScore ?? projectedFinalScore).toFixed(1)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-xs border ${gradeCfg.badgeClass}`}>
                          {gradeKey}
                        </span>
                      </div>
                    </div>
                  </div>

                  {Number(review?.calibrationDelta || 0) !== 0 && (
                    <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-[11px] flex items-start justify-between gap-2 flex-wrap">
                      <span className="font-bold text-blue-100 tabular">
                        Hiệu chỉnh (Calibration):{' '}
                        {Number(review.calibrationDelta) > 0
                          ? `+${Number(review.calibrationDelta).toFixed(1)}`
                          : Number(review.calibrationDelta).toFixed(1)}
                        đ
                      </span>
                      {review?.calibrationReason && (
                        <span className="text-blue-100/90 text-right flex-1 min-w-[140px]">
                          {review.calibrationReason}
                        </span>
                      )}
                    </div>
                  )}

                  {canRecalculate && (
                    <button
                      type="button"
                      disabled={recalculating}
                      onClick={handleRecalculateTelemetry}
                      className="w-full py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-blue-100 border border-white/15 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={recalculating ? 'animate-spin' : ''} />
                      <span>{recalculating ? 'Đang đồng bộ từ DB...' : 'Đồng bộ lại Telemetry từ Worklog & Chấm công'}</span>
                    </button>
                  )}
                </div>

                {/* 4 Telemetry Pillars */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity size={14} className="text-[#1E3A8A]" />
                    <span>Chi tiết 4 Trụ cột Dữ liệu Khách quan</span>
                  </h3>

                  {/* Pillar 1 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800">1. Thực thi &amp; Bàn giao (Delivery)</span>
                      <span className="text-[#1E3A8A] tabular">{Number(review?.deliveryScore || 0).toFixed(1)} / 35đ</span>
                    </div>
                    {bd && (
                      <p className="text-[11px] text-slate-500 tabular leading-relaxed">
                        {bd.coverageLabel} • Sạch Audit: {bd.cleanAuditWorklogs}/{bd.totalApprovedWorklogs} log • Mốc đúng hạn: {bd.onTimeMilestonesCount}/{bd.dueMilestonesCount}
                      </p>
                    )}
                  </div>

                  {/* Pillar 2 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800">2. Giá trị &amp; Tác động Kỹ thuật (Impact)</span>
                      <span className="text-[#1E3A8A] tabular">{Number(review?.impactScore || 0).toFixed(1)} / 25đ</span>
                    </div>
                    {bd && (
                      <p className="text-[11px] text-slate-500 tabular leading-relaxed">
                        Core Engineering: {Number(bd.coreWorkRatioPercent || 0).toFixed(0)}% ({bd.coreHours}h)
                        {bd.leadBonusApplied ? ' • +3đ Tech Lead' : ''} • {bd.impactMethodLabel}
                      </p>
                    )}
                  </div>

                  {/* Pillar 3 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800">3. Năng lực &amp; Chứng chỉ (Capability)</span>
                      <span className="text-[#1E3A8A] tabular">{Number(review?.capabilityScore || 0).toFixed(1)} / 20đ</span>
                    </div>
                    {bd && (
                      <p className="text-[11px] text-slate-500 tabular leading-relaxed">
                        Kỹ năng: {bd.verifiedSkillsCount}/{bd.totalSkillsCount} đã duyệt • {bd.certStatusLabel}
                      </p>
                    )}
                  </div>

                  {/* Pillar 4 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800">4. Kỷ luật &amp; Chuyên cần (Discipline)</span>
                      <span className="text-[#1E3A8A] tabular">{Number(review?.disciplineScore || 0).toFixed(1)} / 20đ</span>
                    </div>
                    {bd && (
                      <p className="text-[11px] text-slate-500 tabular leading-relaxed">
                        Đi muộn: {bd.lateCount} buổi (miễn trừ {bd.freeLateQuota} buổi) • Nghỉ KP: {bd.unexcusedAbsentCount} • Đơn WFH/Phép: {bd.excusedLeaveOrWfhDays} ngày
                      </p>
                    )}
                  </div>

                  {bd?.projectHighlights && bd.projectHighlights.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="text-[11px] font-bold text-slate-600 block">Dự án ghi nhận trong kỳ:</span>
                      <div className="flex flex-wrap gap-1">
                        {bd.projectHighlights.map((ph, idx) => (
                          <span
                            key={`ph-${idx}`}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200"
                          >
                            {ph}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Self Review Input Summary */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">Bản Tự đánh giá của Kỹ sư</h3>
                    {review?.selfRatingScore != null && (
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 tabular">
                        Tự chấm: {review.selfRatingScore}/100
                      </span>
                    )}
                  </div>

                  {!review?.selfSubmittedAt && !review?.selfSummary ? (
                    <p className="text-slate-400 italic">Kỹ sư chưa nộp bản tự đánh giá cho kỳ này.</p>
                  ) : (
                    <div className="space-y-2 text-[11px] text-slate-700">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="font-bold text-slate-800 block mb-0.5">Tóm tắt công việc:</span>
                        <p className="whitespace-pre-line leading-relaxed">{review.selfSummary}</p>
                      </div>
                      {review.selfAchievements && (
                        <div>
                          <span className="font-bold text-slate-800">Thành tựu: </span>
                          <span>{review.selfAchievements}</span>
                        </div>
                      )}
                      {review.selfChallenges && (
                        <div>
                          <span className="font-bold text-slate-800">Khó khăn / Bài học: </span>
                          <span>{review.selfChallenges}</span>
                        </div>
                      )}
                      {review.selfGoalsNext && (
                        <div>
                          <span className="font-bold text-slate-800">Mục tiêu kỳ tới: </span>
                          <span>{review.selfGoalsNext}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN (7 cols): Trợ lý AI, Skill Promotions, Scoring, Compensation, Approval ── */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Trợ lý AI Tổng hợp Nhận xét Kỹ thuật */}
                {(canGenerateAi || Boolean(review?.aiCopilotSummary || aiCopilotResult?.formattedSummary)) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 border border-blue-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-[#0F2557] flex items-center gap-1.5">
                        <Sparkles size={15} className="text-blue-600" />
                        <span>Trợ lý AI Tổng hợp Nhận xét Kỹ thuật</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {(aiCopilotResult?.formattedSummary || review?.aiCopilotSummary) && canEvaluate && (
                          <button
                            type="button"
                            onClick={handleApplyAiToComment}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold transition cursor-pointer"
                          >
                            <Copy size={11} />
                            <span>Chèn vào nhận xét</span>
                          </button>
                        )}
                        {canGenerateAi && (
                          <button
                            type="button"
                            disabled={generatingAi}
                            onClick={handleGenerateAiCopilot}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-55"
                          >
                            <Sparkles size={12} />
                            <span>{generatingAi ? 'Đang phân tích...' : 'AI Tổng hợp Nhận xét'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {review?.aiCopilotSummary || aiCopilotResult?.formattedSummary ? (
                      <div className="p-3 rounded-xl bg-white border border-blue-100 text-[11px] text-slate-700 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                        {aiCopilotResult?.formattedSummary || review.aiCopilotSummary}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Bấm &quot;AI Tổng hợp Nhận xét&quot; để Trợ lý AI phân tích điểm mạnh, điểm cần cải thiện và lộ trình 90 ngày từ Telemetry &amp; bản Tự đánh giá.
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Skill Promotion Requests */}
                {(review?.skillPromotionItems || []).length > 0 && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-[#1E3A8A]" />
                      <span>Đề xuất Nâng bậc Kỹ năng ({review.skillPromotionItems.length})</span>
                    </h3>

                    <div className="space-y-2">
                      {review.skillPromotionItems.map((item) => {
                        const dec = skillDecisions[item.id] || { status: item.status || 'APPROVED', reviewerNote: item.reviewerNote || '' };
                        const itemStatusCfg =
                          PROMOTION_ITEM_STATUS_CONFIG[item.status] || PROMOTION_ITEM_STATUS_CONFIG.PENDING;
                        const isSeniorPlus = item.targetLevel === 'SENIOR' || item.targetLevel === 'EXPERT';

                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{item.skillName}</span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200 font-bold">
                                    {item.fromLevel || 'Mới'} → {item.targetLevel}
                                  </span>
                                  {isSeniorPlus && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                      Bậc Senior+ (Cần GĐ/CEO duyệt)
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600">{item.evidenceNote}</p>
                                {item.evidenceUrl && (
                                  <a
                                    href={item.evidenceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                                  >
                                    <span>Link PR / Minh chứng</span>
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>

                              {canEvaluate ? (
                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSkillDecisions((prev) => ({
                                        ...prev,
                                        [item.id]: { ...dec, status: 'APPROVED' },
                                      }))
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                      dec.status === 'APPROVED'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                    }`}
                                  >
                                    <CheckCircle2 size={12} />
                                    <span>Duyệt</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSkillDecisions((prev) => ({
                                        ...prev,
                                        [item.id]: { ...dec, status: 'REJECTED' },
                                      }))
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                      dec.status === 'REJECTED'
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                                    }`}
                                  >
                                    <XCircle size={12} />
                                    <span>Từ chối</span>
                                  </button>
                                </div>
                              ) : (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${itemStatusCfg.badgeClass}`}>
                                  {itemStatusCfg.label}
                                </span>
                              )}
                            </div>

                            {canEvaluate && (
                              <input
                                type="text"
                                value={dec.reviewerNote}
                                onChange={(e) =>
                                  setSkillDecisions((prev) => ({
                                    ...prev,
                                    [item.id]: { ...dec, reviewerNote: e.target.value },
                                  }))
                                }
                                placeholder="Ghi chú thẩm định kỹ năng (tùy chọn)..."
                                className="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Manager Qualitative Scoring + Compensation Proposal Form / Read-Only */}
                <form noValidate onSubmit={handleSubmitEvaluate} className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-slate-900">
                      Chấm điểm Định tính Quản lý (Trọng số 40% • 4 tiêu chí x 25đ)
                    </h3>
                    <span className="text-xs font-extrabold text-[#1E3A8A] tabular">
                      Tổng định tính: {projectedQualTotal.toFixed(1)} / 100
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {[
                      { id: 'q-craft', label: 'Thiết kế & Chất lượng code', val: qualCraftScore, set: setQualCraftScore },
                      { id: 'q-owner', label: 'Làm chủ & Xử lý sự cố', val: qualOwnershipScore, set: setQualOwnershipScore },
                      { id: 'q-collab', label: 'Hợp tác & Code Review', val: qualCollabScore, set: setQualCollabScore },
                      { id: 'q-growth', label: 'Giao tiếp & Học hỏi mới', val: qualGrowthScore, set: setQualGrowthScore },
                    ].map((crit) => (
                      <div key={crit.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/75 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={crit.id} className="text-[11px] font-semibold text-slate-700">
                            {crit.label}
                          </label>
                          <span className="font-extrabold text-[#1E3A8A] tabular">{crit.val}/25</span>
                        </div>
                        <input
                          id={crit.id}
                          type="number"
                          min={0}
                          max={25}
                          step={0.5}
                          disabled={!canEvaluate}
                          value={crit.val}
                          onChange={(e) => crit.set(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-100 tabular"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Calibration (Director / CEO / Admin only) */}
                  {canEvaluate && !isTruongPhong && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="sm:col-span-4 space-y-1">
                        <label htmlFor="cal-delta" className="block text-[11px] font-bold text-slate-700">
                          Hiệu chỉnh điểm (±5đ)
                        </label>
                        <input
                          id="cal-delta"
                          type="number"
                          min={-5}
                          max={5}
                          step={0.5}
                          value={calibrationDelta}
                          onChange={(e) => setCalibrationDelta(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 tabular"
                        />
                      </div>
                      <div className="sm:col-span-8 space-y-1">
                        <label htmlFor="cal-reason" className="block text-[11px] font-bold text-slate-700">
                          Lý do hiệu chỉnh (bắt buộc nếu khác 0)
                        </label>
                        <input
                          id="cal-reason"
                          type="text"
                          value={calibrationReason}
                          onChange={(e) => setCalibrationReason(e.target.value)}
                          placeholder="Ghi rõ cơ sở hiệu chỉnh (Calibration)..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="mgr-comment" className="block text-xs font-bold text-slate-700">
                      Nhận xét đánh giá của Quản lý {canEvaluate && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      id="mgr-comment"
                      rows={3}
                      disabled={!canEvaluate}
                      value={managerComment}
                      onChange={(e) => setManagerComment(e.target.value)}
                      placeholder="Nhập nhận xét chi tiết về năng lực kỹ thuật, tinh thần trách nhiệm và kết quả đầu ra..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mgr-goals" className="block text-xs font-bold text-slate-700">
                      Định hướng / Mục tiêu 90 ngày tới
                    </label>
                    <input
                      id="mgr-goals"
                      type="text"
                      disabled={!canEvaluate}
                      value={managerFeedbackGoals}
                      onChange={(e) => setManagerFeedbackGoals(e.target.value)}
                      placeholder="VD: Hoàn thiện kiến trúc microservice, hướng dẫn junior..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>

                  {/* Compensation & Promotion Proposal Box */}
                  {(canEvaluate ||
                    recommendPromotion ||
                    hasFormCompProposal ||
                    review?.recommendedTitle ||
                    review?.recommendedSalaryIncreasePct != null) && (
                    <div className="p-3.5 rounded-xl bg-blue-50/45 border border-blue-200/80 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {canEvaluate ? (
                          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0F2557] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recommendPromotion}
                              onChange={(e) => setRecommendPromotion(e.target.checked)}
                              className="w-4 h-4 accent-[#1E3A8A] cursor-pointer"
                            />
                            <span>Đề xuất Thăng Chức danh / Điều chỉnh Đãi ngộ (Trình CEO phê duyệt)</span>
                          </label>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0F2557] cursor-default">
                            <TrendingUp size={15} className="text-[#1E3A8A] shrink-0" />
                            <span>Đề xuất Thăng Chức danh / Điều chỉnh Đãi ngộ</span>
                          </div>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${compCfg.badgeClass}`}>
                          {compCfg.label}
                        </span>
                      </div>

                      {(recommendPromotion ||
                        hasFormCompProposal ||
                        review?.recommendedTitle ||
                        review?.recommendedSalaryIncreasePct != null) && (
                        <div className="space-y-2.5 pt-1 border-t border-blue-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-700">
                                Chức danh đề xuất mới
                              </label>
                              <input
                                type="text"
                                disabled={!canEvaluate}
                                value={recommendedTitle}
                                onChange={(e) => setRecommendedTitle(e.target.value)}
                                placeholder="VD: Senior Backend Engineer"
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-100"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-700">
                                Tỷ lệ tăng lương dự kiến (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                disabled={!canEvaluate}
                                value={recommendedSalaryIncreasePct}
                                onChange={(e) => setRecommendedSalaryIncreasePct(e.target.value)}
                                placeholder="VD: 12"
                                className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-100 tabular"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700">
                              Cơ sở đề xuất thăng chức / điều chỉnh đãi ngộ
                            </label>
                            <input
                              type="text"
                              disabled={!canEvaluate}
                              value={compensationReason}
                              onChange={(e) => setCompensationReason(e.target.value)}
                              placeholder="VD: Dẫn dắt dự án trọng điểm vượt SLA, đạt hạng S..."
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-100"
                            />
                          </div>

                          {canEvaluate && hasFormCompProposal && projectedFinalScore < 75.0 && (
                            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 space-y-1">
                              <p className="text-[11px] font-bold text-orange-800 flex items-center gap-1">
                                <AlertTriangle size={12} />
                                <span>Điểm dự kiến ({projectedFinalScore}) &lt; 75.0 — bắt buộc nhập giải trình ngoại lệ:</span>
                              </p>
                              <input
                                type="text"
                                value={exceptionJustification}
                                onChange={(e) => setExceptionJustification(e.target.value)}
                                placeholder="Nhập giải trình ngoại lệ trình Giám đốc / CEO xem xét..."
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-orange-300 rounded-lg outline-none"
                              />
                            </div>
                          )}

                          {/* Strict B-10 Salary Privacy Gate */}
                          {canViewSalaryMoney ? (
                            <div className="p-3 rounded-xl bg-white border border-blue-200 space-y-2">
                              <p className="text-[11px] font-bold text-[#1E3A8A] flex items-center gap-1.5">
                                <ShieldCheck size={13} />
                                <span>Dữ liệu Lương Tham chiếu (Chỉ hiển thị với Giám đốc / CEO theo B-10)</span>
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] tabular">
                                <div>
                                  <span className="text-slate-500 block">Lương CB hiện tại:</span>
                                  <strong className="text-slate-900">{formatCurrencyVND(review?.currentBaseSalary)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Phụ cấp hiện tại:</span>
                                  <strong className="text-slate-900">{formatCurrencyVND(review?.currentAllowance)}</strong>
                                </div>
                              </div>
                              {canEvaluate && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={recommendedNewBaseSalary}
                                    onChange={(e) => setRecommendedNewBaseSalary(e.target.value)}
                                    placeholder="Đề xuất Lương CB mới (VNĐ)..."
                                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 tabular"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={recommendedNewAllowance}
                                    onChange={(e) => setRecommendedNewAllowance(e.target.value)}
                                    placeholder="Đề xuất Phụ cấp mới (VNĐ)..."
                                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 tabular"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <Lock size={12} className="text-slate-400 shrink-0" />
                              <span>
                                Theo nguyên tắc bảo mật B-10, số tiền lương VNĐ tuyệt đối được ẩn khỏi vai trò hiện tại; quản lý chỉ đề xuất % tăng dự kiến.
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {canEvaluate && (
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                      >
                        <Award size={14} />
                        <span>{submitting ? 'Đang lưu...' : 'Lưu & Gửi Kết quả Đánh giá'}</span>
                      </button>
                    </div>
                  )}
                </form>

                {/* 4. Escalation & Executive Approval Panel (DIRECTOR_APPROVAL_PENDING) */}
                {(review?.escalationReasons?.length > 0 || canShowFinalDecisionPanel) && (
                  <div className="p-4 rounded-2xl bg-orange-50/55 border border-orange-200 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-orange-600" />
                        <span>Quy trình Leo thang &amp; Phê duyệt Cấp trên</span>
                      </h3>
                      {review?.finalApproverName && (
                        <span className="text-[11px] text-slate-600 tabular">
                          Đã duyệt bởi <strong>{review.finalApproverName}</strong> ({formatDateTimeVN(review.finalApprovedAt)})
                        </span>
                      )}
                    </div>

                    {review?.escalationReasons?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {review.escalationReasons.map((reason, idx) => (
                          <span
                            key={`esc-${idx}`}
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white text-orange-800 border border-orange-200"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {canShowFinalDecisionPanel && (
                      <div className="space-y-3 pt-2 border-t border-orange-200/80">
                        {canApproveFinalHere ? (
                          <>
                            {isCeoOrAdmin && hasPendingComp && (
                              <div className="p-3.5 rounded-xl bg-white border border-blue-200 space-y-3">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0F2557] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={approveCompensation}
                                    onChange={(e) => setApproveCompensation(e.target.checked)}
                                    className="w-4 h-4 accent-[#1E3A8A]"
                                  />
                                  <span>Đồng ý Phê duyệt Thăng chức &amp; Điều chỉnh Lương (tự động ghi Salary History)</span>
                                </label>

                                {approveCompensation && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-slate-700">Chức danh chốt</label>
                                      <input
                                        type="text"
                                        value={overrideTitle}
                                        onChange={(e) => setOverrideTitle(e.target.value)}
                                        placeholder={review?.recommendedTitle || 'Giữ nguyên nếu không đổi'}
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-slate-700">Ghi chú quyết định</label>
                                      <input
                                        type="text"
                                        value={compensationNote}
                                        onChange={(e) => setCompensationNote(e.target.value)}
                                        placeholder="Ghi chú lưu Salary History..."
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-slate-700">
                                        Lương CB mới (VNĐ - bỏ trống tự tính theo %{review?.recommendedSalaryIncreasePct ?? 0})
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={ceoNewBaseSalary}
                                        onChange={(e) => setCeoNewBaseSalary(e.target.value)}
                                        placeholder="VD: 35000000"
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 tabular"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-slate-700">
                                        Phụ cấp mới (VNĐ - tùy chọn)
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={ceoNewAllowance}
                                        onChange={(e) => setCeoNewAllowance(e.target.value)}
                                        placeholder="VD: 3000000"
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 tabular"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-xl bg-white border border-slate-200">
                              <div className="sm:col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700">Hiệu chỉnh cuối (±5đ)</label>
                                <input
                                  type="number"
                                  min={-5}
                                  max={5}
                                  step={0.5}
                                  value={ceoCalDelta}
                                  onChange={(e) => setCeoCalDelta(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none tabular"
                                />
                              </div>
                              <div className="sm:col-span-8 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700">Lý do hiệu chỉnh cuối (nếu đổi điểm)</label>
                                <input
                                  type="text"
                                  value={ceoCalReason}
                                  onChange={(e) => setCeoCalReason(e.target.value)}
                                  placeholder="Tùy chọn nếu giữ nguyên điểm..."
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 rounded-xl bg-white border border-orange-200 text-xs text-orange-800">
                            Phiếu này có đề xuất <strong>Thăng chức danh / Điều chỉnh Lương</strong> (hoặc là phiếu của Giám đốc Phòng), cần <strong>Tổng Giám Đốc (CEO)</strong> phê duyệt chốt cuối cùng. Bạn vẫn có thể trả lại để hiệu chỉnh nếu cần.
                          </div>
                        )}

                        {showRejectBox && (
                          <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2">
                            <label className="block text-xs font-bold text-rose-800">
                              Lý do trả lại để Trưởng phòng / Kỹ sư hiệu chỉnh <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={2}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Nhập rõ nội dung cần bổ sung hoặc điều chỉnh lại..."
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-rose-200 rounded-lg outline-none focus:border-rose-400"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {showRejectBox ? (
                            <>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setShowRejectBox(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                              >
                                Hủy trả lại
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleFinalDecision('REJECTED_FOR_REVISION')}
                                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                              >
                                {submitting ? 'Đang gửi...' : 'Xác nhận Trả lại Hiệu chỉnh'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setShowRejectBox(true)}
                                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                              >
                                <RotateCcw size={13} />
                                <span>Trả lại Hiệu chỉnh</span>
                              </button>

                              {canApproveFinalHere && (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleFinalDecision('APPROVED')}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>{submitting ? 'Đang phê duyệt...' : 'Phê duyệt & Chốt Kết quả'}</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3 text-xs text-slate-500">
          <span>
            Kỳ: <strong className="text-slate-800">{review?.cycleTitle || review?.cycleCode}</strong> •{' '}
            {formatDateVN(review?.periodStart)} → {formatDateVN(review?.periodEnd)}
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
