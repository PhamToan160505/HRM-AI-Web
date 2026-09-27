import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, Users } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { useNotification } from '../../../../context/NotificationContext';

const roundFromStatus = (status) => status === 'PENDING_INTERVIEW_1' ? 1
  : status === 'PENDING_INTERVIEW_2' ? 2 : null;

export default function InterviewPanel({ applicationId, applicationStatus, verifyPoints = [] }) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const round = roundFromStatus(applicationStatus);
  const [interviews, setInterviews] = useState([]);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedule, setSchedule] = useState({ start: '', end: '', mode: 'ONLINE', location: '', meetingUrl: '', lead: '', participants: [] });
  const [feedback, setFeedback] = useState({ score: '70', recommendation: 'PASS', comments: '' });
  const [conclusion, setConclusion] = useState('');
  const [negotiation, setNegotiation] = useState({ currentSalary: '', expectedSalary: '', preliminarySalary: '', allowances: '', expectations: '', notes: '' });

  const load = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      const [interviewRes, peopleRes] = await Promise.all([
        api.get(`/api/recruitment/applications/${applicationId}/interviews`),
        api.get(`/api/recruitment/applications/${applicationId}/interviewers`)
      ]);
      if (interviewRes.data.success) setInterviews(interviewRes.data.data || []);
      if (peopleRes.data.success) setPeople(peopleRes.data.data || []);
    } finally {
      setLoadingData(false);
    }
  }, [applicationId]);

  useEffect(() => {
    load().catch(error => setLoadError(error.response?.data?.message || 'Không thể tải dữ liệu phỏng vấn.'));
  }, [load]);

  const current = useMemo(() => interviews
    .filter(item => item.roundNumber === round)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0], [interviews, round]);
  const myFeedback = current?.participants?.find(item => item.userId === user?.userId);
  const allRequiredDone = current?.participants?.filter(item => item.feedbackRequired)
    .every(item => item.submittedAt);

  if (!round) return null;

  const run = async (action, success) => {
    setBusy(true);
    try {
      await action();
      await load();
      showNotification('Thành công', success, 'success');
    } catch (error) {
      showNotification('Không thể thực hiện', error.response?.data?.message || error.message, 'error');
    } finally { setBusy(false); }
  };

  const scheduleInterview = () => run(() => api.post(`/api/recruitment/applications/${applicationId}/interviews`, {
    roundNumber: round,
    scheduledStart: schedule.start,
    scheduledEnd: schedule.end,
    timezone: 'Asia/Ho_Chi_Minh',
    interviewMode: schedule.mode,
    location: schedule.location || null,
    meetingUrl: schedule.meetingUrl || null,
    leadUserId: Number(schedule.lead),
    participants: schedule.participants.map(id => ({ userId: Number(id), role: 'INTERVIEWER', feedbackRequired: true }))
  }).then(result => { setShowScheduleForm(false); return result; }), current?.status === 'SCHEDULED' ? 'Đã đặt lại lịch và giữ lịch sử cũ.' : 'Đã tạo lịch phỏng vấn.');

  const submitFeedback = () => run(() => api.put(`/api/recruitment/interviews/${current.id}/feedback`, {
    criteriaScores: { overall: Number(feedback.score) },
    overallScore: Number(feedback.score),
    recommendation: feedback.recommendation,
    comments: feedback.comments
  }), 'Đã lưu phiếu feedback của bạn.');

  const completeInterview = () => run(() => api.post(`/api/recruitment/interviews/${current.id}/complete`, { conclusion }),
    'Đã hoàn tất buổi phỏng vấn.');

  const saveNegotiation = () => run(() => api.put(`/api/recruitment/interviews/${current.id}/salary-negotiation`, {
    currentSalary: negotiation.currentSalary ? Number(negotiation.currentSalary) : null,
    expectedSalary: Number(negotiation.expectedSalary),
    preliminarySalary: Number(negotiation.preliminarySalary),
    allowances: { description: negotiation.allowances },
    otherExpectations: negotiation.expectations || null,
    notes: negotiation.notes
  }), 'Đã lưu kết quả đàm phán sơ bộ.');

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarDays size={20} className="text-blue-600" /> Phỏng vấn vòng {round}</h3>
          <p className="mt-1 text-sm text-slate-500">Lịch, từng phiếu feedback và kết luận được lưu riêng để kiểm toán.</p>
        </div>
        {current && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{current.status}</span>}
      </div>

      {loadingData && <div className="grid min-h-28 place-items-center text-slate-500"><Loader2 className="animate-spin text-blue-600" /></div>}
      {loadError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</div>}

      {!loadingData && current?.status === 'SCHEDULED' && !showScheduleForm && (
        <button onClick={() => setShowScheduleForm(true)} className="mb-4 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Đặt lại lịch</button>
      )}

      {!loadingData && (!current || ['RESCHEDULED', 'NO_SHOW', 'CANCELLED'].includes(current.status) || showScheduleForm) && (
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
          <input type="datetime-local" value={schedule.start} onChange={e => setSchedule({ ...schedule, start: e.target.value })} className="rounded-lg border border-slate-200 p-2.5" />
          <input type="datetime-local" value={schedule.end} onChange={e => setSchedule({ ...schedule, end: e.target.value })} className="rounded-lg border border-slate-200 p-2.5" />
          <select value={schedule.mode} onChange={e => setSchedule({ ...schedule, mode: e.target.value })} className="rounded-lg border border-slate-200 p-2.5">
            <option value="ONLINE">Online</option><option value="ONSITE">Tại văn phòng</option><option value="HYBRID">Kết hợp</option>
          </select>
          <select value={schedule.lead} onChange={e => setSchedule({ ...schedule, lead: e.target.value })} className="rounded-lg border border-slate-200 p-2.5">
            <option value="">-- Chọn người chủ trì --</option>
            {people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
          </select>
          <input placeholder="Địa điểm" value={schedule.location} onChange={e => setSchedule({ ...schedule, location: e.target.value })} className="rounded-lg border border-slate-200 p-2.5" />
          <input placeholder="Link họp online" value={schedule.meetingUrl} onChange={e => setSchedule({ ...schedule, meetingUrl: e.target.value })} className="rounded-lg border border-slate-200 p-2.5" />
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Thành viên cần gửi feedback</p>
            <div className="flex flex-wrap gap-2">
              {people.filter(person => String(person.id) !== schedule.lead).map(person => (
                <label key={person.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
                  <input type="checkbox" checked={schedule.participants.includes(String(person.id))}
                    onChange={e => setSchedule({ ...schedule, participants: e.target.checked
                      ? [...schedule.participants, String(person.id)] : schedule.participants.filter(id => id !== String(person.id)) })} />
                  {person.name}
                </label>
              ))}
            </div>
          </div>
          <button disabled={busy || !schedule.start || !schedule.end || !schedule.lead} onClick={scheduleInterview}
            className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Tạo lịch phỏng vấn</button>
        </div>
      )}

      {current && (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm"><Clock3 size={16} className="text-blue-600" />{new Date(current.scheduledStart).toLocaleString('vi-VN')} – {new Date(current.scheduledEnd).toLocaleTimeString('vi-VN')}</p>
            <p className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-blue-600" />{current.interviewMode} · {current.location || current.meetingUrl || 'Chưa ghi địa điểm'}</p>
            <p className="flex items-center gap-2 text-sm sm:col-span-2"><Users size={16} className="text-blue-600" />{current.participants.map(item => item.name).join(', ')}</p>
          </div>

          {verifyPoints.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-bold text-amber-900">Điểm AI gợi ý cần xác minh — không bắt buộc dùng</p>
            <ul className="space-y-1 text-sm text-amber-900">{verifyPoints.map((point, index) => <li key={index}>• {point.claim}: {point.why}</li>)}</ul>
          </div>}

          {current.status === 'SCHEDULED' && myFeedback && (
            <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
              <input type="number" min="0" max="100" value={feedback.score} onChange={e => setFeedback({ ...feedback, score: e.target.value })} className="rounded-lg border border-blue-200 p-2.5" placeholder="Điểm 0–100" />
              <select value={feedback.recommendation} onChange={e => setFeedback({ ...feedback, recommendation: e.target.value })} className="rounded-lg border border-blue-200 p-2.5">
                <option value="PASS">Đạt</option><option value="FAIL">Không đạt</option><option value="HOLD">Cần cân nhắc</option>
              </select>
              <textarea value={feedback.comments} onChange={e => setFeedback({ ...feedback, comments: e.target.value })} className="min-h-24 rounded-lg border border-blue-200 p-2.5 md:col-span-2" placeholder="Nhận xét bắt buộc" />
              <button disabled={busy || !feedback.comments.trim()} onClick={submitFeedback} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2">{myFeedback.submittedAt ? 'Cập nhật feedback' : 'Gửi feedback'}</button>
            </div>
          )}

          <div className="space-y-2">{current.participants.map(item => <div key={item.userId} className="flex items-start justify-between rounded-lg border border-slate-100 p-3 text-sm">
            <div><strong>{item.name}</strong><span className="ml-2 text-slate-500">{item.role}</span>{item.comments && <p className="mt-1 text-slate-600">{item.comments}</p>}</div>
            <span className={item.submittedAt ? 'font-semibold text-emerald-600' : 'text-amber-600'}>{item.submittedAt ? `${item.overallScore} · ${item.recommendation}` : 'Chưa feedback'}</span>
          </div>)}</div>

          {round === 2 && current.status === 'SCHEDULED' && (
            <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 md:grid-cols-2">
              <input type="number" min="1" placeholder="Lương hiện tại (tự nguyện)" value={negotiation.currentSalary} onChange={e => setNegotiation({ ...negotiation, currentSalary: e.target.value })} className="rounded-lg border border-violet-200 p-2.5" />
              <input type="number" min="1" placeholder="Mức mong muốn" value={negotiation.expectedSalary} onChange={e => setNegotiation({ ...negotiation, expectedSalary: e.target.value })} className="rounded-lg border border-violet-200 p-2.5" />
              <input type="number" min="1" placeholder="Mức thống nhất sơ bộ" value={negotiation.preliminarySalary} onChange={e => setNegotiation({ ...negotiation, preliminarySalary: e.target.value })} className="rounded-lg border border-violet-200 p-2.5" />
              <input placeholder="Phụ cấp" value={negotiation.allowances} onChange={e => setNegotiation({ ...negotiation, allowances: e.target.value })} className="rounded-lg border border-violet-200 p-2.5" />
              <input placeholder="Kỳ vọng khác" value={negotiation.expectations} onChange={e => setNegotiation({ ...negotiation, expectations: e.target.value })} className="rounded-lg border border-violet-200 p-2.5 md:col-span-2" />
              <textarea placeholder="Ghi chú đàm phán bắt buộc" value={negotiation.notes} onChange={e => setNegotiation({ ...negotiation, notes: e.target.value })} className="rounded-lg border border-violet-200 p-2.5 md:col-span-2" />
              <button disabled={busy || !negotiation.expectedSalary || !negotiation.preliminarySalary || !negotiation.notes.trim()} onClick={saveNegotiation} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2">Lưu đàm phán sơ bộ</button>
            </div>
          )}

          {current.status === 'SCHEDULED' && current.leadUserId === user?.userId && (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
              <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} className="min-h-24 rounded-lg border border-slate-200 p-3" placeholder="Kết luận tổng hợp của người chủ trì" />
              <div className="flex gap-2">
                <button disabled={busy || !allRequiredDone || !conclusion.trim()} onClick={completeInterview} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17} /> Hoàn tất buổi phỏng vấn</button>
                <button disabled={busy} onClick={() => run(() => api.post(`/api/recruitment/interviews/${current.id}/no-show`), 'Đã ghi nhận vắng mặt.')} className="rounded-lg border border-rose-200 px-4 py-2 font-semibold text-rose-600">Vắng mặt</button>
              </div>
              {!allRequiredDone && <p className="text-xs text-amber-700">Chưa thể hoàn tất vì còn thiếu feedback bắt buộc.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
