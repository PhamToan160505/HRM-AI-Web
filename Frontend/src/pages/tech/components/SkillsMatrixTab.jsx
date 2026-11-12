import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserCheck,
  UserPlus,
  RotateCcw,
  Check,
  ShieldCheck,
  Cpu,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import TechRadarChart from './TechRadarChart';
import {
  PROFICIENCY_CONFIG,
  RADAR_DIMENSIONS,
  sortSkillsByLevel,
  scrollElementIntoViewCleanly,
} from '../techHelpers';

function TechCoverageTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white p-3 rounded-xl shadow-xl border border-blue-800/80 text-xs space-y-1">
      <p className="font-bold text-white">{d.skillName}</p>
      <div className="space-y-0.5 text-[11px] tabular">
        <p className="text-blue-200">
          Đã xác thực: <strong className="text-white">{d.verified} kỹ sư</strong>
        </p>
        <p className="text-slate-300">
          Chờ duyệt: <strong className="text-white">{d.unverified} kỹ sư</strong>
        </p>
        <p className="text-emerald-300 pt-0.5 border-t border-blue-800/80">
          Tổng nhân sự biết: <strong>{d.total} người</strong>
        </p>
      </div>
    </div>
  );
}

export default function SkillsMatrixTab({
  matrixData = [],
  availableSkills = [],
  isReadOnly = false,
  onInspectEngineer,
  onOpenProjectSelect,
  onVerifySkill,
  verifyingId = null,
  focusUserRequest = null,
  onFocusHandled,
}) {
  const toast = useToast();

  // Smart Skill Matcher State
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [minLevel, setMinLevel] = useState('MIDDLE');
  const [benchOnly, setBenchOnly] = useState(false);
  const [strictLevel, setStrictLevel] = useState(false);
  const [matchResults, setMatchResults] = useState(null);
  const [matching, setMatching] = useState(false);

  // Matrix Directory Filter State
  const [matrixKeyword, setMatrixKeyword] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'all' | 'pending' | 'verified'
  const [benchOnlyView, setBenchOnlyView] = useState(false);
  const [highlightState, setHighlightState] = useState(null);
  const highlightedUserId = highlightState?.id || null;
  const directoryRef = useRef(null);
  const lastAppliedFocusRef = useRef(0);
  const lastScrolledFocusRef = useRef(0);

  useEffect(() => {
    const reqAt = focusUserRequest?.requestedAt;
    if (!reqAt || reqAt === lastAppliedFocusRef.current) return;
    lastAppliedFocusRef.current = reqAt;
    setMatrixKeyword('');
    setBenchOnlyView(false);
    setVerificationFilter(focusUserRequest.userId ? 'all' : 'pending');
  }, [focusUserRequest]);

  // Compute Department Average 6-Axis Radar & Tech Coverage
  const capabilitySummary = useMemo(() => {
    const count = matrixData.length;
    const avgScores = {};
    RADAR_DIMENSIONS.forEach((dim) => {
      if (count === 0) {
        avgScores[dim.key] = 0;
      } else {
        const sum = matrixData.reduce((acc, p) => acc + (p.radarScores?.[dim.key] || 0), 0);
        avgScores[dim.key] = Math.round(sum / count);
      }
    });

    let totalSkills = 0;
    let verifiedSkills = 0;
    let pendingSkills = 0;
    const skillAgg = {};

    matrixData.forEach((profile) => {
      const skillsList = profile.skills || [];
      totalSkills += profile.totalSkills || skillsList.length || 0;
      verifiedSkills += profile.verifiedSkills || 0;
      skillsList.forEach((s) => {
        if (!s.isVerified) pendingSkills += 1;
        const name = s.skillName;
        if (!name) return;
        if (!skillAgg[name]) {
          skillAgg[name] = { skillName: name, verified: 0, unverified: 0, total: 0 };
        }
        skillAgg[name].total += 1;
        if (s.isVerified) skillAgg[name].verified += 1;
        else skillAgg[name].unverified += 1;
      });
    });

    const topTechStack = Object.values(skillAgg)
      .sort((a, b) => b.total - a.total || b.verified - a.verified)
      .slice(0, 7);

    const verificationRate = totalSkills > 0 ? Math.round((verifiedSkills / totalSkills) * 100) : 0;

    const rankedDims = [...RADAR_DIMENSIONS]
      .map((d) => ({ ...d, score: avgScores[d.key] || 0 }))
      .sort((a, b) => b.score - a.score);

    return {
      avgScores,
      totalSkills,
      verifiedSkills,
      pendingSkills,
      verificationRate,
      topTechStack,
      strongestDim: rankedDims[0],
      weakestDim: rankedDims[rankedDims.length - 1],
    };
  }, [matrixData]);

  const handleRunMatcher = async (e) => {
    e.preventDefault();
    if (selectedSkillIds.length === 0) {
      toast.show('Thông báo', 'Vui lòng chọn ít nhất 1 kỹ năng để ghép nối', 'info');
      return;
    }

    try {
      setMatching(true);
      const res = await api.post('/api/tech/skills/match', {
        skillIds: selectedSkillIds,
        minProficiencyLevel: minLevel,
        benchOnly,
        strictLevel,
      });
      if (res.data?.data) {
        setMatchResults(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể tìm kiếm kỹ sư ghép nối', 'error');
    } finally {
      setMatching(false);
    }
  };

  const handleResetMatcher = () => {
    setSelectedSkillIds([]);
    setMinLevel('MIDDLE');
    setBenchOnly(false);
    setStrictLevel(false);
    setMatchResults(null);
  };

  const filteredMatrix = useMemo(() => {
    const kw = matrixKeyword.trim().toLowerCase();
    return matrixData.filter((profile) => {
      if (benchOnlyView && (profile.availableCapacity || 0) <= 0) return false;
      if (verificationFilter === 'pending') {
        const hasPending = (profile.skills || []).some((s) => !s.isVerified);
        if (!hasPending) return false;
      }
      if (kw) {
        const matchName = profile.hoTen?.toLowerCase().includes(kw);
        const matchCode = profile.maNhanVien?.toLowerCase().includes(kw);
        const matchRole = profile.chucVu?.toLowerCase().includes(kw);
        const matchSkill = (profile.skills || []).some((s) =>
          s.skillName?.toLowerCase().includes(kw)
        );
        if (!matchName && !matchCode && !matchRole && !matchSkill) return false;
      }
      return true;
    });
  }, [matrixData, matrixKeyword, benchOnlyView, verificationFilter]);

  const matchedUserId = useMemo(() => {
    if (!focusUserRequest?.requestedAt) return null;
    if (focusUserRequest.userId) {
      const found = filteredMatrix.find((p) => String(p.userId) === String(focusUserRequest.userId));
      return found ? String(found.userId) : null;
    }
    const firstPending = filteredMatrix.find((p) => (p.skills || []).some((s) => !s.isVerified));
    return firstPending ? String(firstPending.userId) : filteredMatrix[0] ? String(filteredMatrix[0].userId) : null;
  }, [focusUserRequest, filteredMatrix]);

  useEffect(() => {
    const reqAt = focusUserRequest?.requestedAt;
    if (!reqAt || lastScrolledFocusRef.current === reqAt) return;

    if (focusUserRequest.userId && !matchedUserId) {
      const waitTimer = setTimeout(() => {
        if (lastScrolledFocusRef.current !== reqAt && directoryRef.current) {
          lastScrolledFocusRef.current = reqAt;
          scrollElementIntoViewCleanly(directoryRef.current, 'start');
          if (onFocusHandled) onFocusHandled(reqAt);
        }
      }, 2200);
      return () => clearTimeout(waitTimer);
    }

    const targetUid = matchedUserId;
    let initialTimer = null;
    let retryTimer = null;
    let realignTimer = null;

    const attemptScroll = (retryCount = 0) => {
      const targetEl = targetUid ? document.getElementById(`tech-skill-row-${targetUid}`) : null;
      const anchorEl = targetEl || directoryRef.current;
      if (!anchorEl || (targetUid && !targetEl && retryCount < 6)) {
        if (retryCount < 6) {
          retryTimer = setTimeout(() => attemptScroll(retryCount + 1), 100);
        }
        return;
      }

      lastScrolledFocusRef.current = reqAt;
      if (targetUid) {
        setHighlightState({ id: targetUid, at: reqAt });
      }
      scrollElementIntoViewCleanly(anchorEl, targetEl ? 'center' : 'start');
      if (onFocusHandled) {
        onFocusHandled(reqAt);
      }

      realignTimer = setTimeout(() => {
        const freshTargetEl = targetUid ? document.getElementById(`tech-skill-row-${targetUid}`) : null;
        const freshAnchor = freshTargetEl || directoryRef.current;
        if (freshAnchor) {
          scrollElementIntoViewCleanly(freshAnchor, freshTargetEl ? 'center' : 'start');
        }
      }, 320);
    };

    initialTimer = setTimeout(() => attemptScroll(0), 180);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (realignTimer) clearTimeout(realignTimer);
    };
  }, [focusUserRequest, matchedUserId, onFocusHandled]);

  useEffect(() => {
    if (!highlightState?.id) return;
    const clearTimer = setTimeout(() => {
      setHighlightState((prev) => (prev && prev.at === highlightState.at ? null : prev));
    }, 5000);
    return () => clearTimeout(clearTimer);
  }, [highlightState]);

  return (
    <div className="space-y-5">
      {/* 1. Department Capability Analytics Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Average 6-Axis Department Radar */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bản đồ Năng lực 6 Chiều Toàn Phòng</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Điểm năng lực trung bình theo chuyên môn của {matrixData.length} kỹ sư
              </p>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full whitespace-nowrap tabular">
              {capabilitySummary.verificationRate}% đã xác thực
            </span>
          </div>

          <div className="flex items-center justify-center py-1">
            <TechRadarChart scores={capabilitySummary.avgScores} size={255} />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
              <span className="text-[10px] font-semibold text-blue-700 block">Mũi nhọn nổi bật</span>
              <p className="font-bold text-slate-900 mt-0.5 tabular">
                {capabilitySummary.strongestDim?.label || 'N/A'} ({capabilitySummary.strongestDim?.score || 0}đ)
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-500 block">Trụ cột cần bồi đắp</span>
              <p className="font-bold text-slate-900 mt-0.5 tabular">
                {capabilitySummary.weakestDim?.label || 'N/A'} ({capabilitySummary.weakestDim?.score || 0}đ)
              </p>
            </div>
          </div>
        </div>

        {/* Right: Top Core Tech Stack Coverage Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Độ phủ Công nghệ Nòng cốt &amp; Xác thực</h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular">
                Phân bổ kỹ sư sở hữu công nghệ chủ chốt ({capabilitySummary.verifiedSkills}/{capabilitySummary.totalSkills} đã duyệt
                {capabilitySummary.pendingSkills > 0 && ` • ${capabilitySummary.pendingSkills} kỹ năng chờ duyệt`})
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Đã xác thực
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" /> Chờ duyệt
              </span>
            </div>
          </div>

          {capabilitySummary.topTechStack.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Chưa có dữ liệu kỹ năng được khai báo.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={capabilitySummary.topTechStack}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                  barSize={18}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="skillName"
                    width={130}
                    tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<TechCoverageTooltip />} cursor={{ fill: '#EFF6FF' }} />
                  <Bar dataKey="verified" stackId="stack" fill="#2563EB" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unverified" stackId="stack" fill="#CBD5E1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 2. Smart Skill Matcher — Crisp Deep Sapphire Architectural Panel */}
      <div className="bg-[#0F2557] rounded-2xl border border-blue-900/80 shadow-[0_8px_28px_-6px_rgba(15,37,87,0.3)] text-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Smart Skill Matcher — Kiểm tra &amp; Ghép nối Kỹ sư
              </h3>
              <p className="text-xs text-blue-100/75 mt-0.5">
                Lọc nhanh kỹ sư đáp ứng Tech Stack, kiểm tra tải công việc và điều phối trực tiếp vào dự án phù hợp
              </p>
            </div>
          </div>

          {matchResults && (
            <button
              type="button"
              onClick={handleResetMatcher}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-blue-100 transition cursor-pointer shrink-0"
            >
              <RotateCcw size={13} />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        <form onSubmit={handleRunMatcher} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Skill Multi-select */}
            <div className="md:col-span-6 space-y-1.5">
              <label className="text-[11px] font-semibold text-blue-100/90 block">
                Chọn công nghệ yêu cầu ({selectedSkillIds.length} đã chọn)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-950/35 border border-white/10 rounded-xl max-h-28 overflow-y-auto">
                {availableSkills.map((skill) => {
                  const isSelected = selectedSkillIds.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => {
                        setSelectedSkillIds((prev) =>
                          isSelected ? prev.filter((id) => id !== skill.id) : [...prev, skill.id]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border border-blue-400'
                          : 'bg-white/10 text-blue-100 hover:bg-white/20 border border-transparent'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      <span>{skill.skillName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level & options */}
            <div className="md:col-span-3 space-y-2">
              <label className="text-[11px] font-semibold text-blue-100/90 block">
                Cấp độ chuyên môn kỳ vọng
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <option value="FRESHER" className="bg-slate-900 text-white">Fresher trở lên</option>
                <option value="JUNIOR" className="bg-slate-900 text-white">Junior trở lên</option>
                <option value="MIDDLE" className="bg-slate-900 text-white">Middle trở lên (Khuyên dùng)</option>
                <option value="SENIOR" className="bg-slate-900 text-white">Senior trở lên</option>
                <option value="EXPERT" className="bg-slate-900 text-white">Expert (Chuyên gia)</option>
              </select>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-100/90 select-none">
                  <input
                    type="checkbox"
                    checked={strictLevel}
                    onChange={(e) => setStrictLevel(e.target.checked)}
                    className="rounded border-white/30 text-blue-500 focus:ring-blue-400"
                  />
                  <span className={strictLevel ? 'font-bold text-white' : ''}>Lọc nghiêm ngặt cấp bậc</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-100/90 select-none">
                  <input
                    type="checkbox"
                    checked={benchOnly}
                    onChange={(e) => setBenchOnly(e.target.checked)}
                    className="rounded border-white/30 text-blue-500 focus:ring-blue-400"
                  />
                  <span>Chỉ xét nhân sự còn dung lượng trống</span>
                </label>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="md:col-span-3 flex flex-col justify-end gap-1.5">
              {selectedSkillIds.length === 0 && (
                <p className="text-[11px] text-blue-200/75 text-center md:text-left">
                  Chọn ít nhất 1 công nghệ bên trái để tìm kiếm
                </p>
              )}
              <button
                type="submit"
                disabled={matching || selectedSkillIds.length === 0}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white rounded-xl text-xs font-bold border border-blue-400/30 transition disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search size={15} />
                <span>{matching ? 'Đang tìm kiếm...' : 'Tìm kỹ sư phù hợp'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Match Results */}
        {matchResults && (
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-blue-100/80 tabular">
              <span>
                Phát hiện <strong className="text-white">{matchResults.length} kỹ sư</strong> đáp ứng cấu hình công nghệ đã chọn:
              </span>
            </div>

            {matchResults.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-blue-100/75">
                Hiện chưa có kỹ sư nào đáp ứng đầy đủ tổ hợp tiêu chí này. Hãy thử hạ cấp bậc hoặc mở rộng ra toàn phòng.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchResults.map((candidate) => (
                  <div
                    key={candidate.userId}
                    className="p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {candidate.hoTen ? candidate.hoTen.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{candidate.hoTen}</p>
                            <p className="text-[11px] text-blue-100/75 truncate">{candidate.chucVu}</p>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-300/30 text-blue-100 font-bold text-[11px] whitespace-nowrap shrink-0 tabular">
                          {candidate.matchScore}% Khớp
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-0.5 tabular">
                        <span className="text-blue-100/70">Công suất sẵn sàng:</span>
                        <span
                          className={`font-bold ${
                            candidate.availableCapacity > 0 ? 'text-emerald-300' : 'text-blue-200/80'
                          }`}
                        >
                          {candidate.availableCapacity > 0 ? `Rảnh ${candidate.availableCapacity}%` : 'Full 100%'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {sortSkillsByLevel(candidate.matchedSkills || []).map((ms) => {
                          const conf = PROFICIENCY_CONFIG[ms.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                          return (
                            <span
                              key={ms.id}
                              className={`px-2 py-0.5 rounded-md text-[10px] border inline-flex items-center gap-1 whitespace-nowrap ${conf.bg}`}
                            >
                              <span>{ms.skillName}</span>
                              <span className="opacity-75">({conf.label})</span>
                              {ms.isVerified && (
                                <CheckCircle2
                                  size={10}
                                  className={conf.isDark ? 'text-blue-300 shrink-0' : 'text-blue-600 shrink-0'}
                                />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className={`grid ${isReadOnly ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pt-2 border-t border-white/10`}>
                      <button
                        type="button"
                        onClick={() => onInspectEngineer && onInspectEngineer(candidate.userId)}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <UserCheck size={13} className="text-blue-200 shrink-0" />
                        <span>Tech Profile</span>
                      </button>

                      {!isReadOnly && onOpenProjectSelect && (
                        <button
                          type="button"
                          onClick={() => onOpenProjectSelect(candidate)}
                          className="py-2 px-3 rounded-xl bg-white text-[#0F2557] hover:bg-blue-50 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus size={13} className="shrink-0" />
                          <span>Phân bổ</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Department Engineer Skills Directory */}
      <div
        ref={directoryRef}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/40">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ma trận Kỹ năng Đội ngũ Kỹ sư ({filteredMatrix.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi trình độ chuyên môn (Fresher → Expert), số năm kinh nghiệm và xác thực năng lực kỹ sư
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium mr-1">Cấp bậc:</span>
            {Object.entries(PROFICIENCY_CONFIG).map(([key, conf]) => (
              <span key={key} className={`px-2.5 py-0.5 rounded-lg text-[10px] border whitespace-nowrap ${conf.bg}`}>
                {conf.label}
              </span>
            ))}
          </div>
        </div>

        {/* Directory Search & Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={matrixKeyword}
              onChange={(e) => setMatrixKeyword(e.target.value)}
              placeholder="Tìm kỹ sư, mã NV hoặc công nghệ..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            {matrixKeyword && (
              <button
                type="button"
                onClick={() => setMatrixKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setVerificationFilter((v) => (v === 'pending' ? 'all' : 'pending'))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 tabular ${
                  verificationFilter === 'pending'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                }`}
              >
                <Clock size={13} />
                <span>Chờ duyệt xác thực ({capabilitySummary.pendingSkills})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setVerificationFilter((v) => (v === 'verified' ? 'all' : 'verified'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                verificationFilter === 'verified'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Chỉ hiện kỹ năng đã duyệt</span>
            </button>

            <button
              type="button"
              onClick={() => setBenchOnlyView((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                benchOnlyView
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <Clock size={13} />
              <span>Chỉ kỹ sư còn trống Bench</span>
            </button>
          </div>
        </div>

        {/* Directory List */}
        {filteredMatrix.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Không tìm thấy kỹ sư nào khớp với tiêu chí lọc.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMatrix.map((profile) => {
              const rawSkills = profile.skills || [];
              const filteredSkills =
                verificationFilter === 'verified'
                  ? rawSkills.filter((s) => s.isVerified)
                  : verificationFilter === 'pending'
                  ? rawSkills.filter((s) => !s.isVerified)
                  : rawSkills;
              const displayedSkills = sortSkillsByLevel(filteredSkills);

              return (
                <div
                  key={profile.userId}
                  id={`tech-skill-row-${profile.userId}`}
                  className={`p-5 transition-colors duration-500 space-y-3 ${
                    highlightedUserId === String(profile.userId)
                      ? 'bg-blue-50/90 ring-2 ring-inset ring-blue-500'
                      : 'hover:bg-blue-50/25'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#1E3A8A] text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {profile.hoTen ? profile.hoTen.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{profile.hoTen}</span>
                          {profile.maNhanVien && (
                            <span className="text-[11px] font-mono text-slate-400 tabular">({profile.maNhanVien})</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {profile.chucVu || 'Kỹ sư phần mềm'} • {profile.departmentName || 'Công nghệ'}
                        </p>
                      </div>
                    </div>

                    {/* Metrics & Actions */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-left sm:text-right tabular">
                        <p className="text-[11px] text-slate-400 font-medium">Tải công việc</p>
                        <p
                          className={`text-xs font-bold ${
                            profile.totalAllocation > 100
                              ? 'text-rose-600'
                              : profile.availableCapacity > 0
                              ? 'text-emerald-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {profile.totalAllocation}% (
                          {profile.availableCapacity > 0 ? `Rảnh ${profile.availableCapacity}%` : 'Full tải'})
                        </p>
                      </div>

                      <div className="text-left sm:text-right sm:pl-4 sm:border-l sm:border-slate-200 tabular">
                        <p className="text-[11px] text-slate-400 font-medium">Kỹ năng / Đã duyệt</p>
                        <p className="text-xs font-bold text-blue-700 whitespace-nowrap">
                          {profile.totalSkills} kỹ năng • {profile.verifiedSkills} đã duyệt
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onInspectEngineer && onInspectEngineer(profile.userId)}
                        className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <span>Tech Profile</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Skill Badges with inline Duyệt action */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {displayedSkills.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">
                        {verificationFilter === 'verified'
                          ? 'Chưa có kỹ năng nào được xác thực.'
                          : 'Chưa khai báo kỹ năng nào.'}
                      </span>
                    ) : (
                      displayedSkills.map((skill) => {
                        const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                        return (
                          <div
                            key={skill.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border ${conf.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dot}`} />
                            <span className="font-semibold whitespace-nowrap">{skill.skillName}</span>
                            <span className="text-[10px] opacity-80 whitespace-nowrap tabular">
                              ({conf.label} • {skill.yearsOfExperience}n)
                            </span>

                            {skill.isVerified ? (
                              <span
                                title={`Đã xác thực bởi ${skill.verifierName || 'Quản lý'}`}
                                className="inline-flex items-center shrink-0"
                              >
                                <CheckCircle2
                                  size={13}
                                  className={conf.isDark ? 'text-blue-300' : 'text-blue-600'}
                                />
                              </span>
                            ) : isReadOnly || !onVerifySkill ? (
                              <span title="Chờ Trưởng phòng / Giám đốc Công nghệ duyệt" className="inline-flex items-center shrink-0">
                                <Clock size={12} className="text-slate-400" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onVerifySkill(skill.id, profile.hoTen, skill.skillName)}
                                disabled={verifyingId === skill.id}
                                className="ml-1 px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                                title="Bấm để cấp tích xanh xác thực kỹ năng này"
                              >
                                {verifyingId === skill.id ? '...' : 'Duyệt'}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
