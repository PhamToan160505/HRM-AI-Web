import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GitCompareArrows, History } from 'lucide-react';
import { formatCurrencyVND } from '../../../../utils/currency';
import { summarizeOfferDiff } from '../../../../utils/offer';
import OfferPreview from './OfferPreview';

function formatDiff(value, type) {
  if (value === undefined || value === null || value === '') return 'Chưa có';
  if (type === 'currency') return formatCurrencyVND(value);
  if (type === 'percent') return `${value}%`;
  return String(value);
}

const OFFER_STATUS_LABELS = {
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  SENT: 'Đã gửi ứng viên',
  ACCEPTED: 'Ứng viên đã nhận'
};

export default function OfferReviewPanel({ offers, application }) {
  const [showPreview, setShowPreview] = useState(true);
  const current = offers.find(item => item.status === 'PENDING_APPROVAL')
    || offers.find(item => item.status === 'APPROVED')
    || offers[0];
  if (!current) return <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Không tìm thấy phiên bản offer để xem xét.</div>;
  const previous = offers.find(item => item.id === current.previousOfferId)
    || offers.find(item => item.versionNumber === current.versionNumber - 1);
  const changes = summarizeOfferDiff(current, previous);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-blue-600 shadow-sm"><History size={19} /></span>
          <div><p className="font-bold text-slate-900">Offer phiên bản {current.versionNumber}</p><p className="text-xs text-slate-500">{OFFER_STATUS_LABELS[current.status] || current.status} · không thể sửa trực tiếp sau khi duyệt</p></div>
        </div>
        <button type="button" onClick={() => setShowPreview(value => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
          {showPreview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{showPreview ? 'Thu gọn' : 'Xem toàn bộ'}
        </button>
      </div>

      {previous && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-violet-900"><GitCompareArrows size={17} />Thay đổi so với phiên bản {previous.versionNumber}</h4>
          {changes.length ? (
            <div className="mt-3 space-y-2">
              {changes.map(([label, before, after, type]) => (
                <div key={label} className="grid gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs sm:grid-cols-[150px_1fr_24px_1fr] sm:items-center">
                  <strong className="text-slate-700">{label}</strong><span className="line-clamp-2 text-slate-500">{formatDiff(before, type)}</span><span className="hidden text-center text-violet-400 sm:block">→</span><span className="line-clamp-2 font-semibold text-violet-900">{formatDiff(after, type)}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-2 text-xs text-violet-700">Không có thay đổi ở các trường chính.</p>}
        </div>
      )}

      {showPreview && <OfferPreview offer={current} candidateName={application?.fullName} />}
    </div>
  );
}
