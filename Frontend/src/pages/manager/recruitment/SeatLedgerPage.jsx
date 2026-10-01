import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Armchair, CheckCircle2, Clock3, History, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';

const STATUS_META = {
  AVAILABLE: { label: 'Còn trống', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  RESERVED: { label: 'Đã giữ cho offer', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACCEPTED: { label: 'Đã nhận offer', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  JOINED: { label: 'Đã nhận việc', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const EVENT_LABEL = {
  CREATED: 'Khởi tạo suất tuyển',
  RESERVED: 'Giữ suất khi gửi offer',
  RESERVATION_TRANSFERRED: 'Chuyển giữ suất sang offer mới',
  ACCEPTED: 'Ứng viên chấp nhận offer',
  RELEASED: 'Nhả suất tuyển',
  JOINED: 'Nhân viên đã nhận việc',
  OVERBOOK_CREATED: 'Tạo suất dự phòng',
};

const formatDateTime = value => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function SeatLedgerPage() {
  const { showNotification } = useNotification();
  const [requisitions, setRequisitions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/api/job-requisitions')
      .then(response => {
        if (!active) return;
        const available = (response.data.data || []).filter(item => ['APPROVED', 'FULFILLED'].includes(item.status));
        setRequisitions(available);
        if (available.length > 0) setSelectedId(String(available[0].id));
      })
      .catch(error => showNotification('Không thể tải yêu cầu', error.response?.data?.message || 'Vui lòng thử lại', 'error'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showNotification]);

  const loadSeats = useCallback(async () => {
    if (!selectedId) { setSeats([]); return; }
    setLoadingSeats(true);
    try {
      const response = await api.get(`/api/recruitment/requisitions/${selectedId}/seats`);
      setSeats(response.data.data || []);
    } catch (error) {
      showNotification('Không thể tải số ghế ngồi', error.response?.data?.message || 'Vui lòng thử lại', 'error');
    } finally {
      setLoadingSeats(false);
    }
  }, [selectedId, showNotification]);

  useEffect(() => { loadSeats(); }, [loadSeats]);

  const summary = useMemo(() => seats.reduce((result, seat) => {
    result[seat.status] = (result[seat.status] || 0) + 1;
    return result;
  }, {}), [seats]);

  const openTimeline = async seat => {
    setTimeline({ seat, events: [], loading: true, error: '' });
    try {
      const response = await api.get(`/api/recruitment/seats/${seat.id}/events`);
      setTimeline({ seat, events: response.data.data || [], loading: false, error: '' });
    } catch (error) {
      setTimeline({ seat, events: [], loading: false, error: error.response?.data?.message || 'Không thể tải lịch sử suất tuyển.' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Kiểm soát headcount</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Số ghế ngồi</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Theo dõi từng suất tuyển từ lúc khởi tạo, giữ cho offer, chấp nhận đến khi nhân viên nhận việc.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="seat-requisition">Yêu cầu tuyển dụng</label>
          <select id="seat-requisition" value={selectedId} onChange={event => setSelectedId(event.target.value)} className="min-w-72 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800">
            <option value="">Chọn yêu cầu tuyển dụng</option>
            {requisitions.map(item => <option key={item.id} value={item.id}>{item.title} · {item.soLuong} suất</option>)}
          </select>
          <button type="button" onClick={loadSeats} disabled={!selectedId || loadingSeats} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={17} className={loadingSeats ? 'animate-spin' : ''} /> Làm mới</button>
        </div>
      </header>

      {selectedId && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['AVAILABLE', 'Còn trống'], ['RESERVED', 'Đã giữ'], ['ACCEPTED', 'Đã nhận offer'], ['JOINED', 'Đã nhận việc'],
          ].map(([status, label]) => <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{summary[status] || 0}</p></div>)}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading || loadingSeats ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : !selectedId ? (
          <div className="grid min-h-64 place-items-center px-6 text-center"><div><Armchair className="mx-auto text-slate-300" size={44} /><p className="mt-3 font-semibold text-slate-700">Chưa có requisition đã duyệt</p><p className="mt-1 text-sm text-slate-500">Seat được sinh sau khi yêu cầu tuyển dụng được duyệt.</p></div></div>
        ) : seats.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 text-center"><div><ShieldAlert className="mx-auto text-amber-400" size={42} /><p className="mt-3 font-semibold text-slate-700">Chưa có số ghế ngồi</p><p className="mt-1 text-sm text-slate-500">Kiểm tra migration hoặc thao tác duyệt requisition.</p></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Suất</th><th className="px-6 py-4">Loại</th><th className="px-6 py-4">Hồ sơ</th><th className="px-6 py-4">Offer</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Lịch sử</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {seats.map(seat => {
                  const meta = STATUS_META[seat.status] || { label: seat.status, className: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return <tr key={seat.id} className="hover:bg-blue-50/30"><td className="px-6 py-4 font-bold text-slate-900">#{seat.seatNumber}</td><td className="px-6 py-4"><span className={seat.kind === 'OVERBOOK' ? 'font-semibold text-orange-700' : 'text-slate-700'}>{seat.kind === 'OVERBOOK' ? 'Dự phòng' : 'Chính thức'}</span>{seat.overbookReason && <p className="mt-1 max-w-xs text-xs text-slate-500">{seat.overbookReason}</p>}</td><td className="px-6 py-4 text-slate-600">{seat.applicationId ? `#${seat.applicationId}` : '—'}</td><td className="px-6 py-4 text-slate-600">{seat.offerId ? `#${seat.offerId}` : '—'}</td><td className="px-6 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => openTimeline(seat)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-200 hover:bg-blue-50"><History size={15} /> Xem</button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {timeline && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm" onClick={() => setTimeline(null)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Seat #{timeline.seat.seatNumber}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Lịch sử bất biến</h2></div><button type="button" aria-label="Đóng lịch sử seat" onClick={() => setTimeline(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X /></button></div>
            {timeline.loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="animate-spin text-blue-600" /></div> : timeline.error ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{timeline.error}</div> : <div className="mt-8 space-y-0">{timeline.events.map((event, index) => <div key={event.id} className="relative flex gap-4 pb-7">{index < timeline.events.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-20px)] w-px bg-blue-100" />}<span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">{event.toStatus === 'JOINED' ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</span><div><p className="text-sm font-bold text-slate-900">{EVENT_LABEL[event.eventType] || event.eventType}</p><p className="mt-1 text-sm text-slate-600">{event.fromStatus || 'Khởi tạo'} → {event.toStatus}</p>{event.reason && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{event.reason}</p>}<p className="mt-2 text-xs text-slate-400">{formatDateTime(event.occurredAt)}</p></div></div>)}</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
