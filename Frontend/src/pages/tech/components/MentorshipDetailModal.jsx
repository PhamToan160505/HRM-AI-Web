import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users2,
  X,
  Star,
  Award,
  MessageSquare,
  Pencil,
  Plus,
} from 'lucide-react';
import { formatDateVN } from '../techHelpers';

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Đang kèm cặp',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  CANCELLED: {
    label: 'Đã kết thúc sớm',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

/**
 * Modal Xem Chi tiết Chương trình Kèm cặp 1-1.
 * Dùng chung cho cả Quản lý (TechMentorshipPanel) và Mentor/Mentee (MyTechProjectsPage).
 */
export default function MentorshipDetailModal({
  program,
  onClose,
  onOpenCheckins,
  onEdit,
  onInspectEngineer,
  onProposeGraduation,
  canCheckin = true,
  isMentor = false,
}) {
  useEffect(() => {
    if (!program) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [program, onClose]);

  if (!program) return null;

  const statusInfo = STATUS_CONFIG[program.status] || {
    label: program.status,
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users2 size={16} className="shrink-0" />
              <span>Chi tiết Chương trình Kèm cặp 1-1</span>
            </h3>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Lộ trình đào tạo, cặp ghép nối và đánh giá tiến độ
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/75 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.badge}`}>
              {statusInfo.label}
            </span>
            {program.focusSkillName && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                🎯 Kỹ năng: {program.focusSkillName}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">{program.programTitle}</h4>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <strong className="block text-slate-500 text-[11px] mb-0.5">Mục tiêu Đào tạo cụ thể:</strong>
              {program.targetGoal}
            </div>
          </div>

          {/* Grid Mentor & Mentee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Mentor Dẫn dắt
              </span>
              {onInspectEngineer ? (
                <button
                  type="button"
                  onClick={() => onInspectEngineer(program.mentorId)}
                  className="text-xs font-bold text-slate-900 block hover:text-blue-700 hover:underline cursor-pointer text-left"
                >
                  {program.mentorName}
                </button>
              ) : (
                <strong className="text-xs text-slate-900 block">{program.mentorName}</strong>
              )}
              <span className="text-[11px] text-slate-500 block truncate">
                {program.mentorEmail || 'Chưa có email'}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Kỹ sư Kèm cặp (Mentee)
              </span>
              {onInspectEngineer ? (
                <button
                  type="button"
                  onClick={() => onInspectEngineer(program.menteeId)}
                  className="text-xs font-bold text-slate-900 block hover:text-emerald-700 hover:underline cursor-pointer text-left"
                >
                  {program.menteeName}
                </button>
              ) : (
                <strong className="text-xs text-slate-900 block">{program.menteeName}</strong>
              )}
              <span className="text-[11px] text-slate-500 block truncate">
                {program.menteeEmail || 'Chưa có email'}
              </span>
            </div>
          </div>

          {/* Timeline & Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs tabular">
            <div>
              <span className="text-slate-500 block text-[11px]">Thời gian triển khai:</span>
              <strong className="text-slate-800 mt-0.5 block">
                {formatDateVN(program.startDate)} → {formatDateVN(program.endDate)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Tiến độ Check-in:</span>
              <strong className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                <span>{program.checkinCount || 0} buổi</span>
                {program.averageRating ? (
                  <span className="text-amber-700 flex items-center gap-0.5 text-[11px] font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    {Number(program.averageRating).toFixed(1)} / 5.0
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal italic text-[11px]">(Chưa đánh giá)</span>
                )}
              </strong>
            </div>
          </div>

          {/* Đề xuất Tốt nghiệp & Nhận xét tổng kết của Mentor */}
          {program.graduationProposed && program.mentorSummary && (
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1 text-xs">
              <strong className="text-amber-800 font-bold flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1">
                  <Award size={13} className="text-amber-600" />
                  <span>Đề xuất Tốt nghiệp &amp; Nhận xét Tổng kết từ Mentor:</span>
                </span>
                {program.status === 'ACTIVE' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Chờ Trưởng phòng duyệt
                  </span>
                )}
              </strong>
              <p className="text-slate-700 leading-relaxed italic">{program.mentorSummary}</p>
            </div>
          )}

          {/* Đánh giá tốt nghiệp nếu đã hoàn thành */}
          {program.finalAssessment && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1 text-xs">
              <strong className="text-emerald-800 font-bold flex items-center gap-1 text-[11px]">
                <Award size={13} className="text-emerald-600" />
                <span>Đánh giá Tốt nghiệp Kèm cặp (Quản lý):</span>
              </strong>
              <p className="text-slate-700 leading-relaxed italic">{program.finalAssessment}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenCheckins && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenCheckins(program, false);
                }}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <MessageSquare size={13} />
                <span>Lịch sử Check-in</span>
              </button>
            )}
            {onOpenCheckins && canCheckin && program.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenCheckins(program, true);
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Ghi nhận Check-in 1-1</span>
              </button>
            )}
            {isMentor && onProposeGraduation && program.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onProposeGraduation(program);
                }}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Award size={13} />
                <span>{program.graduationProposed ? 'Cập nhật Đề xuất' : 'Đề xuất Tốt nghiệp'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onEdit(program);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Pencil size={12} />
                <span>Sửa</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onClose?.()}
              className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-200/80 hover:bg-slate-300 rounded-lg transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
