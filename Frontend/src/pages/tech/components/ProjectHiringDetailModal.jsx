import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Briefcase,
  X,
  RefreshCw,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  Megaphone,
  History,
  UserCheck,
  Armchair,
} from 'lucide-react';
import api from '../../../services/api';

const REQ_STATUS_META = {
  DRAFT: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_APPROVAL: { label: 'Chờ phê duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  REVISION_REQUIRED: { label: 'Yêu cầu chỉnh sửa', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  APPROVED: { label: 'HR đang tuyển', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  REJECTED: { label: 'Từ chối', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  FULFILLED: { label: 'Đã tuyển đủ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const SEAT_STATUS_META = {
  AVAILABLE: { label: 'Đang mở tuyển', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESERVED: { label: 'Đang giữ ghế (Offer)', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  ACCEPTED: { label: 'Ứng viên nhận Offer', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  JOINED: { label: 'Đã nhận việc', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Đã đóng', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const POSTING_STATUS_META = {
  DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  OPEN: { label: 'Đang mở nhận hồ sơ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSED: { label: 'Tạm dừng', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  FILLED: { label: 'Đã tuyển đủ', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  EXPIRED: { label: 'Hết hạn nộp', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const CANDIDATE_STATUS_LABELS = {
  PENDING_HR_CV_REVIEW: 'HR đang sàng lọc CV',
  PENDING_TECH_CV_REVIEW: 'Tech đang duyệt CV',
  PENDING_INTERVIEW_1: 'Chờ Phỏng vấn Vòng 1',
  PENDING_INTERVIEW_2: 'Chờ Phỏng vấn Vòng 2',
  PENDING_HR_OFFER: 'HR đang soạn Offer',
  PENDING_OFFER_APPROVAL: 'Chờ duyệt Offer',
  OFFER_INTERNALLY_APPROVED: 'Offer đã duyệt nội bộ',
  OFFER_SENT: 'Đã gửi Offer',
  OFFER_ACCEPTED: 'Ứng viên đã nhận Offer',
  OFFER_DECLINED: 'Ứng viên từ chối Offer',
  OFFER_EXPIRED: 'Offer hết hạn',
  OFFER_REVOKED: 'Đã thu hồi Offer',
  REJECTED: 'Không phù hợp',
  WITHDRAWN: 'Ứng viên rút hồ sơ',
  TALENT_POOL: 'Lưu kho nhân tài',
};

const ROLE_LABELS = {
  TRUONG_PHONG: 'Trưởng phòng',
  GIAM_DOC_PHONG_BAN: 'Giám đốc phòng ban',
  CEO: 'Tổng Giám đốc',
  ADMIN: 'Quản trị viên',
  HR: 'Phòng Nhân sự',
};

const formatDateTimeVN = (val) => {
  if (!val) return '--';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const parseSkills = (jsonStr) => {
  if (!jsonStr) return [];
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

/**
 * Popup Chi tiết & Lịch sử đang tuyển của một Yêu cầu Tuyển dụng gắn với Dự án Công nghệ.
 * Chỉ đóng khi người dùng bấm nút "X" hoặc "Đóng".
 */
export default function ProjectHiringDetailModal({ requisitionId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'pipeline' | 'overview'

  const loadDetail = useCallback(async () => {
    if (!requisitionId) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get(`/api/tech-hr/requisitions/${requisitionId}/hiring-detail`);
      setDetail(res.data?.data || null);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tải chi tiết lịch sử tuyển dụng.');
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);

  useEffect(() => {
    if (!requisitionId) return;
    setActiveTab('timeline');
    loadDetail();
  }, [requisitionId, loadDetail]);

  useEffect(() => {
    if (!requisitionId) return;
    document.body.style.overflow = 'hidden';
    return () => {
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [requisitionId]);

  if (!requisitionId) return null;

  const stMeta = REQ_STATUS_META[detail?.status] || {
    label: detail?.status || 'Đang tải',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const techSkills = parseSkills(detail?.requiredTechSkillsJson);
  const seats = detail?.seats || [];
  const postings = detail?.postings || [];
  const candidates = detail?.candidates || [];
  const timeline = detail?.timeline || [];

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
      >
        {/* Header Sapphire */}
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Briefcase size={16} className="text-blue-200 shrink-0" />
              <h3 className="text-base font-bold truncate">
                {detail?.title || 'Chi tiết Lịch sử Tuyển dụng'}
              </h3>
              {detail?.urgencyLevel === 'CRITICAL' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-100 border border-rose-300/40">
                  <AlertCircle size={10} /> Khẩn cấp
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/85 mt-0.5">
              {detail?.techProjectCode
                ? `Dự án ${detail.techProjectCode} — ${detail.techProjectName || ''} • Cấp bậc: ${detail.capBac || '--'} • Chỉ tiêu: ${detail.soLuong || 0} nhân sự`
                : 'Theo dõi lịch sử phê duyệt, chiến dịch HR, sổ ghế và tiến độ ứng viên'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadDetail}
              disabled={loading}
              className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-6 pt-3 pb-0 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-1">
            {[
              { id: 'timeline', label: `Lịch sử Tuyển dụng (${timeline.length})`, icon: History },
              { id: 'pipeline', label: `Chiến dịch & Ứng viên (${candidates.length})`, icon: Users },
              { id: 'overview', label: `Thông tin & Sổ ghế (${seats.length})`, icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                    isActive
                      ? 'border-[#1E3A8A] text-[#0F2557]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {detail && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border mb-2 ${stMeta.cls}`}>
              {stMeta.label}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw size={22} className="animate-spin text-blue-600" />
              <span>Đang tải chi tiết lịch sử tuyển dụng từ Phòng Nhân sự...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={loadDetail}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs tabular">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Chỉ tiêu tuyển</span>
                  <strong className="text-base font-extrabold text-slate-900">{detail?.soLuong || 0} nhân sự</strong>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                  <span className="text-[11px] text-blue-700 block">Chiến dịch HR đã mở</span>
                  <strong className="text-base font-extrabold text-[#0F2557]">{postings.length} tin tuyển</strong>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
                  <span className="text-[11px] text-indigo-700 block">Hồ sơ ứng viên</span>
                  <strong className="text-base font-extrabold text-indigo-900">{candidates.length} ứng viên</strong>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <span className="text-[11px] text-emerald-700 block">Ghế đã chốt / Nhận việc</span>
                  <strong className="text-base font-extrabold text-emerald-800">
                    {seats.filter((s) => s.status === 'ACCEPTED' || s.status === 'JOINED').length} / {seats.length || detail?.soLuong || 0}
                  </strong>
                </div>
              </div>

              {/* TAB 1: TIMELINE LỊCH SỬ TUYỂN DỤNG */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  {timeline.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                      Chưa ghi nhận mốc lịch sử chuyển trạng thái nào cho yêu cầu này.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {timeline.map((ev, idx) => {
                        const isPending = ev.statusBadge === 'PENDING';
                        const isApproved = ev.action === 'APPROVE_REQUISITION' || ev.statusBadge === 'APPROVED' || ev.statusBadge === 'OPEN';
                        const isRejected = ev.action === 'REJECT_REQUISITION' || ev.action === 'RETURN_REQUISITION';
                        const dotCls = isPending
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : isApproved
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : isRejected
                              ? 'bg-rose-100 text-rose-700 border-rose-300'
                              : 'bg-blue-100 text-blue-700 border-blue-300';
                        return (
                          <div key={`${ev.action}-${idx}`} className="relative">
                            <span
                              className={`absolute -left-6 top-1 w-6 h-6 rounded-full border flex items-center justify-center ${dotCls}`}
                            >
                              {isPending ? (
                                <Clock size={12} />
                              ) : isApproved ? (
                                <CheckCircle2 size={12} />
                              ) : ev.source === 'POSTING' ? (
                                <Megaphone size={12} />
                              ) : (
                                <History size={12} />
                              )}
                            </span>
                            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-1 text-xs">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <p className="font-bold text-slate-900">{ev.title}</p>
                                <span className="text-[11px] text-slate-500 tabular shrink-0">
                                  {formatDateTimeVN(ev.occurredAt)}
                                </span>
                              </div>
                              {ev.detail && (
                                <p className="text-[11px] text-slate-600 leading-relaxed">{ev.detail}</p>
                              )}
                              <p className="text-[11px] text-slate-500 pt-0.5">
                                Thực hiện bởi: <strong className="text-slate-700">{ev.actorName || 'Hệ thống'}</strong>
                                {ev.actorRole && ` (${ROLE_LABELS[ev.actorRole] || ev.actorRole})`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CHIẾN DỊCH & PIPELINE ỨNG VIÊN */}
              {activeTab === 'pipeline' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Megaphone size={14} className="text-blue-600" />
                      <span>Chiến dịch tuyển dụng HR đã mở ({postings.length})</span>
                    </h4>
                    {postings.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                        {detail?.status === 'APPROVED'
                          ? 'Yêu cầu đã được phê duyệt. Phòng Nhân sự chưa tạo chiến dịch / đăng tin tuyển dụng công khai cho yêu cầu này.'
                          : 'Chiến dịch tuyển dụng sẽ được Phòng Nhân sự mở sau khi yêu cầu được phê duyệt.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {postings.map((p) => {
                          const pMeta = POSTING_STATUS_META[p.status] || {
                            label: p.status,
                            cls: 'bg-slate-100 text-slate-600 border-slate-200',
                          };
                          return (
                            <div
                              key={p.postingId}
                              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900">{p.title}</p>
                                <p className="text-[11px] text-slate-500 tabular">
                                  Chỉ tiêu: <strong>{p.soLuongTuyen}</strong> • Hồ sơ nộp: <strong>{p.totalApplications}</strong> • Hạn nộp: {formatDateTimeVN(p.hanNopHoSo)}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${pMeta.cls}`}>
                                {pMeta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-indigo-600" />
                      <span>Danh sách Ứng viên đang xử lý ({candidates.length})</span>
                    </h4>
                    {candidates.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                        Chưa có ứng viên nào nộp hồ sơ vào các chiến dịch thuộc yêu cầu này.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        {candidates.map((c) => (
                          <div
                            key={c.applicationId}
                            className="p-3 bg-white flex items-center justify-between gap-3 flex-wrap text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{c.fullName}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {c.email} • Cập nhật: {formatDateTimeVN(c.updatedAt || c.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.fitScore != null && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 tabular">
                                  AI Fit: {c.fitScore}%
                                </span>
                              )}
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {CANDIDATE_STATUS_LABELS[c.approvalStatus] || c.approvalStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: THÔNG TIN YÊU CẦU & SỔ GHẾ */}
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Người đề xuất</span>
                      <strong className="text-slate-900">{detail?.requesterName || '--'}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Người phê duyệt</span>
                      <strong className="text-slate-900">{detail?.approverName || 'Chưa duyệt'}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Hình thức làm việc</span>
                      <strong className="text-slate-900">{detail?.hinhThucLamViec || '--'}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Ngân sách dự kiến</span>
                      <strong className="text-emerald-700">{detail?.budget || 'Chưa ghi ngân sách'}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[11px] text-slate-500 block mb-1">Lý do tuyển dụng</span>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">{detail?.reason || '--'}</p>
                    </div>
                    {techSkills.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mb-1.5">
                          <Sparkles size={12} className="text-blue-600" /> Bộ Kỹ năng kỹ thuật yêu cầu
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {techSkills.map((sk, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0F2557] border border-blue-200 font-semibold text-[11px]"
                            >
                              {sk.skillName || sk.name}{sk.minLevel ? ` • ${sk.minLevel}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sổ ghế tuyển dụng */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Armchair size={14} className="text-blue-600" />
                      <span>Sổ Ghế tuyển dụng (Hiring Seats: {seats.length})</span>
                    </h4>
                    {seats.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-center">
                        Ghế tuyển dụng sẽ được tự động cấp phát ngay khi yêu cầu được phê duyệt.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {seats.map((seat) => {
                          const seatMeta = SEAT_STATUS_META[seat.status] || {
                            label: seat.status,
                            cls: 'bg-slate-100 text-slate-600 border-slate-200',
                          };
                          return (
                            <div
                              key={seat.seatId}
                              className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div>
                                <p className="font-bold text-slate-900">
                                  Ghế #{seat.seatNumber} <span className="text-[10px] font-medium text-slate-400">({seat.kind})</span>
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {seat.candidateName ? `Ứng viên: ${seat.candidateName}` : 'Chưa gán ứng viên'}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${seatMeta.cls}`}>
                                {seatMeta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 tabular">
            Tạo lúc: {formatDateTimeVN(detail?.createdAt)}
          </span>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
