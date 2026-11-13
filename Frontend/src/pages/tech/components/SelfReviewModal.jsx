import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  Activity,
  Award,
  TrendingUp,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { LEVEL_ORDER, PROFICIENCY_OPTIONS, formatDateVN } from '../techHelpers';

const LEVEL_KEYS = ['FRESHER', 'JUNIOR', 'MIDDLE', 'SENIOR', 'EXPERT'];

export default function SelfReviewModal({
  isOpen,
  onClose,
  review,
  availableSkills = [],
  mySkills = [],
  onSuccess,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [selfSummary, setSelfSummary] = useState('');
  const [selfAchievements, setSelfAchievements] = useState('');
  const [selfChallenges, setSelfChallenges] = useState('');
  const [selfGoalsNext, setSelfGoalsNext] = useState('');
  const [selfRatingScore, setSelfRatingScore] = useState(80);
  const [promotions, setPromotions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const formBodyRef = useRef(null);

  const reportError = (msg) => {
    setErrorMsg(msg);
    formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    toastRef.current?.show('Thông tin chưa hợp lệ', msg, 'error');
  };

  const mySkillMap = useMemo(() => {
    const map = {};
    (mySkills || []).forEach((s) => {
      if (s.skillId != null) map[String(s.skillId)] = s;
    });
    return map;
  }, [mySkills]);

  useEffect(() => {
    if (!isOpen || !review) return;
    setSelfSummary(review.selfSummary || '');
    setSelfAchievements(review.selfAchievements || '');
    setSelfChallenges(review.selfChallenges || '');
    setSelfGoalsNext(review.selfGoalsNext || '');
    setSelfRatingScore(
      review.selfRatingScore !== null && review.selfRatingScore !== undefined
        ? Number(review.selfRatingScore)
        : Math.round(Number(review.telemetryTotalScore || 80))
    );
    const existingItems = (review.skillPromotionItems || []).map((item) => ({
      skillId: item.skillId ? String(item.skillId) : '',
      targetLevel: item.targetLevel || 'MIDDLE',
      evidenceNote: item.evidenceNote || '',
      evidenceUrl: item.evidenceUrl || '',
    }));
    setPromotions(existingItems);
    setErrorMsg('');
  }, [isOpen, review]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
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
  }, [isOpen, submitting, onClose]);

  const getAllowedTargetLevels = (skillIdStr) => {
    const existing = skillIdStr ? mySkillMap[String(skillIdStr)] : null;
    if (!existing) return LEVEL_KEYS;
    const curOrder = LEVEL_ORDER[existing.proficiencyLevel] ?? -1;
    return LEVEL_KEYS.filter((lvl) => (LEVEL_ORDER[lvl] ?? 0) > curOrder);
  };

  const handleAddPromotion = () => {
    if (promotions.length >= 3) return;
    const usedIds = new Set(promotions.map((p) => String(p.skillId)));
    const candidate = availableSkills.find((sk) => {
      if (usedIds.has(String(sk.id))) return false;
      return getAllowedTargetLevels(sk.id).length > 0;
    });
    if (!candidate) {
      reportError('Không còn kỹ năng phù hợp để đề xuất nâng bậc thêm (tối đa 3 kỹ năng/kỳ và phải thấp hơn bậc Expert).');
      return;
    }
    const allowed = getAllowedTargetLevels(candidate.id);
    setPromotions((prev) => [
      ...prev,
      {
        skillId: String(candidate.id),
        targetLevel: allowed[0] || 'MIDDLE',
        evidenceNote: '',
        evidenceUrl: '',
      },
    ]);
  };

  const handlePromotionChange = (idx, field, value) => {
    setPromotions((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        if (field === 'skillId') {
          const allowed = getAllowedTargetLevels(value);
          return {
            ...row,
            skillId: value,
            targetLevel: allowed.includes(row.targetLevel) ? row.targetLevel : allowed[0] || 'MIDDLE',
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleRemovePromotion = (idx) => {
    setPromotions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!review) return;
    setErrorMsg('');

    if (!selfSummary.trim()) {
      reportError('Vui lòng nhập tóm tắt kết quả công việc nổi bật trong kỳ.');
      return;
    }
    if (String(selfRatingScore).trim() === '') {
      reportError('Vui lòng nhập điểm tự đánh giá trong khoảng 0 – 100.');
      return;
    }
    const numericScore = Number(selfRatingScore);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      reportError('Điểm tự đánh giá phải nằm trong khoảng 0 – 100.');
      return;
    }

    const chosenIds = new Set();
    for (let i = 0; i < promotions.length; i += 1) {
      const p = promotions[i];
      if (!p.skillId) {
        reportError(`Đề xuất kỹ năng #${i + 1}: Vui lòng chọn kỹ năng.`);
        return;
      }
      if (chosenIds.has(String(p.skillId))) {
        reportError('Không được chọn trùng cùng một kỹ năng trong danh sách đề xuất nâng bậc.');
        return;
      }
      chosenIds.add(String(p.skillId));
      const allowed = getAllowedTargetLevels(p.skillId);
      if (!allowed.includes(p.targetLevel)) {
        reportError(`Đề xuất kỹ năng #${i + 1}: Bậc mục tiêu phải cao hơn bậc hiện tại của bạn.`);
        return;
      }
      if (!p.evidenceNote.trim()) {
        reportError(`Đề xuất kỹ năng #${i + 1}: Vui lòng nhập minh chứng dự án hoặc đóng góp kỹ thuật.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        selfSummary: selfSummary.trim(),
        selfAchievements: selfAchievements.trim() || null,
        selfChallenges: selfChallenges.trim() || null,
        selfGoalsNext: selfGoalsNext.trim() || null,
        selfRatingScore: numericScore,
        skillPromotions: promotions.map((p) => ({
          skillId: Number(p.skillId),
          targetLevel: p.targetLevel,
          evidenceNote: p.evidenceNote.trim(),
          evidenceUrl: p.evidenceUrl.trim() || null,
        })),
      };
      await api.post(`/api/tech/reviews/${review.id}/self-review`, payload);
      toastRef.current?.show(
        'Đã gửi Tự đánh giá',
        'Bản tự đánh giá và đề xuất nâng bậc đã được chuyển tới Trưởng phòng / Giám đốc Công nghệ thẩm định.',
        'success'
      );
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      reportError(err.response?.data?.message || 'Không thể gửi bản tự đánh giá.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !review) return null;

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="self-review-modal-title"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        <div className="px-6 py-4 bg-[#0F2557] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 border border-white/20 text-blue-100">
                {review.cycleCode}
              </span>
              <span className="text-[11px] text-blue-100/80 tabular">
                {formatDateVN(review.periodStart)} → {formatDateVN(review.periodEnd)}
              </span>
            </div>
            <h2 id="self-review-modal-title" className="text-base font-bold text-white mt-1 truncate">
              Tự đánh giá Hiệu suất &amp; Đề xuất Nâng bậc Kỹ năng
            </h2>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {errorMsg && (
            <div className="px-6 pt-3.5 pb-1 shrink-0">
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-medium text-rose-700 shadow-2xs"
              >
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          <div ref={formBodyRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {review.status === 'REJECTED_FOR_REVISION' && review.rejectionReason && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>Phiếu đánh giá được trả lại để hiệu chỉnh:</span>
                </p>
                <p className="text-[11px] leading-relaxed">{review.rejectionReason}</p>
              </div>
            )}

          {/* Live 4-Pillar Telemetry Snapshot */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1E3A8A] flex items-center gap-1.5">
                <Activity size={14} className="text-blue-600" />
                <span>Điểm Dữ liệu Thực tế Telemetry trong kỳ (Trọng số 60%)</span>
              </span>
              <span className="text-sm font-extrabold text-[#0F2557] tabular">
                {Number(review.telemetryTotalScore || 0).toFixed(1)} / 100 điểm
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular">
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <span className="text-slate-500 block">1. Delivery</span>
                <strong className="text-slate-900">{Number(review.deliveryScore || 0).toFixed(1)} / 35</strong>
              </div>
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <span className="text-slate-500 block">2. Impact</span>
                <strong className="text-slate-900">{Number(review.impactScore || 0).toFixed(1)} / 25</strong>
              </div>
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <span className="text-slate-500 block">3. Capability</span>
                <strong className="text-slate-900">{Number(review.capabilityScore || 0).toFixed(1)} / 20</strong>
              </div>
              <div className="p-2 rounded-lg bg-white border border-blue-100">
                <span className="text-slate-500 block">4. Discipline</span>
                <strong className="text-slate-900">{Number(review.disciplineScore || 0).toFixed(1)} / 20</strong>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label htmlFor="self-summary" className="block text-xs font-bold text-slate-700">
                Tóm tắt công việc &amp; đóng góp nổi bật trong kỳ <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="self-summary"
                rows={3}
                value={selfSummary}
                onChange={(e) => setSelfSummary(e.target.value)}
                placeholder="VD: Thiết kế và hoàn thiện phân hệ X, tối ưu query giảm 45% thời gian phản hồi, review 18 PR..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label htmlFor="self-achievements" className="block text-xs font-bold text-slate-700">
                  Thành tựu / Kết quả đo lường được
                </label>
                <textarea
                  id="self-achievements"
                  rows={2}
                  value={selfAchievements}
                  onChange={(e) => setSelfAchievements(e.target.value)}
                  placeholder="VD: Đạt 100% milestone đúng hạn, zero bug production..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="self-challenges" className="block text-xs font-bold text-slate-700">
                  Khó khăn đã gặp &amp; Bài học kỹ thuật
                </label>
                <textarea
                  id="self-challenges"
                  rows={2}
                  value={selfChallenges}
                  onChange={(e) => setSelfChallenges(e.target.value)}
                  placeholder="VD: Xử lý race condition hoặc bottleneck ở hệ thống tích hợp..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
              <div className="sm:col-span-8 space-y-1">
                <label htmlFor="self-goals" className="block text-xs font-bold text-slate-700">
                  Mục tiêu phát triển kỳ tiếp theo
                </label>
                <input
                  id="self-goals"
                  type="text"
                  value={selfGoalsNext}
                  onChange={(e) => setSelfGoalsNext(e.target.value)}
                  placeholder="VD: Thi chứng chỉ AWS SAA-C03 và lead kiến trúc service mới..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="self-score" className="text-xs font-bold text-slate-700">
                    Tự chấm (0–100)
                  </label>
                  <span className="text-xs font-extrabold text-[#1E3A8A] tabular">{selfRatingScore}/100</span>
                </div>
                <input
                  id="self-score"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selfRatingScore}
                  onChange={(e) => setSelfRatingScore(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 tabular"
                />
              </div>
            </div>
          </div>

          {/* Skill Promotion Proposals (0..3) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-[#1E3A8A]" />
                  <span>Đề xuất Nâng bậc Kỹ năng chuyên môn ({promotions.length}/3)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Khi được duyệt, kỹ năng sẽ tự động cập nhật cấp bậc mới &amp; cấp tích xanh trong Hồ sơ Năng lực
                </p>
              </div>

              <button
                type="button"
                disabled={promotions.length >= 3 || availableSkills.length === 0}
                onClick={handleAddPromotion}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-45"
              >
                <Plus size={13} />
                <span>Thêm đề xuất nâng bậc</span>
              </button>
            </div>

            {promotions.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-400">
                Chưa có đề xuất nâng bậc kỹ năng nào. Bấm &quot;Thêm đề xuất nâng bậc&quot; nếu bạn sẵn sàng lên bậc cao hơn.
              </div>
            ) : (
              <div className="space-y-3">
                {promotions.map((item, idx) => {
                  const currentSkill = item.skillId ? mySkillMap[String(item.skillId)] : null;
                  const allowedLevels = getAllowedTargetLevels(item.skillId);
                  return (
                    <div
                      key={`promo-${idx}`}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#1E3A8A] flex items-center gap-1">
                          <Award size={12} />
                          <span>Kỹ năng đề xuất #{idx + 1}</span>
                          <span className="text-slate-400 font-normal">
                            ({currentSkill ? `Hiện tại: ${currentSkill.proficiencyLevel}` : 'Kỹ năng mới'})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePromotion(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa đề xuất này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <select
                          value={item.skillId}
                          onChange={(e) => handlePromotionChange(idx, 'skillId', e.target.value)}
                          className="px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {availableSkills.map((sk) => {
                            const allowedForSk = getAllowedTargetLevels(sk.id);
                            const alreadyUsed = promotions.some(
                              (other, oi) => oi !== idx && String(other.skillId) === String(sk.id)
                            );
                            const disabled = allowedForSk.length === 0 || alreadyUsed;
                            return (
                              <option key={sk.id} value={String(sk.id)} disabled={disabled}>
                                {sk.skillName || sk.name} {allowedForSk.length === 0 ? '(Đã đạt Expert)' : ''}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          value={item.targetLevel}
                          onChange={(e) => handlePromotionChange(idx, 'targetLevel', e.target.value)}
                          className="px-3 py-2 text-xs font-bold text-[#1E3A8A] bg-blue-50/70 border border-blue-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {PROFICIENCY_OPTIONS.filter((opt) => allowedLevels.includes(opt.value)).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              Mục tiêu: {opt.value}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          maxLength={500}
                          value={item.evidenceNote}
                          onChange={(e) => handlePromotionChange(idx, 'evidenceNote', e.target.value)}
                          placeholder="Minh chứng cụ thể (VD: Thiết kế microservice X, xử lý 500 req/s) *"
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                        />
                        <input
                          type="url"
                          maxLength={500}
                          value={item.evidenceUrl}
                          onChange={(e) => handlePromotionChange(idx, 'evidenceUrl', e.target.value)}
                          placeholder="Link GitHub PR / Jira Ticket / Confluence minh chứng (tùy chọn)"
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <Send size={14} />
              <span>{submitting ? 'Đang gửi...' : 'Gửi Tự đánh giá'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
