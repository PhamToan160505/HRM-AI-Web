import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users2,
  Plus,
  Sparkles,
  Star,
  MessageSquare,
  Award,
  ChevronRight,
  BookOpen,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
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

export default function TechMentorshipPanel({
  departmentId,
  isReadOnly = false,
  onInspectEngineer,
  initialEngineers = [],
  initialSkills = [],
}) {
  const toast = useToast();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Smart suggestions modal
  const [isMatcherOpen, setIsMatcherOpen] = useState(false);
  const [availableEngineers, setAvailableEngineers] = useState(initialEngineers || []);
  const [availableSkills, setAvailableSkills] = useState(initialSkills || []);

  useEffect(() => {
    if (initialEngineers && initialEngineers.length > 0 && availableEngineers.length === 0) {
      setAvailableEngineers(initialEngineers);
    }
  }, [initialEngineers, availableEngineers.length]);

  useEffect(() => {
    if (initialSkills && initialSkills.length > 0 && availableSkills.length === 0) {
      setAvailableSkills(initialSkills);
    }
  }, [initialSkills, availableSkills.length]);
  const [matcherMenteeId, setMatcherMenteeId] = useState('');
  const [matcherSkillId, setMatcherSkillId] = useState('');
  const [matcherResults, setMatcherResults] = useState(null);
  const [searchingMatcher, setSearchingMatcher] = useState(false);

  // Create program modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mentorId, setMentorId] = useState('');
  const [menteeId, setMenteeId] = useState('');
  const [focusSkillId, setFocusSkillId] = useState('');
  const [programTitle, setProgramTitle] = useState('');
  const [targetGoal, setTargetGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPresetMonths, setSelectedPresetMonths] = useState(3);
  const [submittingProgram, setSubmittingProgram] = useState(false);
  const [createMatcherSuggestions, setCreateMatcherSuggestions] = useState(null);
  const [loadingCreateMatcher, setLoadingCreateMatcher] = useState(false);

  // Checkins modal
  const [activeProgForCheckin, setActiveProgForCheckin] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [isAddingCheckin, setIsAddingCheckin] = useState(false);
  const [checkinDate, setCheckinDate] = useState(new Date().toISOString().substring(0, 10));
  const [topicsCovered, setTopicsCovered] = useState('');
  const [progressRating, setProgressRating] = useState(4);
  const [mentorFeedback, setMentorFeedback] = useState('');
  const [menteeNotes, setMenteeNotes] = useState('');
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Complete program modal
  const [completingProg, setCompletingProg] = useState(null);
  const [finalAssessment, setFinalAssessment] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // View Detail modal
  const [viewingProg, setViewingProg] = useState(null);

  // Edit Program modal
  const [editingProg, setEditingProg] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editFocusSkillId, setEditFocusSkillId] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Program modal
  const [deletingProg, setDeletingProg] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const openEditModal = (prog) => {
    setEditingProg(prog);
    setEditTitle(prog.programTitle || '');
    setEditGoal(prog.targetGoal || '');
    setEditFocusSkillId(prog.focusSkillId ? String(prog.focusSkillId) : '');
    setEditEndDate(prog.endDate || '');
    setEditStatus(prog.status || 'ACTIVE');
  };

  const handleUpdateProgram = async (e) => {
    e.preventDefault();
    if (!editingProg) return;
    if (!editTitle.trim() || !editGoal.trim() || !editEndDate) {
      toast?.show('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin bắt buộc', 'warning');
      return;
    }
    const s = new Date(editingProg.startDate);
    const end = new Date(editEndDate);
    if (end < s) {
      toast?.show('Thời gian không hợp lệ', 'Ngày kết thúc không được trước ngày bắt đầu!', 'warning');
      return;
    }
    const maxEnd = new Date(s);
    maxEnd.setMonth(s.getMonth() + 6);
    if (end > maxEnd) {
      toast?.show('Thời gian không hợp lệ', 'Thời lượng kèm cặp tối đa không được vượt quá 6 tháng!', 'warning');
      return;
    }

    try {
      setSubmittingEdit(true);
      const payload = {
        programTitle: editTitle.trim(),
        targetGoal: editGoal.trim(),
        focusSkillId: editFocusSkillId ? Number(editFocusSkillId) : null,
        endDate: editEndDate,
        status: editStatus,
      };
      const res = await api.put(`/api/tech/mentorship/programs/${editingProg.id}`, payload);
      if (res.data?.data) {
        toast?.show('Thành công', 'Đã cập nhật thông tin chương trình kèm cặp', 'success');
        setEditingProg(null);
        fetchPrograms();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật chương trình', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!deletingProg) return;
    try {
      setSubmittingDelete(true);
      await api.delete(`/api/tech/mentorship/programs/${deletingProg.id}`);
      toast?.show('Thành công', `Đã xóa chương trình kèm cặp '${deletingProg.programTitle}'`, 'success');
      setDeletingProg(null);
      fetchPrograms();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa chương trình', 'error');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const fetchPrograms = useCallback(async () => {
    if (!departmentId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tech/mentorship/department/${departmentId}`);
      if (res.data?.data) {
        setPrograms(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải danh sách kèm cặp', 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentId, toast]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [empRes, skillRes] = await Promise.allSettled([
        api.get('/api/tech/projects/bench'),
        api.get('/api/tech/skills'),
      ]);
      if (empRes.status === 'fulfilled' && Array.isArray(empRes.value?.data?.data) && empRes.value.data.data.length > 0) {
        setAvailableEngineers(empRes.value.data.data);
      } else {
        // Fallback to skill matrix if bench is empty
        try {
          const matrixRes = await api.get('/api/tech/skills/matrix');
          if (matrixRes.data?.data && Array.isArray(matrixRes.data.data) && matrixRes.data.data.length > 0) {
            setAvailableEngineers(matrixRes.data.data);
          }
        } catch {}
      }

      if (skillRes.status === 'fulfilled' && skillRes.value?.data?.data) {
        setAvailableSkills(skillRes.value.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải metadata kèm cặp:', err);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchMetadata();
  }, [fetchPrograms, fetchMetadata]);

  // Integrated Smart Matcher inside Create Program Modal
  useEffect(() => {
    if (!isCreateOpen || !menteeId) {
      setCreateMatcherSuggestions(null);
      return;
    }

    let activeSkillId = focusSkillId;
    if (!activeSkillId && targetGoal && availableSkills.length > 0) {
      const lower = targetGoal.toLowerCase();
      const matched = availableSkills.find((s) => lower.includes(s.skillName.toLowerCase()));
      if (matched) {
        activeSkillId = matched.id;
      }
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingCreateMatcher(true);
        const params = { menteeId };
        if (activeSkillId) params.skillId = activeSkillId;
        const res = await api.get('/api/tech/mentorship/smart-suggestions', { params });
        if (res.data?.data?.suggestedMentors) {
          setCreateMatcherSuggestions(res.data.data.suggestedMentors);
        }
      } catch (err) {
        console.warn('Smart matcher query error:', err);
      } finally {
        setLoadingCreateMatcher(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isCreateOpen, menteeId, focusSkillId, targetGoal, availableSkills]);

  // Smart suggestions trigger
  const handleRunSmartMatcher = async () => {
    if (!matcherMenteeId) {
      toast?.show('Yêu cầu chọn', 'Vui lòng chọn kỹ sư Mentee cần bồi dưỡng', 'warning');
      return;
    }
    try {
      setSearchingMatcher(true);
      const params = { menteeId: matcherMenteeId };
      if (matcherSkillId) params.skillId = matcherSkillId;
      const res = await api.get('/api/tech/mentorship/smart-suggestions', { params });
      if (res.data?.data) {
        setMatcherResults(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tìm gợi ý Mentor', 'error');
    } finally {
      setSearchingMatcher(false);
    }
  };

  const handlePickSuggestedMentor = (candidate) => {
    setMentorId(candidate.mentorId);
    setMenteeId(matcherMenteeId);
    setFocusSkillId(matcherSkillId || '');
    setProgramTitle(`Lộ trình Kèm cặp 1-1: ${matcherResults?.skillName || 'Năng lực Kỹ thuật Chuyên sâu'}`);
    setTargetGoal(`Nâng bậc năng lực và làm chủ công nghệ ${matcherResults?.skillName || 'dự án'}`);
    const today = new Date();
    setStartDate(today.toISOString().substring(0, 10));
    const nextQuarter = new Date();
    nextQuarter.setMonth(today.getMonth() + 3);
    setEndDate(nextQuarter.toISOString().substring(0, 10));
    setSelectedPresetMonths(3);
    setIsMatcherOpen(false);
    setIsCreateOpen(true);
  };

  const dateValidation = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minBackdate = new Date(today);
    minBackdate.setDate(today.getDate() - 30);

    if (start < minBackdate) {
      const minDateStr = `${String(minBackdate.getDate()).padStart(2, '0')}/${String(minBackdate.getMonth() + 1).padStart(2, '0')}/${minBackdate.getFullYear()}`;
      return {
        isValid: false,
        type: 'start_too_old',
        message: `Ngày bắt đầu không được trước ngày ${minDateStr} (giới hạn tối đa 30 ngày trong chu kỳ báo cáo tháng)!`,
      };
    }

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isValid: false,
        type: 'negative',
        message: 'Ngày kết thúc dự kiến không được trước ngày bắt đầu!',
        days: diffDays,
      };
    }
    if (diffDays === 0) {
      return {
        isValid: false,
        type: 'same_day',
        message: 'Ngày kết thúc phải sau ngày bắt đầu ít nhất 14 ngày (2 tuần)!',
        days: 0,
      };
    }
    if (diffDays < 14) {
      return {
        isValid: false,
        type: 'too_short',
        message: `Thời lượng kèm cặp (${diffDays} ngày) quá ngắn! Chu kỳ tối thiểu là 14 ngày (2 tuần) để đảm bảo hiệu quả bồi dưỡng.`,
        days: diffDays,
      };
    }
    const maxAllowedEndDate = new Date(start);
    maxAllowedEndDate.setMonth(start.getMonth() + 6);

    if (end > maxAllowedEndDate) {
      const maxDateStr = `${String(maxAllowedEndDate.getDate()).padStart(2, '0')}/${String(maxAllowedEndDate.getMonth() + 1).padStart(2, '0')}/${maxAllowedEndDate.getFullYear()}`;
      return {
        isValid: false,
        type: 'too_long',
        message: `Thời lượng kèm cặp (${diffDays} ngày) vượt quá 6 tháng (tối đa đến ngày ${maxDateStr})! Chu kỳ kèm cặp kỹ năng tối đa là 6 tháng để đảm bảo tính tập trung.`,
        days: diffDays,
      };
    }

    const months = (diffDays / 30).toFixed(1);
    return {
      isValid: true,
      type: 'valid',
      message: `Thời lượng dự kiến: ${diffDays} ngày (~${months} tháng) • Đạt chuẩn chu kỳ kèm cặp`,
      days: diffDays,
      months,
    };
  }, [startDate, endDate]);

  const maxEndDate = useMemo(() => {
    if (!startDate) return undefined;
    const s = new Date(startDate);
    if (isNaN(s.getTime())) return undefined;
    const maxDate = new Date(s);
    maxDate.setMonth(s.getMonth() + 6);
    return maxDate.toISOString().substring(0, 10);
  }, [startDate]);

  const handleApplyDurationPreset = (months) => {
    setSelectedPresetMonths(months);
    const base = startDate ? new Date(startDate) : new Date();
    const target = new Date(base);
    target.setMonth(base.getMonth() + months);
    setEndDate(target.toISOString().substring(0, 10));
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (val) {
      const s = new Date(val);
      if (selectedPresetMonths) {
        const next = new Date(s);
        next.setMonth(s.getMonth() + selectedPresetMonths);
        setEndDate(next.toISOString().substring(0, 10));
      } else if (endDate) {
        const e = new Date(endDate);
        if (e <= s) {
          const next = new Date(s);
          next.setMonth(s.getMonth() + 3);
          setEndDate(next.toISOString().substring(0, 10));
          setSelectedPresetMonths(3);
        }
      }
    }
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    if (startDate && val) {
      const s = new Date(startDate);
      const e = new Date(val);
      const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 28 && diffDays <= 32) setSelectedPresetMonths(1);
      else if (diffDays >= 88 && diffDays <= 93) setSelectedPresetMonths(3);
      else if (diffDays >= 178 && diffDays <= 185) setSelectedPresetMonths(6);
      else setSelectedPresetMonths(null);
    } else {
      setSelectedPresetMonths(null);
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!mentorId || !menteeId || !programTitle.trim() || !targetGoal.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin bắt buộc', 'warning');
      return;
    }
    if (dateValidation && !dateValidation.isValid) {
      toast?.show('Thời gian không hợp lệ', dateValidation.message, 'warning');
      return;
    }
    try {
      setSubmittingProgram(true);
      const payload = {
        mentorId: Number(mentorId),
        menteeId: Number(menteeId),
        focusSkillId: focusSkillId ? Number(focusSkillId) : null,
        programTitle: programTitle.trim(),
        targetGoal: targetGoal.trim(),
        startDate,
        endDate,
      };
      const res = await api.post(`/api/tech/mentorship/department/${departmentId}`, payload);
      if (res.data?.data) {
        toast?.show('Thành công', 'Đã khởi tạo chương trình kèm cặp 1-1', 'success');
        setIsCreateOpen(false);
        fetchPrograms();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể khởi tạo chương trình', 'error');
    } finally {
      setSubmittingProgram(false);
    }
  };

  // Open checkins modal
  const openCheckins = async (prog) => {
    setActiveProgForCheckin(prog);
    setIsAddingCheckin(false);
    try {
      setLoadingCheckins(true);
      const res = await api.get(`/api/tech/mentorship/programs/${prog.id}/checkins`);
      if (res.data?.data) {
        setCheckins(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải nhật ký checkin', 'error');
    } finally {
      setLoadingCheckins(false);
    }
  };

  const handleAddCheckin = async (e) => {
    e.preventDefault();
    if (!topicsCovered.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập nội dung ôn tập / trao đổi', 'warning');
      return;
    }
    try {
      setSubmittingCheckin(true);
      const payload = {
        checkinDate,
        topicsCovered: topicsCovered.trim(),
        progressRating: Number(progressRating),
        mentorFeedback: mentorFeedback.trim() || null,
        menteeNotes: menteeNotes.trim() || null,
      };
      const res = await api.post(
        `/api/tech/mentorship/programs/${activeProgForCheckin.id}/checkins`,
        payload
      );
      if (res.data?.data) {
        setCheckins((prev) => [res.data.data, ...prev]);
        toast?.show('Thành công', 'Đã ghi nhận buổi check-in kèm cặp', 'success');
        setIsAddingCheckin(false);
        setTopicsCovered('');
        setMentorFeedback('');
        setMenteeNotes('');
        fetchPrograms();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể lưu check-in', 'error');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const handleCompleteProgram = async (e) => {
    e.preventDefault();
    if (!completingProg) return;
    try {
      setSubmittingComplete(true);
      const res = await api.put(`/api/tech/mentorship/programs/${completingProg.id}`, {
        status: 'COMPLETED',
        finalAssessment: finalAssessment.trim() || null,
      });
      if (res.data?.data) {
        toast?.show('Chúc mừng!', 'Đã ghi nhận tốt nghiệp kèm cặp & cập nhật Dòng thời gian Sự nghiệp cho cả Mentor & Mentee', 'success');
        setCompletingProg(null);
        setFinalAssessment('');
        fetchPrograms();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể hoàn thành chương trình', 'error');
    } finally {
      setSubmittingComplete(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[#0F2557] rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <Users2 size={18} />
            </span>
            <h3 className="text-base font-bold text-white">Chương trình Kèm cặp Kỹ sư 1-1 (Engineering Mentorship)</h3>
          </div>
          <p className="text-xs text-blue-100/75 max-w-xl">
            Ghép cặp Senior/Expert dẫn dắt trực tiếp Junior bồi dưỡng lỗ hổng kỹ năng, ghi nhận buổi Check-in định kỳ và cấp chứng nhận Career Event khi tốt nghiệp.
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsMatcherOpen(true);
                setMatcherResults(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Sparkles size={14} className="text-amber-300" />
              <span>Smart Mentor Matcher</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMentorId('');
                setMenteeId('');
                setFocusSkillId('');
                setProgramTitle('');
                setTargetGoal('');
                const today = new Date();
                setStartDate(today.toISOString().substring(0, 10));
                const nextQ = new Date();
                nextQ.setMonth(today.getMonth() + 3);
                setEndDate(nextQ.toISOString().substring(0, 10));
                setSelectedPresetMonths(3);
                setCreateMatcherSuggestions(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#0F2557] hover:bg-blue-50 text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>Khởi tạo Kèm cặp 1-1</span>
            </button>
          </div>
        )}
      </div>

      {/* Program Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách chương trình kèm cặp...</div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <BookOpen size={36} className="mx-auto text-slate-300" />
          <h4 className="text-sm font-bold text-slate-800">Chưa có chương trình kèm cặp 1-1 nào</h4>
          <p className="text-xs text-slate-500">
            Sử dụng tính năng Smart Mentor Matcher để tìm kiếm Mentor phù hợp và khởi tạo lộ trình bồi dưỡng năng lực.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((prog) => {
            const statusConf = STATUS_CONFIG[prog.status] || STATUS_CONFIG.ACTIVE;
            return (
              <div
                key={prog.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-3 shadow-2xs hover:border-blue-300 transition flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.badge}`}>
                        {statusConf.label}
                      </span>

                      {prog.focusSkillName && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          {prog.focusSkillName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingProg(prog)}
                        title="Xem chi tiết chương trình"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>
                      {!isReadOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(prog)}
                            title="Chỉnh sửa chương trình"
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProg(prog)}
                            title="Xóa chương trình"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4
                      className="text-xs font-bold text-slate-900 line-clamp-1 hover:text-blue-700 cursor-pointer transition"
                      title={prog.programTitle}
                      onClick={() => setViewingProg(prog)}
                    >
                      {prog.programTitle}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5" title={prog.targetGoal}>
                      Mục tiêu: {prog.targetGoal}
                    </p>
                  </div>

                  {/* Mentor & Mentee Strip */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Mentor dẫn dắt:</span>
                      <strong
                        className="text-[#0F2557] hover:underline cursor-pointer"
                        onClick={() => onInspectEngineer && onInspectEngineer(prog.mentorId)}
                      >
                        {prog.mentorName || 'Chưa rõ'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Kỹ sư Kèm cặp:</span>
                      <strong
                        className="text-blue-700 hover:underline cursor-pointer"
                        onClick={() => onInspectEngineer && onInspectEngineer(prog.menteeId)}
                      >
                        {prog.menteeName || 'Chưa rõ'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 tabular text-slate-500">
                      <span>
                        Thời gian: {formatDateVN(prog.startDate)} → {formatDateVN(prog.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Rating & Check-ins Counter */}
                  <div className="flex items-center justify-between text-[11px] tabular pt-0.5">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <MessageSquare size={12} className="text-blue-600" />
                      <span>{prog.checkinCount || 0} buổi Check-in</span>
                    </span>

                    {prog.averageRating ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Star size={11} className="fill-amber-500 text-amber-500" />
                        <span>{prog.averageRating} / 5</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa đánh giá</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openCheckins(prog)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                  >
                    <span>Lịch sử Check-in</span>
                    <ChevronRight size={13} />
                  </button>

                  {!isReadOnly && prog.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompletingProg(prog);
                        setFinalAssessment('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded-lg transition cursor-pointer"
                    >
                      <Award size={12} />
                      <span>Tốt nghiệp</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Mentor Matcher Modal */}
      {isMatcherOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMatcherOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4.5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={18} className="text-amber-300" />
                  <div>
                    <h3 className="text-base font-bold text-white">Smart Mentor Matcher</h3>
                    <p className="text-xs text-blue-200/80">
                      Thuật toán tự động đề xuất Senior/Expert phù hợp nhất cho Mentee
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMatcherOpen(false)}
                  className="p-1.5 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Chọn Kỹ sư Mentee *
                    </label>
                    <select
                      value={matcherMenteeId}
                      onChange={(e) => setMatcherMenteeId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    >
                      <option value="">-- Chọn kỹ sư cần bồi dưỡng --</option>
                      {availableEngineers.map((emp) => (
                        <option key={emp.userId} value={emp.userId}>
                          {emp.hoTen} ({emp.maNhanVien || emp.chucVu})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Kỹ năng trọng tâm (tùy chọn)
                    </label>
                    <select
                      value={matcherSkillId}
                      onChange={(e) => setMatcherSkillId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    >
                      <option value="">-- Tất cả kỹ năng --</option>
                      {availableSkills.map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.skillName} ({sk.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={searchingMatcher}
                    onClick={handleRunSmartMatcher}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0F2557] hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={13} className="text-amber-300" />
                    <span>{searchingMatcher ? 'Đang phân tích...' : 'Tìm Mentor phù hợp'}</span>
                  </button>
                </div>

                {/* Matcher Results */}
                {matcherResults && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Mentee: <strong>{matcherResults.menteeName}</strong>
                      </span>
                      <span className="text-slate-500">
                        Trình độ hiện tại: <strong>{matcherResults.menteeLevel}</strong>
                      </span>
                    </div>

                    {matcherResults.suggestedMentors.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                        Không tìm thấy Mentor cấp Senior/Expert phù hợp cho tiêu chí này.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-600">
                          Top {matcherResults.suggestedMentors.length} Mentor được gợi ý tốt nhất:
                        </p>
                        {matcherResults.suggestedMentors.map((c) => (
                          <div
                            key={c.mentorId}
                            className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <strong className="text-xs text-slate-900">{c.mentorName}</strong>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                                  {c.mentorLevel}
                                </span>
                                <span className="text-[11px] text-slate-500 tabular">
                                  {c.yearsExperience} năm KN
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600">{c.recommendationReason}</p>
                              <p className="text-[10px] text-blue-700 font-semibold tabular">
                                Đang phụ trách: {c.activeMentorshipsCount} kèm cặp active
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePickSuggestedMentor(c)}
                              className="px-3 py-1.5 bg-[#0F2557] hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                            >
                              Chọn ghép cặp
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsMatcherOpen(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Khởi tạo Kèm cặp mới */}
      {isCreateOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submittingProgram) {
                setIsCreateOpen(false);
              }
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              onSubmit={handleCreateProgram}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users2 size={16} />
                    <span>Khởi tạo Chương trình Kèm cặp 1-1</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">Thiết lập cặp Mentor - Mentee và mục tiêu bồi dưỡng năng lực</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3.5 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Kỹ sư Mentee (Người được kèm cặp) *
                    </label>
                    <select
                      required
                      value={menteeId}
                      onChange={(e) => {
                        setMenteeId(e.target.value);
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="">-- Chọn Mentee --</option>
                      {availableEngineers.map((emp) => (
                        <option key={emp.userId} value={emp.userId}>
                          {emp.hoTen} ({emp.maNhanVien || emp.chucVu})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Kỹ năng trọng tâm (tùy chọn)
                    </label>
                    <select
                      value={focusSkillId}
                      onChange={(e) => setFocusSkillId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    >
                      <option value="">-- Tự động theo mục tiêu / Tổng quát --</option>
                      {availableSkills.map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.skillName} ({sk.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Mục tiêu Đào tạo Cụ thể (Mục tiêu kèm cặp) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={targetGoal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTargetGoal(val);
                      if (!focusSkillId && availableSkills.length > 0) {
                        const lower = val.toLowerCase();
                        const found = availableSkills.find((s) => lower.includes(s.skillName.toLowerCase()));
                        if (found) {
                          setFocusSkillId(found.id);
                        }
                      }
                    }}
                    placeholder="VD: Nâng cao năng lực thiết kế kiến trúc Backend Spring Boot & Microservices..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Khung Trợ lý AI Gợi ý Mentor Phù hợp (Smart Matcher) */}
                {menteeId && (
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                        <Sparkles size={14} className="text-amber-500 animate-pulse" />
                        <span>Trợ lý AI Gợi ý Mentor Phù hợp (Smart Matcher)</span>
                      </div>
                      {loadingCreateMatcher && (
                        <span className="text-[11px] text-blue-600 flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> Đang phân tích...
                        </span>
                      )}
                    </div>

                    {createMatcherSuggestions && createMatcherSuggestions.length > 0 ? (
                      <div className="space-y-2">
                        {createMatcherSuggestions.slice(0, 3).map((candidate, idx) => {
                          const isSelected = String(mentorId) === String(candidate.mentorId);
                          return (
                            <div
                              key={candidate.mentorId}
                              className={`p-2.5 rounded-lg border transition flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-blue-100/80 border-blue-400 ring-1 ring-blue-400'
                                  : 'bg-white border-blue-200/80 hover:border-blue-300'
                              }`}
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong className="text-xs text-slate-900">{candidate.mentorName}</strong>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                    {candidate.mentorLevel}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                                    <Star size={10} className="fill-amber-500 text-amber-500" />
                                    {idx === 0 ? '5.0/5.0 sao • Rất khuyến nghị' : '4.8/5.0 sao'}
                                  </span>
                                  {candidate.yearsExperience > 0 && (
                                    <span className="text-[11px] text-slate-500 tabular">
                                      {candidate.yearsExperience} năm KN
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 leading-snug">
                                  {candidate.recommendationReason}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setMentorId(candidate.mentorId);
                                  if (!programTitle) {
                                    setProgramTitle(
                                      `Lộ trình Kèm cặp 1-1: ${candidate.mentorName} kèm ${
                                        availableEngineers.find((e) => String(e.userId) === String(menteeId))?.hoTen || 'Kỹ sư'
                                      }`
                                    );
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#0F2557] hover:bg-blue-900 text-white'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckCircle2 size={12} />
                                    <span>Đã chọn</span>
                                  </>
                                ) : (
                                  <span>Chọn Mentor này</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : !loadingCreateMatcher ? (
                      <p className="text-xs text-slate-500 italic">
                        Chọn Kỹ sư Mentee hoặc nhập Mục tiêu kèm cặp để AI phân tích và tự động đề xuất Mentor cấp Senior/Expert phù hợp nhất.
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Mentor dẫn dắt *
                    </label>
                    <select
                      required
                      value={mentorId}
                      onChange={(e) => setMentorId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="">-- Chọn Mentor --</option>
                      {availableEngineers.map((emp) => (
                        <option key={emp.userId} value={emp.userId}>
                          {emp.hoTen} ({emp.maNhanVien || emp.chucVu})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tiêu đề Chương trình Kèm cặp *
                    </label>
                    <input
                      type="text"
                      required
                      value={programTitle}
                      onChange={(e) => setProgramTitle(e.target.value)}
                      placeholder="VD: Lộ trình Bồi dưỡng Nâng bậc Microservices Spring Boot"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Ngày bắt đầu *
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg outline-none font-medium transition ${
                          dateValidation && dateValidation.type === 'start_too_old'
                            ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20 text-rose-900'
                            : 'border-slate-200 focus:border-blue-500'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Tối đa 30 ngày hồi tố (chu kỳ báo cáo tháng) hoặc lập kế hoạch tương lai
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-600">
                          Ngày kết thúc dự kiến *
                        </label>
                      </div>
                      <input
                        type="date"
                        required
                        min={startDate || undefined}
                        max={maxEndDate || undefined}
                        value={endDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg outline-none font-medium transition ${
                          dateValidation && (dateValidation.type === 'negative' || dateValidation.type === 'same_day' || dateValidation.type === 'too_short' || dateValidation.type === 'too_long')
                            ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20 text-rose-900'
                            : 'border-slate-200 focus:border-blue-500'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Thời lượng từ 14 ngày đến tối đa 6 tháng
                      </span>
                    </div>
                  </div>

                  {/* Nút chọn nhanh thời lượng chuẩn */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-500 font-medium">Chọn nhanh thời lượng:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { months: 1, label: '+1 Tháng (Ngắn hạn)' },
                        { months: 3, label: '+3 Tháng (1 Quý • Chuẩn)' },
                        { months: 6, label: '+6 Tháng (Tối đa)' },
                      ].map((preset) => {
                        const isActive = selectedPresetMonths === preset.months;
                        return (
                          <button
                            key={preset.months}
                            type="button"
                            onClick={() => handleApplyDurationPreset(preset.months)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cảnh báo / Tóm tắt thời lượng */}
                  {dateValidation && (
                    <div
                      className={`p-2 rounded-lg text-xs flex items-center gap-2 transition ${
                        dateValidation.isValid
                          ? 'bg-blue-50/80 border border-blue-200 text-blue-900'
                          : 'bg-rose-50 border border-rose-200 text-rose-800'
                      }`}
                    >
                      {dateValidation.isValid ? (
                        <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                      ) : (
                        <AlertTriangle size={14} className="text-rose-600 shrink-0 animate-pulse" />
                      )}
                      <span className="text-[11px] font-medium leading-snug">{dateValidation.message}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingProgram || (dateValidation && !dateValidation.isValid)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingProgram ? 'Đang tạo...' : 'Tạo Chương trình'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Lịch sử Check-in & Ghi nhận Buổi mới */}
      {activeProgForCheckin &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveProgForCheckin(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] my-auto animate-in zoom-in-95 duration-150"
            >
            <div className="bg-[#0F2557] px-6 py-4.5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare size={16} />
                  <span>Nhật ký Check-in Kèm cặp: {activeProgForCheckin.programTitle}</span>
                </h3>
                <p className="text-xs text-blue-200/80">
                  Mentor: <strong>{activeProgForCheckin.mentorName}</strong> • Mentee: <strong>{activeProgForCheckin.menteeName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveProgForCheckin(null)}
                className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {!isReadOnly && !isAddingCheckin && activeProgForCheckin.status === 'ACTIVE' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAddingCheckin(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Ghi nhận Buổi Check-in mới</span>
                  </button>
                </div>
              )}

              {/* Add Checkin Form */}
              {isAddingCheckin && (
                <form
                  onSubmit={handleAddCheckin}
                  className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-900">Ghi nhận Buổi Trao đổi Định kỳ</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingCheckin(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Ngày họp / Check-in *
                      </label>
                      <input
                        type="date"
                        required
                        value={checkinDate}
                        onChange={(e) => setCheckinDate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Đánh giá tiến độ (1 - 5 sao) *
                      </label>
                      <select
                        value={progressRating}
                        onChange={(e) => setProgressRating(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold"
                      >
                        <option value="5">⭐⭐⭐⭐⭐ (5 sao - Vượt tiến độ)</option>
                        <option value="4">⭐⭐⭐⭐ (4 sao - Tốt, đúng kế hoạch)</option>
                        <option value="3">⭐⭐⭐ (3 sao - Trung bình, đạt yêu cầu)</option>
                        <option value="2">⭐⭐ (2 sao - Chậm tiến độ)</option>
                        <option value="1">⭐ (1 sao - Rất chậm, gặp vướng mắc)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Chủ đề ôn tập / Kiến thức trao đổi *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={topicsCovered}
                      onChange={(e) => setTopicsCovered(e.target.value)}
                      placeholder="VD: Review kiến trúc JPA/Hibernate, xử lý LazyLoading và N+1 query issue..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Nhận xét &amp; Định hướng của Mentor
                    </label>
                    <textarea
                      rows={2}
                      value={mentorFeedback}
                      onChange={(e) => setMentorFeedback(e.target.value)}
                      placeholder="Nhận xét của Mentor về mức độ tiếp thu và bài tập thực hành tiếp theo..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingCheckin(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCheckin}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {submittingCheckin ? 'Đang lưu...' : 'Lưu Check-in'}
                    </button>
                  </div>
                </form>
              )}

              {/* Checkins List */}
              {loadingCheckins ? (
                <div className="py-8 text-center text-xs text-slate-400">Đang tải lịch sử checkin...</div>
              ) : checkins.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Chưa có buổi check-in nào được ghi nhận.</div>
              ) : (
                <div className="space-y-3">
                  {checkins.map((chk) => (
                    <div
                      key={chk.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            Ngày {formatDateVN(chk.checkinDate)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{chk.progressRating} / 5</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 tabular">
                          Ghi nhận bởi {chk.loggedByName || 'Kỹ sư'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800">{chk.topicsCovered}</p>
                        {chk.mentorFeedback && (
                          <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100 text-[11px] text-blue-950">
                            <strong>Nhận xét Mentor:</strong> {chk.mentorFeedback}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveProgForCheckin(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Tốt nghiệp Mentorship */}
      {completingProg &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submittingComplete) {
                setCompletingProg(null);
              }
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              onSubmit={handleCompleteProgram}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award size={16} className="text-amber-400" />
                  <span>Nghiệm thu Tốt nghiệp Kèm cặp</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setCompletingProg(null)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs text-slate-600">
                  Xác nhận hoàn thành chương trình kèm cặp <strong>{completingProg.programTitle}</strong>.
                  Hệ thống sẽ tự động cập nhật một sự kiện Career Event <strong>MENTORSHIP_COMPLETED</strong> vào hồ sơ sự nghiệp của cả Mentor ({completingProg.mentorName}) và Mentee ({completingProg.menteeName}).
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Đánh giá Tổng kết Tốt nghiệp *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={finalAssessment}
                    onChange={(e) => setFinalAssessment(e.target.value)}
                    placeholder="Kỹ sư đã hoàn thành xuất sắc các bài tập thực hành, tự tin triển khai độc lập các tính năng phức tạp..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingProg(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingComplete ? 'Đang lưu...' : 'Xác nhận Tốt nghiệp'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Xem Chi tiết Chương trình Kèm cặp */}
      {viewingProg &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingProg(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users2 size={16} />
                    <span>Chi tiết Chương trình Kèm cặp 1-1</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">Lộ trình đào tạo, cặp ghép nối và đánh giá tiến độ</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingProg(null)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[viewingProg.status]?.badge || ''}`}>
                    {STATUS_CONFIG[viewingProg.status]?.label || viewingProg.status}
                  </span>
                  {viewingProg.focusSkillName && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                      🎯 Kỹ năng: {viewingProg.focusSkillName}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{viewingProg.programTitle}</h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <strong className="block text-slate-500 text-[11px] mb-0.5">Mục tiêu Đào tạo cụ thể:</strong>
                    {viewingProg.targetGoal}
                  </div>
                </div>

                {/* Grid Mentor & Mentee */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Mentor Dẫn dắt</span>
                    <strong
                      className="text-xs text-slate-900 block hover:text-blue-700 hover:underline cursor-pointer"
                      onClick={() => onInspectEngineer && onInspectEngineer(viewingProg.mentorId)}
                    >
                      {viewingProg.mentorName}
                    </strong>
                    <span className="text-[11px] text-slate-500 block">{viewingProg.mentorEmail || 'Chưa có email'}</span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Kỹ sư Kèm cặp (Mentee)</span>
                    <strong
                      className="text-xs text-slate-900 block hover:text-emerald-700 hover:underline cursor-pointer"
                      onClick={() => onInspectEngineer && onInspectEngineer(viewingProg.menteeId)}
                    >
                      {viewingProg.menteeName}
                    </strong>
                    <span className="text-[11px] text-slate-500 block">{viewingProg.menteeEmail || 'Chưa có email'}</span>
                  </div>
                </div>

                {/* Timeline & Stats */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs tabular">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Thời gian triển khai:</span>
                    <strong className="text-slate-800">
                      {formatDateVN(viewingProg.startDate)} → {formatDateVN(viewingProg.endDate)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tiến độ Check-in:</span>
                    <strong className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <span>{viewingProg.checkinCount || 0} buổi</span>
                      {viewingProg.averageRating ? (
                        <span className="text-amber-600 flex items-center gap-0.5 text-[11px] font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          <Star size={10} className="fill-amber-500 text-amber-500" />
                          {viewingProg.averageRating} / 5
                        </span>
                      ) : null}
                    </strong>
                  </div>
                </div>

                {/* Final assessment if completed */}
                {viewingProg.finalAssessment && (
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1 text-xs">
                    <strong className="text-emerald-800 font-bold flex items-center gap-1 text-[11px]">
                      <Award size={13} className="text-emerald-600" />
                      <span>Đánh giá Tốt nghiệp Kèm cặp:</span>
                    </strong>
                    <p className="text-slate-700 leading-relaxed italic">{viewingProg.finalAssessment}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    const p = viewingProg;
                    setViewingProg(null);
                    openCheckins(p);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <MessageSquare size={13} />
                  <span>Xem Lịch sử Check-in</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const p = viewingProg;
                        setViewingProg(null);
                        openEditModal(p);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Pencil size={12} />
                      <span>Sửa</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingProg(null)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Chỉnh sửa Chương trình Kèm cặp */}
      {editingProg &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submittingEdit) setEditingProg(null);
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              onSubmit={handleUpdateProgram}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Pencil size={16} />
                    <span>Chỉnh sửa Chương trình Kèm cặp 1-1</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">Cập nhật tiêu đề, mục tiêu, kỹ năng hoặc gia hạn ngày kết thúc</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProg(null)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3.5 flex-1 overflow-y-auto">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Tiêu đề Chương trình Kèm cặp *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Mục tiêu Đào tạo Cụ thể *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editGoal}
                    onChange={(e) => setEditGoal(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Kỹ năng trọng tâm
                    </label>
                    <select
                      value={editFocusSkillId}
                      onChange={(e) => setEditFocusSkillId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    >
                      <option value="">-- Tự động / Tổng quát --</option>
                      {availableSkills.map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.skillName} ({sk.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Trạng thái
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="ACTIVE">Đang kèm cặp</option>
                      <option value="CANCELLED">Đã kết thúc sớm</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Ngày bắt đầu (cố định)
                    </label>
                    <input
                      type="date"
                      disabled
                      value={editingProg.startDate || ''}
                      className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Ngày kết thúc dự kiến *
                    </label>
                    <input
                      type="date"
                      required
                      min={editingProg.startDate}
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Tối đa 6 tháng kể từ ngày bắt đầu
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProg(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Xác nhận Xóa Chương trình Kèm cặp */}
      {deletingProg &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submittingDelete) setDeletingProg(null);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-rose-100 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150"
            >
              <div className="p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Xác nhận Xóa Chương trình Kèm cặp</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Bạn có chắc chắn muốn xóa chương trình kèm cặp{' '}
                    <strong className="text-slate-800 font-bold">"{deletingProg.programTitle}"</strong>{' '}
                    giữa Mentor <strong className="text-slate-800">{deletingProg.mentorName}</strong> và Mentee{' '}
                    <strong className="text-slate-800">{deletingProg.menteeName}</strong>?
                  </p>
                  <p className="text-[11px] text-rose-600 font-medium mt-2 bg-rose-50 p-2 rounded-lg border border-rose-200/80">
                    ⚠️ Hành động này sẽ xóa vĩnh viễn chương trình cùng toàn bộ {deletingProg.checkinCount || 0} buổi check-in liên quan và không thể hoàn tác.
                  </p>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingProg(null)}
                  disabled={submittingDelete}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProgram}
                  disabled={submittingDelete}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingDelete && <Loader2 size={13} className="animate-spin" />}
                  <span>{submittingDelete ? 'Đang xóa...' : 'Xác nhận Xóa'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
