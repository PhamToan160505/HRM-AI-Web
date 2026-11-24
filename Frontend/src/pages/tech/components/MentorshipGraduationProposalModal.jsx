import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Award, X, Loader2, CheckCircle2, Star } from 'lucide-react';
import api from '../../../services/api';

/**
 * Modal cho phép Mentor gửi Nhận xét Tổng kết & Đề xuất Tốt nghiệp
 * để Trưởng phòng / Giám đốc Công nghệ thẩm định và phê duyệt (Maker-Checker).
 */
export default function MentorshipGraduationProposalModal({
  program,
  onClose,
  onProposed,
  toast,
}) {
  const [mentorSummary, setMentorSummary] = useState(program?.mentorSummary || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMentorSummary(program?.mentorSummary || '');
  }, [program]);

  if (!program) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mentorSummary.trim()) {
      toast?.show(
        'Thiếu nội dung',
        'Vui lòng nhập nhận xét tổng kết quá trình kèm cặp trước khi gửi đề xuất',
        'warning'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/api/tech/mentorship/programs/${program.id}/propose-graduation`, {
        mentorSummary: mentorSummary.trim(),
      });
      toast?.show(
        'Đã gửi đề xuất',
        'Đã gửi nhận xét tổng kết & đề xuất Tốt nghiệp tới Trưởng phòng phê duyệt',
        'success'
      );
      onProposed?.(res.data?.data);
      onClose?.();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể gửi đề xuất tốt nghiệp', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        <div className="bg-gradient-to-r from-[#0F2557] to-emerald-700 px-6 py-4 text-white flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award size={18} />
              <span>Đề xuất Tốt nghiệp Kèm cặp 1-1</span>
            </h3>
            <p className="text-xs text-blue-100/90 mt-0.5">
              Mentor gửi nhận xét tổng kết để Trưởng phòng thẩm định &amp; phê duyệt
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.()}
            className="p-1.5 text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="font-bold text-slate-900">{program.programTitle}</div>
            <div className="flex items-center justify-between gap-2 flex-wrap text-slate-600">
              <span>
                Mentee: <strong className="text-slate-900">{program.menteeName}</strong>
              </span>
              <span className="inline-flex items-center gap-2 tabular">
                <span>{program.checkinCount || 0} buổi check-in</span>
                {program.averageRating ? (
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    {Number(program.averageRating).toFixed(1)}/5.0
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2 text-[11px] text-blue-900 leading-relaxed">
            <CheckCircle2 size={15} className="shrink-0 text-blue-600 mt-0.5" />
            <span>
              Theo nguyên tắc <strong>kiểm soát chéo (Maker-Checker)</strong>, sau khi bạn gửi đề xuất,{' '}
              <strong>Trưởng phòng / Giám đốc Công nghệ</strong> sẽ duyệt để chính thức hoàn tất Tốt nghiệp và ghi nhận{' '}
              <em>Sự kiện Nghề nghiệp</em> cho cả Mentor và Mentee.
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Nhận xét tổng kết &amp; Đề xuất của Mentor *
            </label>
            <textarea
              rows={4}
              required
              value={mentorSummary}
              onChange={(e) => setMentorSummary(e.target.value)}
              placeholder="VD: Mentee Phạm Hương Lan đã nắm vững Clean Architecture, hoàn thành toàn bộ bài tập Kafka và áp dụng tốt vào dự án thực tế. Đề xuất Trưởng phòng phê duyệt Tốt nghiệp chương trình."
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onClose?.()}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !mentorSummary.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>
                {submitting
                  ? 'Đang gửi...'
                  : program.graduationProposed
                    ? 'Cập nhật Đề xuất Tốt nghiệp'
                    : 'Gửi Đề xuất Tốt nghiệp'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
