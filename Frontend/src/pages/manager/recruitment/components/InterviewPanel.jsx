import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, Cpu, HelpCircle, Loader2, MapPin, MessageSquareText, RefreshCw, Users, XCircle } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { useNotification } from '../../../../context/NotificationContext';
import useRealtimeSync from '../../../../hooks/useRealtimeSync';

const roundFromStatus = (status) => status === 'PENDING_INTERVIEW_1' ? 1
  : status === 'PENDING_INTERVIEW_2' ? 2 : null;

const INTERVIEW_STATUS_MAP = {
  SCHEDULED: 'Đã lên lịch',
  DONE: 'Đã hoàn tất',
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
  MEMBER: 'Thành viên hội đồng',
  HR: 'HR phụ trách',
  INTERVIEWER: 'Thành viên hội đồng',
  NHAN_VIEN: 'Kỹ sư chuyên môn',
  TRUONG_PHONG: 'Trưởng phòng',
  GIAM_DOC_PHONG_BAN: 'Giám đốc phòng ban'
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

const toDateTimeLocalValue = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatVndInput = (raw) => {
  if (raw === null || raw === undefined) return '';
  const digits = String(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseVndNumber = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const num = Number(digits);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const formatVndDisplay = (amount) => {
  const num = typeof amount === 'number' ? amount : parseVndNumber(amount);
  if (!num) return '—';
  return `${Math.round(num).toLocaleString('vi-VN')} VNĐ`;
};

export default function InterviewPanel({ applicationId, applicationStatus, verifyPoints = [], suggestedQuestions = [], jobTitle = '', onInterviewStateChange }) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const round = roundFromStatus(applicationStatus);
  const [interviews, setInterviews] = useState([]);
  const [people, setPeople] = useState([]);
  const [techSuggestions, setTechSuggestions] = useState([]);
  const [loadingTechSuggestions, setLoadingTechSuggestions] = useState(false);
  const [access, setAccess] = useState({ canSchedule: false, participant: false });
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [schedule, setSchedule] = useState({ start: '', end: '', mode: 'ONLINE', location: '', meetingUrl: '', lead: '', participants: [] });
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

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingData(true);
      setLoadError('');
    }
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
      if (!silent) setLoadingData(false);
    }
  }, [applicationId]);

  useEffect(() => {
    load({ silent: false }).catch(error => setLoadError(error.response?.data?.message || 'Không thể tải dữ liệu phỏng vấn.'));
  }, [load]);

  useRealtimeSync(
    () => {
      load({ silent: true }).catch(() => {});
    },
    {
      events: ['hrm:recruitment-sync', 'hrm:notification'],
      paused: showScheduleForm || showFeedbackForm || busy,
    }
  );

  const current = useMemo(() => interviews
    .filter(item => item.roundNumber === round)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0], [interviews, round]);
  const myFeedback = current?.participants?.find(item => item.userId === user?.userId);
  const allRequiredDone = current?.participants?.filter(item => item.feedbackRequired)
    .every(item => item.submittedAt);

  useEffect(() => {
    setShowFeedbackForm(false);
  }, [current?.id]);

  useEffect(() => {
    const saved = current?.negotiation;
    if (!saved) return;
    const savedAllowanceRaw = saved.allowances?.amount ?? saved.allowances?.description ?? '';
    setNegotiation({
      currentSalary: saved.currentSalary ? formatVndInput(Math.round(Number(saved.currentSalary))) : '',
      expectedSalary: saved.expectedSalary ? formatVndInput(Math.round(Number(saved.expectedSalary))) : '',
      preliminarySalary: saved.preliminarySalary ? formatVndInput(Math.round(Number(saved.preliminarySalary))) : '',
      allowances: savedAllowanceRaw ? formatVndInput(savedAllowanceRaw) : '',
      expectations: saved.otherExpectations || '',
      notes: saved.notes || '',
    });
  }, [current?.id, current?.negotiation?.recordedAt]);

  // Đồng bộ điều kiện mở khóa nút "Duyệt chuyển bước" lên ApplicationDetailPage (khớp 1-1 với Backend requireReadyToPass)
  useEffect(() => {
    if (typeof onInterviewStateChange !== 'function') return;
    if (!round) {
      onInterviewStateChange({ ready: true, loading: false, blockers: [] });
      return;
    }
    if (loadingData) {
      onInterviewStateChange({ ready: false, loading: true, blockers: [] });
      return;
    }

    const latestDone = interviews
      .filter((item) => item.roundNumber === round && (item.status === 'DONE' || item.status === 'COMPLETED'))
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    const target = latestDone || current;
    const blockers = [];

    if (!target || ['RESCHEDULED', 'NO_SHOW', 'CANCELLED'].includes(target.status)) {
      blockers.push(`Chưa có lịch phỏng vấn Vòng ${round} đang hoạt động (HR phụ trách chiến dịch cần tạo lịch).`);
    } else {
      const requiredParticipants = (target.participants || []).filter(
        (p) => p.feedbackRequired && p.invitationStatus !== 'DECLINED'
      );
      const pendingConfirm = requiredParticipants.filter((p) => p.invitationStatus !== 'ACCEPTED');
      const missingFeedback = requiredParticipants.filter(
        (p) => p.invitationStatus === 'ACCEPTED' && !p.submittedAt
      );

      if (pendingConfirm.length > 0) {
        blockers.push(
          `Chưa xác nhận lời mời phỏng vấn: ${pendingConfirm.map((p) => `${p.name} (${ROLE_MAP[p.role] || p.role})`).join(', ')}.`
        );
      }
      if (missingFeedback.length > 0) {
        blockers.push(
          `Chưa gửi phiếu feedback: ${missingFeedback.map((p) => `${p.name} (${ROLE_MAP[p.role] || p.role})`).join(', ')}.`
        );
      }

      const isDone = target.status === 'DONE' || target.status === 'COMPLETED';
      if (!isDone) {
        const leadPerson = (target.participants || []).find((p) => p.userId === target.leadUserId);
        const leadLabel = leadPerson ? leadPerson.name : 'Người chủ trì';
        blockers.push(`Chủ trì (${leadLabel}) chưa bấm "Hoàn tất buổi phỏng vấn" và ghi kết luận tổng hợp.`);
      } else if (!target.conclusion || !String(target.conclusion).trim()) {
        blockers.push(`Thiếu kết luận tổng hợp của buổi phỏng vấn Vòng ${round}.`);
      }

      if (round === 2 && !target.negotiation) {
        blockers.push('HR phụ trách chiến dịch chưa lưu kết quả đàm phán lương sơ bộ của Vòng 2.');
      }
    }

    onInterviewStateChange({
      ready: blockers.length === 0,
      loading: false,
      blockers,
    });
  }, [onInterviewStateChange, round, loadingData, interviews, current]);

  // Module 2 (HR ↔ Tech): Gợi ý Hội đồng Kỹ thuật dựa trên Tech Skills, % tải dự án và lịch nghỉ phép
  const interviewDateOnly = schedule.start ? String(schedule.start).slice(0, 10) : '';
  useEffect(() => {
    if (!access.canSchedule || !applicationId) {
      setTechSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoadingTechSuggestions(true);
    api
      .get('/api/tech-hr/interviewer-suggestions', {
        params: {
          applicationId,
          ...(interviewDateOnly ? { interviewDate: interviewDateOnly } : {}),
        },
      })
      .then((res) => {
        if (!cancelled) {
          setTechSuggestions(res.data?.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) setTechSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTechSuggestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [access.canSchedule, applicationId, interviewDateOnly]);

  const allEligiblePeople = useMemo(() => {
    const map = new Map();
    people.forEach((p) => {
      const canLeadR1 = p.canLeadRound1 !== false;
      const canLeadR2 = p.canLeadRound2 !== undefined
        ? Boolean(p.canLeadRound2)
        : p.role !== 'NHAN_VIEN';
      map.set(String(p.id), {
        ...p,
        canLeadRound1: canLeadR1,
        canLeadRound2: canLeadR2,
      });
    });
    techSuggestions.forEach((s) => {
      const key = String(s.userId);
      const canLeadR1 = s.canLeadRound1 !== false;
      const canLeadR2 = s.canLeadRound2 !== undefined
        ? Boolean(s.canLeadRound2)
        : (s.role === 'TRUONG_PHONG' || s.role === 'GIAM_DOC_PHONG_BAN');
      if (!map.has(key)) {
        map.set(key, {
          id: s.userId,
          name: `${s.hoTen}${s.chucVu ? ` (${s.chucVu})` : ''}`,
          role: s.role || 'NHAN_VIEN',
          canLeadRound1: canLeadR1,
          canLeadRound2: canLeadR2,
        });
      }
    });
    return Array.from(map.values());
  }, [people, techSuggestions]);

  const leadEligibleOptions = useMemo(() => {
    return allEligiblePeople.filter((p) => (round === 2 ? p.canLeadRound2 : p.canLeadRound1));
  }, [allEligiblePeople, round]);

  const panelMemberOptions = useMemo(() => {
    return allEligiblePeople.filter((p) => String(p.id) !== String(schedule.lead));
  }, [allEligiblePeople, schedule.lead]);

  const selectLead = useCallback((userIdStr) => {
    const normalized = String(userIdStr || '');
    setSchedule((prev) => ({
      ...prev,
      lead: normalized,
      participants: (prev.participants || []).filter((uid) => String(uid) !== normalized),
    }));
  }, []);

  const toggleParticipant = useCallback((userIdStr) => {
    const normalized = String(userIdStr || '');
    if (!normalized) return;
    setSchedule((prev) => {
      if (String(prev.lead) === normalized) return prev;
      const exists = (prev.participants || []).some((uid) => String(uid) === normalized);
      return {
        ...prev,
        participants: exists
          ? (prev.participants || []).filter((uid) => String(uid) !== normalized)
          : [...(prev.participants || []), normalized],
      };
    });
  }, []);

  useEffect(() => {
    if (!schedule.lead) return;
    const stillValidLead = leadEligibleOptions.some((p) => String(p.id) === String(schedule.lead));
    if (!stillValidLead && leadEligibleOptions.length > 0) {
      setSchedule((prev) => ({ ...prev, lead: '' }));
    }
  }, [round, leadEligibleOptions, schedule.lead]);

  const round1Reference = useMemo(() => {
    if (round !== 2) return null;
    return interviews
      .filter((item) => item.roundNumber === 1 && ['DONE', 'COMPLETED', 'SCHEDULED'].includes(item.status))
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] || null;
  }, [interviews, round]);

  const minScheduleStartLocal = useMemo(() => {
    const now = new Date();
    const r1End = round1Reference?.scheduledEnd ? new Date(round1Reference.scheduledEnd) : null;
    const minDate = r1End && r1End.getTime() > now.getTime() ? r1End : now;
    return toDateTimeLocalValue(minDate);
  }, [round1Reference, showScheduleForm, round]);

  const scheduleValidation = useMemo(() => {
    let startError = '';
    if (schedule.start) {
      const startDate = new Date(schedule.start);
      if (Number.isNaN(startDate.getTime())) {
        startError = 'Định dạng thời gian không hợp lệ.';
      } else {
        const now = new Date();
        if (startDate.getTime() < now.getTime() - 60 * 1000) {
          startError = 'Thời gian bắt đầu phỏng vấn không được nằm trong quá khứ.';
        } else {
          const maxFuture = new Date(now);
          maxFuture.setMonth(maxFuture.getMonth() + 6);
          if (startDate.getTime() > maxFuture.getTime()) {
            startError = 'Thời gian phỏng vấn không được vượt quá 6 tháng kể từ hiện tại.';
          } else if (round === 2 && round1Reference?.scheduledEnd) {
            const r1End = new Date(round1Reference.scheduledEnd);
            if (!Number.isNaN(r1End.getTime()) && startDate.getTime() < r1End.getTime()) {
              const r1Label = r1End.toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              startError = `Phỏng vấn Vòng 2 phải diễn ra sau khi kết thúc Vòng 1 (${r1Label}).`;
            }
          }
        }
      }
    }

    let meetingUrlError = '';
    const trimmedUrl = (schedule.meetingUrl || '').trim();
    if (trimmedUrl && !/^https?:\/\/\S+$/i.test(trimmedUrl)) {
      meetingUrlError = 'Link họp online phải bắt đầu bằng http:// hoặc https://.';
    }

    return {
      startError,
      meetingUrlError,
      hasError: Boolean(startError || meetingUrlError),
    };
  }, [schedule.start, schedule.meetingUrl, round, round1Reference]);

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
    participants: (schedule.participants || [])
      .filter((uid) => String(uid) !== String(schedule.lead))
      .map((uid) => ({
        userId: Number(uid),
        role: 'INTERVIEWER',
        feedbackRequired: true,
      })),
  }).then(result => {
    setShowScheduleForm(false);
    setSchedule((prev) => ({ ...prev, participants: [] }));
    return result;
  }), current?.status === 'SCHEDULED' ? 'Đã đặt lại lịch, gửi lại lời mời và giữ lịch sử cũ.' : 'Đã tạo lịch, gửi email cho ứng viên và lời mời cho hội đồng phỏng vấn.');

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

  const saveNegotiation = () => {
    const currentSal = parseVndNumber(negotiation.currentSalary);
    const expectedSal = parseVndNumber(negotiation.expectedSalary);
    const preliminarySal = parseVndNumber(negotiation.preliminarySalary);
    const allowanceAmount = parseVndNumber(negotiation.allowances);
    return run(() => api.put(`/api/recruitment/interviews/${current.id}/salary-negotiation`, {
      currentSalary: currentSal,
      expectedSalary: expectedSal,
      preliminarySalary: preliminarySal,
      allowances: {
        amount: allowanceAmount,
        description: allowanceAmount ? formatVndDisplay(allowanceAmount) : '',
      },
      otherExpectations: negotiation.expectations || null,
      notes: negotiation.notes
    }), 'Đã lưu kết quả đàm phán sơ bộ.');
  };

  const activeR1Q = round1Questions.length > 0 ? round1Questions : suggestedQuestions;
  const isBeforeScheduledStart = Boolean(
    current?.scheduledStart && Date.now() < new Date(current.scheduledStart).getTime()
  );
  const scheduledStartLabel = current?.scheduledStart
    ? new Date(current.scheduledStart).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

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
            <label className="mb-1 block text-xs font-medium text-slate-600">Thời gian phỏng vấn (Thời gian bắt đầu) *</label>
            <input
              type="datetime-local"
              min={minScheduleStartLocal}
              value={schedule.start}
              onChange={e => setSchedule({ ...schedule, start: e.target.value })}
              className={`w-full rounded-lg border bg-white p-2.5 text-sm outline-none transition ${
                scheduleValidation.startError
                  ? 'border-rose-400 ring-2 ring-rose-100 text-rose-700'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
              }`}
            />
            {scheduleValidation.startError ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{scheduleValidation.startError}</span>
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                {round === 2 && round1Reference?.scheduledEnd
                  ? `Phải từ thời điểm hiện tại trở đi và sau Vòng 1 (${new Date(round1Reference.scheduledEnd).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}).`
                  : 'Chỉ chọn thời điểm từ hiện tại trở đi (thời lượng mặc định 45 phút).'}
              </p>
            )}
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
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-xs font-medium text-slate-600">Người chủ trì phỏng vấn *</label>
              <span className="text-[11px] font-medium text-slate-500">
                {round === 1
                  ? 'Vòng 1: Quản lý phòng ban, Senior/Tech Lead (CN) hoặc HR phụ trách'
                  : 'Vòng 2: Bắt buộc Quản lý phòng ban (Trưởng phòng/Giám đốc) hoặc HR phụ trách'}
              </span>
            </div>
            <select value={schedule.lead} onChange={e => selectLead(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
              <option value="">-- Chọn người chủ trì --</option>
              {leadEligibleOptions.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name} · {ROLE_MAP[person.role] || person.role}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn thêm Thành viên hội đồng cùng tham gia (tùy chọn) */}
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Thành viên hội đồng cùng tham gia <span className="font-normal text-slate-400">(Tùy chọn)</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Mời thêm Kỹ sư Senior/Tech Lead hoặc Quản lý cùng chấm điểm độc lập trước khi Chủ trì kết luận
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {(schedule.participants || []).length > 0
                  ? `Đã chọn ${(schedule.participants || []).length} thành viên`
                  : 'Chưa chọn thêm'}
              </span>
            </div>
            {panelMemberOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {panelMemberOptions.map((person) => {
                  const isPicked = (schedule.participants || []).some((uid) => String(uid) === String(person.id));
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleParticipant(String(person.id))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isPicked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60'
                      }`}
                    >
                      <span>{isPicked ? '✓' : '+'}</span>
                      <span>{person.name}</span>
                      <span className={`text-[10px] ${isPicked ? 'text-indigo-100' : 'text-slate-400'}`}>
                        · {ROLE_MAP[person.role] || person.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Không còn thành viên hợp lệ khác để mời thêm.</p>
            )}
          </div>

          {/* Module 2 (HR ↔ Tech): Gợi ý Hội đồng Kỹ thuật từ Tech Skills & Bench */}
          {(loadingTechSuggestions || techSuggestions.length > 0) && (
            <div className="md:col-span-2 rounded-xl border border-blue-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                    <Cpu size={15} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Gợi ý Hội đồng Kỹ thuật (Chỉ Senior / Expert / Tech Lead &amp; Quản lý CN)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {round === 1
                        ? `Vòng 1 (Kỹ thuật): Có thể chọn làm Chủ trì hoặc Mời vào hội đồng${interviewDateOnly ? ` ngày ${interviewDateOnly}` : ''}`
                        : `Vòng 2 (Chốt & Đàm phán): Quản lý chủ trì; Senior/Tech Lead tham gia vai trò Thành viên hội đồng${interviewDateOnly ? ` ngày ${interviewDateOnly}` : ''}`}
                    </p>
                  </div>
                </div>
                {loadingTechSuggestions && <Loader2 size={14} className="animate-spin text-blue-600" />}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {techSuggestions.slice(0, 6).map((s) => {
                  const uidStr = String(s.userId);
                  const isLead = String(schedule.lead) === uidStr;
                  const isMember = (schedule.participants || []).some((uid) => String(uid) === uidStr);
                  const canBeLead = round === 2
                    ? (s.canLeadRound2 !== undefined ? Boolean(s.canLeadRound2) : (s.role === 'TRUONG_PHONG' || s.role === 'GIAM_DOC_PHONG_BAN'))
                    : (s.canLeadRound1 !== false);
                  const badgeStyle =
                    s.availabilityBadge === 'OPTIMAL'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : s.availabilityBadge === 'BUSY'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : s.availabilityBadge === 'ON_LEAVE'
                      ? 'bg-slate-100 text-slate-600 border-slate-300'
                      : 'bg-rose-50 text-rose-700 border-rose-200';
                  const badgeLabel =
                    s.availabilityBadge === 'OPTIMAL'
                      ? 'Sẵn sàng tốt'
                      : s.availabilityBadge === 'BUSY'
                      ? 'Bận vừa'
                      : s.availabilityBadge === 'ON_LEAVE'
                      ? 'Đang nghỉ phép'
                      : 'Quá tải';
                  return (
                    <div
                      key={s.userId}
                      className={`p-3 rounded-xl border text-xs transition flex flex-col justify-between gap-2 ${
                        isLead
                          ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                          : isMember
                          ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{s.hoTen}</p>
                            <p className="text-[11px] text-slate-500 truncate">{s.chucVu || 'Kỹ sư phần mềm'}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                            {badgeLabel} · Tải {s.totalAllocation}%
                          </span>
                        </div>
                        {s.matchedSkills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {s.matchedSkills.map((sk, idx) => (
                              <span key={idx} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                        {s.recommendationReason && (
                          <p className="text-[11px] text-slate-600">{s.recommendationReason}</p>
                        )}
                      </div>

                      {s.onLeaveThatDay ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                        >
                          Đang nghỉ phép ngày này
                        </button>
                      ) : canBeLead ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => selectLead(uidStr)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isLead
                                ? 'bg-blue-700 text-white'
                                : 'bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200'
                            }`}
                          >
                            {isLead ? '✓ Đang Chủ trì' : 'Chọn Chủ trì'}
                          </button>
                          <button
                            type="button"
                            disabled={isLead}
                            onClick={() => toggleParticipant(uidStr)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                              isMember
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isMember ? '✓ Trong hội đồng' : '+ Vào hội đồng'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleParticipant(uidStr)}
                            className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isMember
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isMember ? '✓ Đã mời vào hội đồng (Vòng 2)' : '+ Mời vào hội đồng chuyên môn'}
                          </button>
                          <p className="text-[10px] text-slate-400 text-center">Vòng 2 yêu cầu Quản lý phòng ban chủ trì</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(round !== 1 && schedule.mode !== 'ONLINE') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Địa điểm phỏng vấn</label>
              <input placeholder="VD: Phòng họp A, Tầng 3" value={schedule.location} onChange={e => setSchedule({ ...schedule, location: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" />
            </div>
          )}
          <div className={(round === 1 || schedule.mode === 'ONLINE') ? "md:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-medium text-slate-600">Link họp online (Google Meet / Zoom...)</label>
            <input
              placeholder="https://meet.google.com/..."
              value={schedule.meetingUrl}
              onChange={e => setSchedule({ ...schedule, meetingUrl: e.target.value })}
              className={`w-full rounded-lg border bg-white p-2.5 text-sm outline-none transition ${
                scheduleValidation.meetingUrlError
                  ? 'border-rose-400 ring-2 ring-rose-100 text-rose-700'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
              }`}
            />
            {scheduleValidation.meetingUrlError && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{scheduleValidation.meetingUrlError}</span>
              </p>
            )}
          </div>
          <p className="md:col-span-2 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            📧 Ứng viên sẽ nhận email; người phỏng vấn sẽ nhận lời mời nội bộ và phải xác nhận tham gia.
          </p>
          <button disabled={busy || !schedule.start || !schedule.lead || scheduleValidation.hasError} onClick={() => scheduleInterview()}
            className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition">
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
            {current.completedBeforeSchedule && (
              <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <span>
                  Dấu vết kiểm toán: Buổi phỏng vấn được bấm hoàn tất trước giờ hẹn dự kiến ({scheduledStartLabel})
                  {current.completedAt ? ` lúc ${new Date(current.completedAt).toLocaleString('vi-VN')}` : ''}.
                </span>
              </div>
            )}
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
              {isBeforeScheduledStart && (
                <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lưu ý kiểm toán:</strong> Lịch phỏng vấn dự kiến bắt đầu lúc <strong>{scheduledStartLabel}</strong>. Bạn đang nhập phiếu đánh giá trước giờ hẹn — thời điểm gửi sẽ được lưu vết kiểm toán để Trưởng phòng đối chiếu.
                  </span>
                </div>
              )}
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

          <div className="space-y-2">{current.participants.map(item => {
            const isEarlyFeedback = Boolean(
              item.submittedBeforeSchedule ||
              (item.submittedAt && current.scheduledStart && new Date(item.submittedAt) < new Date(current.scheduledStart))
            );
            return (
              <div key={item.userId} className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.name}</strong>
                    <span className="text-slate-500 font-medium">({ROLE_MAP[item.role] || item.role})</span>
                    {isEarlyFeedback && (
                      <span
                        title={`Gửi lúc ${new Date(item.submittedAt).toLocaleString('vi-VN')} (trước giờ hẹn ${scheduledStartLabel})`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                      >
                        <AlertTriangle size={11} className="text-amber-600" />
                        Gửi trước giờ hẹn
                      </span>
                    )}
                  </div>
                  {item.comments && <p className="mt-1 text-slate-600">{item.comments}</p>}
                  {item.submittedAt && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Gửi phiếu lúc {new Date(item.submittedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
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
              </div>
            );
          })}</div>

          {round === 2 && current.status === 'SCHEDULED' && access.canSchedule && (
            <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/80 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-violet-950">Đàm phán lương sơ bộ (Vòng 2)</p>
                  <p className="text-xs text-violet-700">Chỉ HR phụ trách chiến dịch ghi nhận — các trường tiền tệ tự động định dạng theo VNĐ.</p>
                </div>
                {current.negotiation && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} /> Đã lưu kết quả đàm phán
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Lương hiện tại (tự nguyện)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="VD: 15.000.000"
                      value={negotiation.currentSalary}
                      onChange={e => setNegotiation({ ...negotiation, currentSalary: formatVndInput(e.target.value) })}
                      className="w-full rounded-lg border border-violet-200 bg-white py-2.5 pl-3 pr-14 text-sm font-medium text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Mức mong muốn *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="VD: 20.000.000"
                      value={negotiation.expectedSalary}
                      onChange={e => setNegotiation({ ...negotiation, expectedSalary: formatVndInput(e.target.value) })}
                      className="w-full rounded-lg border border-violet-200 bg-white py-2.5 pl-3 pr-14 text-sm font-medium text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Mức thống nhất sơ bộ *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="VD: 18.000.000"
                      value={negotiation.preliminarySalary}
                      onChange={e => setNegotiation({ ...negotiation, preliminarySalary: formatVndInput(e.target.value) })}
                      className="w-full rounded-lg border border-violet-200 bg-white py-2.5 pl-3 pr-14 text-sm font-medium text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Phụ cấp dự kiến (nếu có)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="VD: 1.500.000"
                      value={negotiation.allowances}
                      onChange={e => setNegotiation({ ...negotiation, allowances: formatVndInput(e.target.value) })}
                      className="w-full rounded-lg border border-violet-200 bg-white py-2.5 pl-3 pr-14 text-sm font-medium text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Kỳ vọng khác</label>
                  <input
                    placeholder="VD: Thời gian nhận việc, chế độ review lương, thiết bị làm việc..."
                    value={negotiation.expectations}
                    onChange={e => setNegotiation({ ...negotiation, expectations: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 bg-white p-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-violet-900">Ghi chú đàm phán bắt buộc *</label>
                  <textarea
                    placeholder="Ghi nhận tóm tắt kết quả trao đổi lương, phúc lợi và điều kiện nhận việc..."
                    value={negotiation.notes}
                    onChange={e => setNegotiation({ ...negotiation, notes: e.target.value })}
                    className="w-full min-h-20 rounded-lg border border-violet-200 bg-white p-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                <button
                  disabled={busy || !parseVndNumber(negotiation.expectedSalary) || !parseVndNumber(negotiation.preliminarySalary) || !negotiation.notes.trim()}
                  onClick={saveNegotiation}
                  className="md:col-span-2 rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2.5 font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {current.negotiation ? 'Cập nhật đàm phán sơ bộ' : 'Lưu đàm phán sơ bộ'}
                </button>
              </div>
            </div>
          )}

          {round === 2 && current.status !== 'SCHEDULED' && current.negotiation && access.canSchedule && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 text-xs text-violet-950 space-y-1.5">
              <p className="text-sm font-bold text-violet-900">Kết quả đàm phán lương sơ bộ đã lưu</p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 pt-1 tabular-nums">
                <div><span className="text-violet-700">Lương hiện tại:</span> <strong>{formatVndDisplay(current.negotiation.currentSalary)}</strong></div>
                <div><span className="text-violet-700">Mức mong muốn:</span> <strong>{formatVndDisplay(current.negotiation.expectedSalary)}</strong></div>
                <div><span className="text-violet-700">Thống nhất sơ bộ:</span> <strong className="text-emerald-700">{formatVndDisplay(current.negotiation.preliminarySalary)}</strong></div>
                <div><span className="text-violet-700">Phụ cấp:</span> <strong>{formatVndDisplay(current.negotiation.allowances?.amount ?? current.negotiation.allowances?.description)}</strong></div>
              </div>
              {current.negotiation.notes && <p className="text-violet-800 pt-1">Ghi chú: {current.negotiation.notes}</p>}
            </div>
          )}

          {current.status === 'SCHEDULED' && current.leadUserId === user?.userId && myFeedback?.invitationStatus === 'ACCEPTED' && (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
              {isBeforeScheduledStart && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cảnh báo hoàn tất sớm:</strong> Lịch phỏng vấn dự kiến lúc <strong>{scheduledStartLabel}</strong>. Chỉ bấm hoàn tất trước giờ hẹn nếu buổi phỏng vấn đã thực sự diễn ra sớm hơn lịch; hệ thống sẽ gắn dấu vết kiểm toán.
                  </span>
                </div>
              )}
              <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} className="min-h-24 rounded-lg border border-slate-200 p-3" placeholder="Kết luận tổng hợp của người chủ trì" />
              <div className="flex gap-2">
                <button disabled={busy || !allRequiredDone || !conclusion.trim()} onClick={completeInterview} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17} /> Hoàn tất buổi phỏng vấn</button>
                {access.canSchedule && (
                  <button
                    disabled={busy || isBeforeScheduledStart}
                    title={isBeforeScheduledStart ? `Chưa đến giờ phỏng vấn (${scheduledStartLabel}) — không thể đánh dấu vắng mặt trước giờ hẹn` : undefined}
                    onClick={() => run(() => api.post(`/api/recruitment/interviews/${current.id}/no-show`), 'Đã ghi nhận vắng mặt.')}
                    className="rounded-lg border border-rose-200 px-4 py-2 font-semibold text-rose-600 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Vắng mặt
                  </button>
                )}
              </div>
              {!allRequiredDone && <p className="text-xs text-amber-700">Chưa thể hoàn tất vì còn thiếu feedback bắt buộc.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
