import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, HelpCircle, Loader2, MapPin, MessageSquareText, RefreshCw, Users, XCircle } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { useNotification } from '../../../../context/NotificationContext';

const roundFromStatus = (status) => status === 'PENDING_INTERVIEW_1' ? 1
  : status === 'PENDING_INTERVIEW_2' ? 2 : null;

const INTERVIEW_STATUS_MAP = {
  SCHEDULED: 'Đã lên lịch',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  RESCHEDULED: 'Đã đổi lịch',
  NO_SHOW: 'Vắng mặt',
  IN_PROGRESS: 'Đang phỏng vấn'
};

const INTERVIEW_MODE_MAP = {
  ONLINE: 'Online',
  ONSITE: 'Tại văn phòng',
  HYBRID: 'Kết hợp (Hybrid)'
};

const ROLE_MAP = {
  LEAD: 'Chủ trì',
  MEMBER: 'Người phỏng vấn',
  HR: 'HR phụ trách',
  INTERVIEWER: 'Người phỏng vấn'
};

const RECOMMENDATION_MAP = {
  PASS: 'Đạt',
  FAIL: 'Không đạt',
  HOLD: 'Cần cân nhắc'
};

const AI_FLAG_LABELS = {
  IDENTITY_MISMATCH_CHECK: 'Xác minh thông tin cá nhân',
  UNVERIFIED_CITATION: 'Trích dẫn chưa xác minh',
  EVIDENCE_COPIED_FROM_JD: 'Bằng chứng sao chép từ JD',
  JD_MIRRORING_SUSPECTED: 'Nghi vấn sao chép yêu cầu JD',
  FUTURE_DATE: 'Thời gian tương lai bất thường',
  CONSISTENCY_CHECK: 'Kiểm tra tính đồng nhất',
  HIDDEN_TEXT_SUSPECTED: 'Nghi vấn chữ ẩn trong CV',
  PROMPT_INJECTION_PATTERN: 'Nghi vấn chèn câu lệnh AI'
};

const formatAiClaim = (claim) => AI_FLAG_LABELS[claim] || claim;

export default function InterviewPanel({ applicationId, applicationStatus, verifyPoints = [], suggestedQuestions = [], jobTitle = '' }) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const round = roundFromStatus(applicationStatus);
  const [interviews, setInterviews] = useState([]);
  const [people, setPeople] = useState([]);
  const [access, setAccess] = useState({ canSchedule: false, participant: false });
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [schedule, setSchedule] = useState({ start: '', end: '', mode: 'ONLINE', location: '', meetingUrl: '', lead: '' });
  const [feedback, setFeedback] = useState({ score: '70', recommendation: 'PASS', comments: '' });
  const [conclusion, setConclusion] = useState('');
  const [negotiation, setNegotiation] = useState({ currentSalary: '', expectedSalary: '', preliminarySalary: '', allowances: '', expectations: '', notes: '' });
  const [expandQuestions, setExpandQuestions] = useState(false);
  const [round1Questions, setRound1Questions] = useState([]);
  const [loadingR1Q, setLoadingR1Q] = useState(false);
  const [expandR1Q, setExpandR1Q] = useState(false);
  const [errorR1Q, setErrorR1Q] = useState('');
  const [round2Questions, setRound2Questions] = useState([]);
  const [loadingR2Q, setLoadingR2Q] = useState(false);
  const [expandR2Q, setExpandR2Q] = useState(false);
  const [errorR2Q, setErrorR2Q] = useState('');

  const fetchRound1Questions = useCallback(async () => {
    setLoadingR1Q(true);
    setErrorR1Q('');
    try {
      const res = await api.get(`/api/recruitment/applications/${applicationId}/round1-questions`);
      if (res.data.success) {
        setRound1Questions(res.data.data || []);
        setExpandR1Q(true);
      }
    } catch (err) {
      setErrorR1Q(err.response?.data?.message || 'Không thể tạo câu hỏi. Vui lòng thử lại.');
    } finally {
      setLoadingR1Q(false);
    }
  }, [applicationId]);

  const fetchRound2Questions = useCallback(async () => {
    setLoadingR2Q(true);
    setErrorR2Q('');
    try {
      const res = await api.get(`/api/recruitment/applications/${applicationId}/round2-questions`);
      if (res.data.success) {
        setRound2Questions(res.data.data || []);
        setExpandR2Q(true);
      }
    } catch (err) {
      setErrorR2Q(err.response?.data?.message || 'Không thể tạo câu hỏi. Vui lòng thử lại.');
    } finally {
      setLoadingR2Q(false);
    }
  }, [applicationId]);

  const load = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      const [interviewRes, accessRes] = await Promise.all([
        api.get(`/api/recruitment/applications/${applicationId}/interviews`),
        api.get(`/api/recruitment/applications/${applicationId}/interview-access`)
      ]);
      if (interviewRes.data.success) setInterviews(interviewRes.data.data || []);
      const nextAccess = accessRes.data.success
        ? accessRes.data.data
        : { canSchedule: false, participant: false };
      setAccess(nextAccess);
      if (nextAccess.canSchedule) {
        const peopleRes = await api.get(`/api/recruitment/applications/${applicationId}/interviewers`);
        if (peopleRes.data.success) setPeople(peopleRes.data.data || []);
      } else {
        setPeople([]);
        setShowScheduleForm(false);
      }
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

  useEffect(() => {
    setShowFeedbackForm(false);
  }, [current?.id]);

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
    scheduledEnd: schedule.end || null,
    timezone: 'Asia/Ho_Chi_Minh',
    interviewMode: round === 1 ? 'ONLINE' : schedule.mode,
    location: schedule.location || null,
    meetingUrl: schedule.meetingUrl || null,
    leadUserId: Number(schedule.lead),
    participants: [] // Backend tự thêm người chủ trì vào; email sẽ gửi cho ứng viên qua outbox
  }).then(result => { setShowScheduleForm(false); return result; }), current?.status === 'SCHEDULED' ? 'Đã đặt lại lịch, gửi lại lời mời và giữ lịch sử cũ.' : 'Đã tạo lịch, gửi email cho ứng viên và lời mời cho người phỏng vấn.');

  const submitFeedback = () => run(() => api.put(`/api/recruitment/interviews/${current.id}/feedback`, {
    criteriaScores: { overall: Number(feedback.score) },
    overallScore: Number(feedback.score),
    recommendation: feedback.recommendation,
    comments: feedback.comments
  }).then(result => { setShowFeedbackForm(false); return result; }), 'Đã lưu phiếu feedback của bạn.');

  const openFeedbackForm = () => {
    setFeedback({
      score: String(myFeedback?.overallScore ?? 70),
      recommendation: myFeedback?.recommendation || 'PASS',
      comments: myFeedback?.comments || ''
    });
    setShowFeedbackForm(true);
  };

  const completeInterview = () => run(() => api.post(`/api/recruitment/interviews/${current.id}/complete`, { conclusion }),
    'Đã hoàn tất buổi phỏng vấn.');

  const respondInvitation = (decision) => run(
    () => api.post(`/api/recruitment/interviews/${current.id}/invitation`, { decision }),
    decision === 'ACCEPTED' ? 'Bạn đã chấp nhận lời mời phỏng vấn.' : 'Bạn đã từ chối lời mời phỏng vấn.'
  );

  const saveNegotiation = () => run(() => api.put(`/api/recruitment/interviews/${current.id}/salary-negotiation`, {
    currentSalary: negotiation.currentSalary ? Number(negotiation.currentSalary) : null,
    expectedSalary: Number(negotiation.expectedSalary),
    preliminarySalary: Number(negotiation.preliminarySalary),
    allowances: { description: negotiation.allowances },
  }), 'Đã lưu kết quả đàm phán sơ bộ.');

  const activeR1Q = round1Questions.length > 0 ? round1Questions : suggestedQuestions;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarDays size={20} className="text-blue-600" /> Phỏng vấn vòng {round}</h3>
          <p className="mt-1 text-sm text-slate-500">Lịch, từng phiếu feedback và kết luận được lưu riêng để kiểm toán.</p>
        </div>
        {current && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{INTERVIEW_STATUS_MAP[current.status] || current.status}</span>}
      </div>

      {loadingData && <div className="grid min-h-28 place-items-center text-slate-500"><Loader2 className="animate-spin text-blue-600" /></div>}
      {loadError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</div>}

      {!loadingData && access.canSchedule && current?.status === 'SCHEDULED' && !showScheduleForm && (
        <button onClick={() => setShowScheduleForm(true)} className="mb-4 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Đặt lại lịch</button>
      )}

      {!loadingData && access.canSchedule && (!current || ['RESCHEDULED', 'NO_SHOW', 'CANCELLED'].includes(current.status) || showScheduleForm) && (
        <div className="grid gap-4 rounded-xl bg-slate-50 p-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Thời gian phỏng vấn (Thời gian bắt đầu)</label>
            <input type="datetime-local" value={schedule.start} onChange={e => setSchedule({ ...schedule, start: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Hình thức phỏng vấn</label>
            {round === 1 ? (
              <div className="flex h-[42px] items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
                💻 Phỏng vấn Online (Vòng 1)
              </div>
            ) : (
              <select value={schedule.mode} onChange={e => setSchedule({ ...schedule, mode: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
                <option value="ONLINE">Phỏng vấn Online</option>
                <option value="ONSITE">Tại văn phòng</option>
                <option value="HYBRID">Kết hợp</option>
              </select>
            )}
          </div>
          <div className="md:col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Người chủ trì phỏng vấn</label>
            <select value={schedule.lead} onChange={e => setSchedule({ ...schedule, lead: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
              <option value="">-- Chọn người chủ trì --</option>
              {people.map(person => <option key={person.id} value={person.id}>{person.name} · {ROLE_MAP[person.role] || person.role}</option>)}
            </select>
          </div>
          {(round !== 1 && schedule.mode !== 'ONLINE') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Địa điểm phỏng vấn</label>
              <input placeholder="VD: Phòng họp A, Tầng 3" value={schedule.location} onChange={e => setSchedule({ ...schedule, location: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" />
            </div>
          )}
          <div className={(round === 1 || schedule.mode === 'ONLINE') ? "md:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-medium text-slate-600">Link họp online (Google Meet / Zoom...)</label>
            <input placeholder="https://meet.google.com/..." value={schedule.meetingUrl} onChange={e => setSchedule({ ...schedule, meetingUrl: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" />
          </div>
          <p className="md:col-span-2 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            📧 Ứng viên sẽ nhận email; người phỏng vấn sẽ nhận lời mời nội bộ và phải xác nhận tham gia.
          </p>
          <button disabled={busy || !schedule.start || !schedule.lead} onClick={() => scheduleInterview()}
            className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50 hover:bg-blue-700 transition">
            Tạo lịch phỏng vấn Vòng {round}
          </button>
        </div>
      )}

      {!loadingData && !access.canSchedule && (!current || ['RESCHEDULED', 'NO_SHOW', 'CANCELLED'].includes(current.status)) && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Chỉ HR phụ trách chiến dịch được tạo hoặc đặt lại lịch phỏng vấn.
        </div>
      )}

      {current && (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm"><Clock3 size={16} className="text-blue-600" />{new Date(current.scheduledStart).toLocaleString('vi-VN')} – {new Date(current.scheduledEnd).toLocaleTimeString('vi-VN')}</p>
            <p className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-blue-600" />{INTERVIEW_MODE_MAP[current.interviewMode] || current.interviewMode} · {current.location || current.meetingUrl || 'Chưa ghi địa điểm'}</p>
            <p className="flex items-center gap-2 text-sm sm:col-span-2"><Users size={16} className="text-blue-600" />{current.participants.map(item => item.name).join(', ')}</p>
          </div>

          {/* Câu hỏi phỏng vấn online – chỉ hiển thị ở vòng 1 */}
          {round === 1 && (
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <MessageSquareText size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-900">Câu hỏi phỏng vấn online vòng 1</p>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      AI tạo dựa trên CV + JD — dành cho phỏng vấn online
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeR1Q.length > 0 && (
                    <button
                      onClick={() => setExpandR1Q(v => !v)}
                      className="text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-full transition-colors"
                    >
                      {expandR1Q ? 'Thu gọn' : `Xem ${activeR1Q.length} câu`}
                    </button>
                  )}
                  <button
                    disabled={loadingR1Q}
                    onClick={fetchRound1Questions}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {loadingR1Q
                      ? <><Loader2 size={13} className="animate-spin" /> Đang tạo...</>
                      : <><RefreshCw size={13} /> {activeR1Q.length > 0 ? 'Tạo lại' : 'Tạo câu hỏi'}</>
                    }
                  </button>
                </div>
              </div>

              {errorR1Q && (
                <div className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  {errorR1Q}
                </div>
              )}

              {activeR1Q.length === 0 && !loadingR1Q && !errorR1Q && (
                <div className="mx-5 mb-5 rounded-xl border border-indigo-100 bg-white/60 px-5 py-4 text-center">
                  <p className="text-sm text-indigo-800 font-medium">Nhấn "Tạo câu hỏi" để AI generate câu hỏi phỏng vấn online</p>
                  <p className="text-xs text-indigo-600 mt-1">Dựa trên CV và JD của vị trí{jobTitle ? ` "${jobTitle}"` : ''}</p>
                </div>
              )}

              {expandR1Q && activeR1Q.length > 0 && (
                <div className="px-5 pb-5 space-y-3 border-t border-indigo-100">
                  <p className="pt-4 text-xs text-indigo-700 font-medium flex items-center gap-1.5">
                    <HelpCircle size={13} /> AI tổng hợp từ CV + JD. Người phỏng vấn tự quyết định sử dụng.
                  </p>
                  <div className="space-y-2.5">
                    {activeR1Q.map((q, index) => {
                      const clean = q.replace(/^Câu \d+:\s*/i, '');
                      return (
                        <div key={index} className="flex gap-3 group">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {index + 1}
                          </div>
                          <div className="flex-1 bg-white/80 hover:bg-white border border-indigo-100 hover:border-indigo-200 rounded-xl px-4 py-3 transition-all cursor-default">
                            <p className="text-sm leading-relaxed text-slate-700 font-medium">{clean}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {verifyPoints.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-bold text-amber-900">Điểm AI gợi ý cần xác minh — không bắt buộc dùng</p>
            <ul className="space-y-1 text-sm text-amber-900">{verifyPoints.map((point, index) => <li key={index}>• <strong>{formatAiClaim(point.claim)}</strong>: {point.why}</li>)}</ul>
          </div>}

          {/* Câu hỏi phỏng vấn trực tiếp – chỉ hiển thị ở vòng 2 */}
          {round === 2 && (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
              {/* Header với nút Generate */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <MessageSquareText size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Câu hỏi phỏng vấn trực tiếp vòng 2</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      AI tạo dựa trên kết quả vòng 1 + JD — dành cho phỏng vấn onsite
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {round2Questions.length > 0 && (
                    <button
                      onClick={() => setExpandR2Q(v => !v)}
                      className="text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-full transition-colors"
                    >
                      {expandR2Q ? 'Thu gọn' : `Xem ${round2Questions.length} câu`}
                    </button>
                  )}
                  <button
                    disabled={loadingR2Q}
                    onClick={fetchRound2Questions}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {loadingR2Q
                      ? <><Loader2 size={13} className="animate-spin" /> Đang tạo...</>
                      : <><RefreshCw size={13} /> {round2Questions.length > 0 ? 'Tạo lại' : 'Tạo câu hỏi'}</>
                    }
                  </button>
                </div>
              </div>

              {errorR2Q && (
                <div className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  {errorR2Q}
                </div>
              )}

              {round2Questions.length === 0 && !loadingR2Q && !errorR2Q && (
                <div className="mx-5 mb-5 rounded-xl border border-emerald-100 bg-white/60 px-5 py-4 text-center">
                  <p className="text-sm text-emerald-800 font-medium">Nhấn "Tạo câu hỏi" để AI generate câu hỏi</p>
                  <p className="text-xs text-emerald-600 mt-1">Dựa trên feedback vòng 1, CV và JD của vị trí{jobTitle ? ` "${jobTitle}"` : ''}</p>
                </div>
              )}

              {expandR2Q && round2Questions.length > 0 && (
                <div className="px-5 pb-5 space-y-3 border-t border-emerald-100">
                  <p className="pt-4 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <HelpCircle size={13} /> AI tổng hợp từ kết quả vòng 1 + JD. Người phỏng vấn tự quyết định sử dụng.
                  </p>
                  <div className="space-y-2.5">
                    {round2Questions.map((q, index) => (
                      <div key={index} className="flex gap-3 group">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          {index + 1}
                        </div>
                        <div className="flex-1 bg-white/80 hover:bg-white border border-emerald-100 hover:border-emerald-200 rounded-xl px-4 py-3 transition-all cursor-default">
                          <p className="text-sm leading-relaxed text-slate-700 font-medium">{q}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {current.status === 'NO_SHOW' && myFeedback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Lịch này đã được ghi nhận <strong>ứng viên vắng mặt</strong>, nên không phát sinh phiếu feedback. HR phụ trách chiến dịch cần tạo lịch phỏng vấn mới; khi bạn chấp nhận lời mời mới, nút <strong>Nhập feedback</strong> sẽ xuất hiện cạnh tên của bạn.
            </div>
          )}

          {current.status === 'SCHEDULED' && myFeedback?.invitationStatus === 'PENDING' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="font-bold text-indigo-900">Lời mời tham gia phỏng vấn</p>
              <p className="mt-1 text-sm text-indigo-800">Bạn cần xác nhận tham gia trước khi hệ thống mở phiếu feedback.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => respondInvitation('ACCEPTED')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                  <CheckCircle2 size={17} /> Chấp nhận lời mời
                </button>
                <button disabled={busy} onClick={() => respondInvitation('DECLINED')} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 font-semibold text-rose-600 disabled:opacity-50">
                  <XCircle size={17} /> Từ chối
                </button>
              </div>
            </div>
          )}

          {current.status === 'SCHEDULED' && myFeedback?.invitationStatus === 'ACCEPTED' && showFeedbackForm && (
            <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
              <input type="number" min="0" max="100" value={feedback.score} onChange={e => setFeedback({ ...feedback, score: e.target.value })} className="rounded-lg border border-blue-200 p-2.5" placeholder="Điểm 0–100" />
              <select value={feedback.recommendation} onChange={e => setFeedback({ ...feedback, recommendation: e.target.value })} className="rounded-lg border border-blue-200 p-2.5">
                <option value="PASS">Đạt</option><option value="FAIL">Không đạt</option><option value="HOLD">Cần cân nhắc</option>
              </select>
              <textarea value={feedback.comments} onChange={e => setFeedback({ ...feedback, comments: e.target.value })} className="min-h-24 rounded-lg border border-blue-200 p-2.5 md:col-span-2" placeholder="Nhận xét bắt buộc" />
              <div className="flex gap-2 md:col-span-2">
                <button disabled={busy || !feedback.comments.trim()} onClick={submitFeedback} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{myFeedback.submittedAt ? 'Cập nhật feedback' : 'Gửi feedback'}</button>
                <button disabled={busy} onClick={() => setShowFeedbackForm(false)} className="rounded-lg border border-blue-200 bg-white px-4 py-2 font-semibold text-blue-700 disabled:opacity-50">Đóng</button>
              </div>
            </div>
          )}

          <div className="space-y-2">{current.participants.map(item => <div key={item.userId} className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-3 text-sm">
            <div><strong>{item.name}</strong><span className="ml-2 text-slate-500 font-medium">({ROLE_MAP[item.role] || item.role})</span>{item.comments && <p className="mt-1 text-slate-600">{item.comments}</p>}</div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={item.submittedAt ? 'font-semibold text-emerald-600' : current.status === 'NO_SHOW' ? 'font-semibold text-slate-500' : item.invitationStatus === 'DECLINED' ? 'font-semibold text-rose-600' : item.invitationStatus === 'PENDING' ? 'font-semibold text-indigo-600' : 'text-amber-600'}>
                {item.submittedAt ? `${item.overallScore} điểm · ${RECOMMENDATION_MAP[item.recommendation] || item.recommendation}` : current.status === 'NO_SHOW' ? 'Không feedback · Vắng mặt' : item.invitationStatus === 'DECLINED' ? 'Đã từ chối' : item.invitationStatus === 'PENDING' ? 'Chờ xác nhận' : 'Chưa feedback'}
              </span>
              {item.userId === user?.userId && current.status === 'SCHEDULED' && item.invitationStatus === 'ACCEPTED' && (
                <button disabled={busy} onClick={openFeedbackForm} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {item.submittedAt ? 'Sửa feedback' : 'Nhập feedback'}
                </button>
              )}
            </div>
          </div>)}</div>

          {round === 2 && current.status === 'SCHEDULED' && access.canSchedule && (
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

          {current.status === 'SCHEDULED' && current.leadUserId === user?.userId && myFeedback?.invitationStatus === 'ACCEPTED' && (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
              <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} className="min-h-24 rounded-lg border border-slate-200 p-3" placeholder="Kết luận tổng hợp của người chủ trì" />
              <div className="flex gap-2">
                <button disabled={busy || !allRequiredDone || !conclusion.trim()} onClick={completeInterview} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17} /> Hoàn tất buổi phỏng vấn</button>
                {access.canSchedule && <button disabled={busy} onClick={() => run(() => api.post(`/api/recruitment/interviews/${current.id}/no-show`), 'Đã ghi nhận vắng mặt.')} className="rounded-lg border border-rose-200 px-4 py-2 font-semibold text-rose-600">Vắng mặt</button>}
              </div>
              {!allRequiredDone && <p className="text-xs text-amber-700">Chưa thể hoàn tất vì còn thiếu feedback bắt buộc.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
