import React from 'react';
import { Clock3, Eye, MailCheck, MessageSquareText, Send } from 'lucide-react';
import { parseJson } from '../../../../utils/offer';

const STATUS_LABELS = {
  ACTIVE: 'Đang chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  DECLINED: 'Đã từ chối',
  NEGOTIATION_CLOSED: 'Yêu cầu thương lượng',
  SUPERSEDED: 'Đã thay thế',
  EXPIRED: 'Đã hết hạn',
  REVOKED: 'Đã thu hồi',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  DRAFT: 'Bản nháp',
  SENT: 'Đã gửi ứng viên'
};

function formatDateTime(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function OfferActivityCard({ activity }) {
  const latest = activity.find(item => item.dispatchStatus) || activity[0];
  if (!latest) return null;
  const response = parseJson(latest.candidateResponseJson, {});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Theo dõi Offer-to-Contract</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Offer phiên bản {latest.versionNumber}</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{STATUS_LABELS[latest.dispatchStatus] || STATUS_LABELS[latest.offerStatus] || latest.offerStatus}</span>
      </div>
      {latest.dispatchStatus ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Send size={14} />Đã gửi</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(latest.sentAt)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Eye size={14} />Ứng viên đã xem</p><p className="mt-1 text-sm font-bold text-slate-800">{latest.viewCount || 0} lần</p><p className="mt-0.5 text-xs text-slate-500">{formatDateTime(latest.viewedAt)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock3 size={14} />Hạn phản hồi</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(latest.responseDeadline)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MailCheck size={14} />Phản hồi lúc</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(latest.respondedAt)}</p></div>
        </div>
      ) : <p className="mt-3 text-sm text-slate-500">Offer chưa được gửi cho ứng viên.</p>}
      {(latest.candidateComment || response.topics?.length > 0) && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-violet-900"><MessageSquareText size={16} />Nội dung phản hồi/thương lượng</p>
          {response.topics?.length > 0 && <p className="mt-2 text-xs font-semibold text-violet-700">Chủ đề: {response.topics.join(', ')}</p>}
          {response.salaryExpectation && <p className="mt-1 text-xs text-violet-800">Mức mong muốn: {Number(response.salaryExpectation).toLocaleString('vi-VN')} đ</p>}
          {response.preferredStartDate && <p className="mt-1 text-xs text-violet-800">Ngày bắt đầu mong muốn: {response.preferredStartDate}</p>}
          {latest.candidateComment && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-violet-950">{latest.candidateComment}</p>}
        </div>
      )}
    </section>
  );
}
