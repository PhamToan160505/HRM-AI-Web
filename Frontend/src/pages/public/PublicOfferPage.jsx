import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  MapPin,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatCurrencyVND } from '../../utils/currency';
import { parseJson } from '../../utils/offer';

const API_URL = import.meta.env.VITE_API_URL || '';

const ACTIONS = {
  ACCEPT: {
    label: 'Chấp nhận offer',
    description: 'Xác nhận bạn đồng ý với đề nghị làm việc này.',
    icon: Check,
    buttonClass: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200',
  },
  NEGOTIATE: {
    label: 'Trao đổi thêm',
    description: 'Gửi nội dung bạn muốn trao đổi lại với bộ phận tuyển dụng.',
    icon: MessageSquareText,
    buttonClass: 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-100',
  },
  DECLINE: {
    label: 'Từ chối offer',
    description: 'Xác nhận bạn chưa thể tiếp nhận đề nghị làm việc này.',
    icon: X,
    buttonClass: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-100',
  },
};

const STATUS_CONTENT = {
  ACCEPTED: {
    title: 'Bạn đã chấp nhận offer',
    detail: 'Bộ phận tuyển dụng sẽ liên hệ để hướng dẫn các bước tiếp theo.',
  },
  DECLINED: {
    title: 'Bạn đã từ chối offer',
    detail: 'Phản hồi của bạn đã được ghi nhận. Cảm ơn bạn đã dành thời gian cho HRM AI.',
  },
  NEGOTIATION_CLOSED: {
    title: 'Yêu cầu trao đổi đã được gửi',
    detail: 'Bộ phận tuyển dụng sẽ xem nội dung và liên hệ lại với bạn.',
  },
  REVOKED: {
    title: 'Offer không còn hiệu lực',
    detail: 'Đề nghị này đã được thu hồi. Vui lòng liên hệ bộ phận tuyển dụng nếu bạn cần hỗ trợ.',
  },
  SUPERSEDED: {
    title: 'Liên kết đã được thay thế',
    detail: 'Vui lòng sử dụng liên kết offer mới nhất được gửi cho bạn.',
  },
};

function safeAllowances(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.description) return parsed.description;
    if (Array.isArray(parsed?.items) || Array.isArray(parsed?.benefits)) return null;
    const values = Object.values(parsed || {}).filter(item => typeof item === 'string' && item);
    return values.length ? values.join(', ') : null;
  } catch {
    return value;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export default function PublicOfferPage() {
  const { token } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [comment, setComment] = useState('');
  const [confirmedRead, setConfirmedRead] = useState(false);
  const [responseDetails, setResponseDetails] = useState({
    topics: [], salaryExpectation: '', preferredStartDate: '', declineReason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/public/offers/${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) {
          throw new Error(body?.message || 'Không thể mở offer này.');
        }
        if (active) setOffer(body.data);
      })
      .catch(fetchError => {
        if (active) setError(fetchError.message || 'Không thể kết nối đến máy chủ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const allowanceText = useMemo(() => safeAllowances(offer?.allowancesJson), [offer]);
  const details = useMemo(() => parseJson(offer?.offerDetailsJson, {}), [offer]);
  const compensationItems = Array.isArray(details.compensation?.items) ? details.compensation.items : [];
  const benefits = Array.isArray(details.benefits) ? details.benefits : [];
  const isActive = offer?.dispatchStatus === 'ACTIVE' && !offer?.expired;
  const completedContent = offer?.expired
    ? { title: 'Offer đã hết hạn', detail: 'Hạn phản hồi đã kết thúc. Vui lòng liên hệ bộ phận tuyển dụng để được hỗ trợ.' }
    : STATUS_CONTENT[offer?.dispatchStatus];

  const submitResponse = async () => {
    if (!selectedAction) return;
    if (selectedAction === 'NEGOTIATE' && !comment.trim()) {
      setError('Vui lòng nhập nội dung bạn muốn trao đổi.');
      return;
    }
    if (selectedAction === 'ACCEPT' && !confirmedRead) {
      setError('Vui lòng xác nhận bạn đã đọc và hiểu nội dung offer.');
      return;
    }
    if (selectedAction === 'DECLINE' && !responseDetails.declineReason) {
      setError('Vui lòng chọn lý do từ chối.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const structuredResponse = selectedAction === 'ACCEPT'
        ? { confirmedRead: true }
        : selectedAction === 'DECLINE'
          ? { declineReason: responseDetails.declineReason }
          : {
              topics: responseDetails.topics,
              salaryExpectation: Number(responseDetails.salaryExpectation.replace(/\D/g, '')) || null,
              preferredStartDate: responseDetails.preferredStartDate || null,
            };
      const response = await fetch(`${API_URL}/public/offers/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          action: selectedAction,
          comment: comment.trim() || null,
          responseDetails: structuredResponse,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || 'Không thể ghi nhận phản hồi.');
      }
      setOffer(body.data);
      setSelectedAction(null);
      setComment('');
      setConfirmedRead(false);
    } catch (submitError) {
      setError(submitError.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center px-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="font-medium">Đang tải thông tin offer...</span>
        </div>
      </main>
    );
  }

  if (!offer) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600"><X /></div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Không thể mở offer</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error || 'Liên kết không hợp lệ hoặc không còn tồn tại.'}</p>
        </section>
      </main>
    );
  }

  const selected = selectedAction ? ACTIONS[selectedAction] : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="print:hidden border-b border-blue-800 bg-blue-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white text-blue-700"><BriefcaseBusiness size={21} /></div>
            <div>
              <p className="font-bold leading-tight">HRM AI</p>
              <p className="text-xs text-blue-100">Đề nghị làm việc</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-blue-100">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/60 px-3 py-2 text-white hover:bg-blue-600"><Printer size={15} />Lưu PDF</button>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={16} /> Liên kết bảo mật</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 print:grid-cols-1 print:p-0 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
          <div className="border-b border-slate-100 pb-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <BadgeCheck size={15} /> Offer chính thức, phiên bản {offer.versionNumber}
            </span>
            <p className="mt-5 text-sm font-medium text-blue-700">Xin chào {offer.candidateName},</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Chào mừng bạn đến với HRM AI</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Chúng tôi trân trọng gửi đến bạn đề nghị làm việc cho vị trí <strong className="text-slate-900">{offer.jobTitle}</strong>.
              Vui lòng xem kỹ các điều khoản trước khi phản hồi.
            </p>
          </div>

          <div className="py-7">
            <h2 className="text-lg font-bold text-slate-900">Thông tin đề nghị</h2>
            <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vị trí</dt>
                <dd className="mt-1.5 font-semibold text-slate-900">{offer.jobTitle}</dd>
              </div>
              {details.job?.departmentName && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phòng ban</dt>
                  <dd className="mt-1.5 flex items-center gap-2 font-semibold text-slate-900"><Building2 size={17} className="text-blue-600" />{details.job.departmentName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lương cơ bản</dt>
                <dd className="mt-1.5 text-xl font-bold text-blue-700">{formatCurrencyVND(offer.baseSalary)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ngày bắt đầu dự kiến</dt>
                <dd className="mt-1.5 flex items-center gap-2 font-medium text-slate-800"><CalendarDays size={17} className="text-blue-600" />{formatDate(offer.expectedStartDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thử việc</dt>
                <dd className="mt-1.5 font-medium text-slate-800">{offer.probationMonths} tháng, {offer.probationSalaryRate}% lương</dd>
              </div>
              {details.job?.workplace && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Địa điểm làm việc</dt>
                  <dd className="mt-1.5 flex items-center gap-2 font-medium text-slate-800"><MapPin size={17} className="text-blue-600" />{details.job.workplace}</dd>
                </div>
              )}
              {details.job?.managerName && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quản lý trực tiếp</dt>
                  <dd className="mt-1.5 font-medium text-slate-800">{details.job.managerName}</dd>
                </div>
              )}
              {allowanceText && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phụ cấp và phúc lợi</dt>
                  <dd className="mt-1.5 leading-7 text-slate-700">{allowanceText}</dd>
                </div>
              )}
            </dl>
          </div>

          {(compensationItems.length > 0 || benefits.length > 0) && (
            <div className="border-t border-slate-100 py-7">
              <h2 className="text-lg font-bold text-slate-900">Thu nhập và phúc lợi</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {compensationItems.map((item, index) => (
                  <div key={`comp-${index}`} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.amount ? formatCurrencyVND(item.amount) : ''}{item.amount && item.note ? ' · ' : ''}{item.note}</p>
                  </div>
                ))}
                {benefits.map((item, index) => (
                  <div key={`benefit-${index}`} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description || 'Theo chính sách công ty'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {details.workSchedule && (
            <div className="border-t border-slate-100 py-7">
              <h2 className="text-lg font-bold text-slate-900">Thời gian và điều kiện làm việc</h2>
              <div className="mt-4 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                <p><strong className="block text-slate-900">Lịch làm việc</strong>{details.workSchedule.workingDays} · {details.workSchedule.workingHours}</p>
                <p><strong className="block text-slate-900">Phép năm</strong>{details.workSchedule.annualLeaveDays || 0} ngày/năm</p>
                <p><strong className="block text-slate-900">Chu kỳ trả lương</strong>Hàng tháng, ngày {details.compensation?.payDay || '--'}</p>
                <p><strong className="block text-slate-900">Loại hợp đồng dự kiến</strong>{details.job?.contractType === 'INDEFINITE' ? 'Không xác định thời hạn' : `Xác định thời hạn ${details.job?.contractDurationMonths || ''} tháng`}</p>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-7">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileText size={19} className="text-blue-600" />Điều khoản</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{offer.contractTerms || 'Điều khoản chi tiết sẽ được bộ phận tuyển dụng trao đổi trực tiếp với bạn.'}</p>
            {offer.fileUrl && (
              <a href={offer.fileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
                <FileText size={17} /> Xem văn bản offer đính kèm
              </a>
            )}
          </div>
        </section>

        <aside className="print:hidden lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-blue-900">
              <Clock3 className="mt-0.5 shrink-0 text-blue-600" size={20} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Hạn phản hồi</p>
                <p className="mt-1 font-bold">{formatDate(offer.responseDeadline, true)}</p>
              </div>
            </div>

            {isActive ? (
              <>
                <h2 className="mt-6 text-lg font-bold text-slate-900">Phản hồi của bạn</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Chọn một phương án để tiếp tục.</p>
                <div className="mt-5 space-y-2.5">
                  {Object.entries(ACTIONS).map(([key, item]) => {
                    const Icon = item.icon;
                    return (
                      <button key={key} type="button" onClick={() => { setSelectedAction(key); setError(''); }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-4 ${item.buttonClass}`}>
                        <Icon size={18} /> {item.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-7 text-center">
                <CheckCircle2 className="mx-auto text-blue-600" size={42} />
                <h2 className="mt-4 text-lg font-bold text-slate-900">{completedContent?.title || 'Offer không còn chờ phản hồi'}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{completedContent?.detail || 'Trạng thái phản hồi đã được cập nhật.'}</p>
              </div>
            )}

            <p className="mt-6 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
              AI chỉ hỗ trợ quy trình tuyển dụng. Mọi quyết định tuyển dụng và điều khoản offer do người có thẩm quyền của doanh nghiệp phê duyệt.
            </p>
          </div>
        </aside>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-5 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="offer-response-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="offer-response-title" className="text-xl font-bold text-slate-950">{selected.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="offer-comment">
              {selectedAction === 'NEGOTIATE' ? 'Nội dung cần trao đổi *' : 'Lời nhắn thêm (tùy chọn)'}
            </label>
            <textarea id="offer-comment" value={comment} onChange={event => setComment(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder={selectedAction === 'NEGOTIATE' ? 'Ví dụ: Tôi muốn trao đổi thêm về ngày bắt đầu...' : 'Nhập lời nhắn của bạn...'} />
            {selectedAction === 'NEGOTIATE' && (
              <div className="mt-4 space-y-3 rounded-xl bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-950">Nội dung muốn thương lượng</p>
                <div className="flex flex-wrap gap-2">
                  {['Lương', 'Ngày bắt đầu', 'Phụ cấp', 'Phúc lợi', 'Hình thức làm việc'].map(topic => (
                    <label key={topic} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={responseDetails.topics.includes(topic)} onChange={event => setResponseDetails(current => ({ ...current, topics: event.target.checked ? [...current.topics, topic] : current.topics.filter(item => item !== topic) }))} />{topic}
                    </label>
                  ))}
                </div>
                <input className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Mức lương mong muốn (nếu có)" value={responseDetails.salaryExpectation} onChange={event => setResponseDetails(current => ({ ...current, salaryExpectation: event.target.value }))} />
                <label className="block text-xs font-semibold text-slate-600">Ngày bắt đầu mong muốn<input type="date" className="mt-1 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" value={responseDetails.preferredStartDate} onChange={event => setResponseDetails(current => ({ ...current, preferredStartDate: event.target.value }))} /></label>
              </div>
            )}
            {selectedAction === 'DECLINE' && (
              <select className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500" value={responseDetails.declineReason} onChange={event => setResponseDetails(current => ({ ...current, declineReason: event.target.value }))}>
                <option value="">-- Chọn lý do từ chối --</option><option value="COMPENSATION">Thu nhập chưa phù hợp</option><option value="ACCEPTED_OTHER_OFFER">Đã nhận công việc khác</option><option value="START_DATE">Ngày bắt đầu chưa phù hợp</option><option value="PERSONAL">Lý do cá nhân</option><option value="OTHER">Lý do khác</option>
              </select>
            )}
            {selectedAction === 'ACCEPT' && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                <input type="checkbox" className="mt-1 size-4" checked={confirmedRead} onChange={event => setConfirmedRead(event.target.checked)} />
                <span>Tôi xác nhận đã đọc và hiểu nội dung offer. Thao tác này là chấp nhận đề nghị làm việc, chưa thay thế việc ký hợp đồng lao động.</span>
              </label>
            )}
            {error && <p className="mt-2 text-sm font-medium text-rose-600" role="alert">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={submitting} onClick={() => { setSelectedAction(null); setError(''); }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                Quay lại
              </button>
              <button type="button" disabled={submitting} onClick={submitResponse}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
