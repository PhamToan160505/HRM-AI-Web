import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  UserCheck,
  Zap,
  ShieldCheck,
  X,
  ExternalLink,
  Sliders,
  Check,
  RotateCcw,
  UserPlus,
  FolderGit2,
  Briefcase,
  Info
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import TechRadarChart from './TechRadarChart';

const PROFICIENCY_CONFIG = {
  FRESHER: { label: 'Fresher', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  JUNIOR: { label: 'Junior', bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  MIDDLE: { label: 'Middle', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  SENIOR: { label: 'Senior', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold', dot: 'bg-amber-500' },
  EXPERT: { label: 'Expert', bg: 'bg-purple-50 text-purple-800 border-purple-300 font-bold', dot: 'bg-purple-600' },
};

export const LEVEL_ORDER = {
  FRESHER: 0,
  JUNIOR: 1,
  MIDDLE: 2,
  SENIOR: 3,
  EXPERT: 4,
};

export const sortSkillsByLevel = (skills = []) => {
  return [...skills].sort((a, b) => {
    const orderA = LEVEL_ORDER[a.proficiencyLevel] ?? 99;
    const orderB = LEVEL_ORDER[b.proficiencyLevel] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    const yA = a.yearsOfExperience ?? 0;
    const yB = b.yearsOfExperience ?? 0;
    if (yA !== yB) return yA - yB;
    return (a.skillName || '').localeCompare(b.skillName || '');
  });
};

export default function SkillsMatrixTab({ projects = [], isReadOnly = false, onOpenStaffingModal, onRefreshData }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [matrixData, setMatrixData] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);

  // Bộ lọc Matcher
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [minLevel, setMinLevel] = useState('MIDDLE');
  const [benchOnly, setBenchOnly] = useState(false);
  const [strictLevel, setStrictLevel] = useState(false);
  const [matchResults, setMatchResults] = useState(null);
  const [matching, setMatching] = useState(false);

  // Modal xem chi tiết hồ sơ kỹ sư
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal Chọn Dự án Phân bổ
  const [projectList, setProjectList] = useState(projects || []);
  const [staffingCandidate, setStaffingCandidate] = useState(null);
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const [projectSearchKeyword, setProjectSearchKeyword] = useState('');

  // State xác thực kỹ năng
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    fetchMatrix();
    fetchSkills();
  }, []);

  useEffect(() => {
    if (selectedProfile || isProjectSelectOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [selectedProfile, isProjectSelectOpen]);

  useEffect(() => {
    if (projects && projects.length > 0) {
      setProjectList(projects);
    } else {
      fetchProjects();
    }
  }, [projects]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/tech/projects');
      if (res.data?.data) {
        setProjectList(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech/skills/matrix');
      if (res.data?.data) {
        setMatrixData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể tải ma trận kỹ năng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await api.get('/api/tech/skills');
      if (res.data?.data) {
        setAvailableSkills(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Xử lý xác thực kỹ năng
  const handleVerifySkill = async (skillRecordId, engineerName, skillName) => {
    try {
      setVerifyingId(skillRecordId);
      await api.put(`/api/tech/skills/${skillRecordId}/verify`);
      toast.show('Thành công', `Đã xác thực kỹ năng "${skillName}" cho ${engineerName}!`, 'success');
      // Cập nhật lại ma trận và profile đang mở
      await fetchMatrix();
      if (selectedProfile) {
        const detailRes = await api.get(`/api/tech/skills/profile/${selectedProfile.userId}`);
        if (detailRes.data?.data) setSelectedProfile(detailRes.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Thất bại', err.response?.data?.message || 'Không thể xác thực kỹ năng', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // Mở modal xem hồ sơ chi tiết
  const handleViewDetail = async (userId) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`/api/tech/skills/profile/${userId}`);
      if (res.data?.data) {
        setSelectedProfile(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể tải chi tiết hồ sơ', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Thực hiện tìm kiếm & ghép nối
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
        benchOnly: benchOnly,
        strictLevel: strictLevel,
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

  // Mở modal chọn dự án phân bổ
  const handleOpenProjectSelect = (candidateOrProfile) => {
    const candidateData = {
      userId: candidateOrProfile.userId || candidateOrProfile.id,
      hoTen: candidateOrProfile.hoTen,
      chucVu: candidateOrProfile.chucVu,
      availableCapacity: candidateOrProfile.availableCapacity !== undefined
        ? candidateOrProfile.availableCapacity
        : (candidateOrProfile.radarScores ? 100 : 0),
      skills: candidateOrProfile.allSkills || candidateOrProfile.skills || candidateOrProfile.matchedSkills || [],
    };
    setStaffingCandidate(candidateData);
    setProjectSearchKeyword('');
    setIsProjectSelectOpen(true);
    // Luôn làm mới ngầm danh sách dự án để đảm bảo danh sách thành viên mới nhất
    api.get('/api/tech/projects').then(res => {
      if (res.data?.data) {
        setProjectList(res.data.data);
      }
    }).catch(console.error);
  };

  // Chọn 1 dự án để bắt đầu phân bổ
  const handleSelectProjectForStaffing = (project) => {
    if (!staffingCandidate) return;
    setIsProjectSelectOpen(false);
    if (onOpenStaffingModal) {
      onOpenStaffingModal(project, staffingCandidate.userId, staffingCandidate.availableCapacity);
    } else {
      toast.show('Thông báo', `Vui lòng chuyển qua tab "Danh sách Dự án Công nghệ" để phân bổ vào dự án ${project.projectName}`, 'info');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Cụm 1: Smart Skill Matcher (Công cụ Săn tìm & Ghép nối) ──────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl border border-slate-800 text-white p-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Smart Skill Matcher (Ghép nối Kỹ sư Dự án)</h3>
                <p className="text-xs text-slate-400">
                  Lọc nhanh kỹ sư đáp ứng Tech Stack dự án, kiểm tra độ tương thích và sẵn sàng ghế chờ
                </p>
              </div>
            </div>

            {matchResults && (
              <button
                onClick={handleResetMatcher}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-300 transition"
              >
                <RotateCcw size={14} />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>

          {/* Form Matcher */}
          <form onSubmit={handleRunMatcher} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Chọn kỹ năng */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Chọn công nghệ yêu cầu ({selectedSkillIds.length} đã chọn)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 border border-white/10 rounded-xl max-h-28 overflow-y-auto">
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
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{skill.skillName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cấp độ kỳ vọng & Tùy chọn lọc */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Cấp độ kỹ năng kỳ vọng
                </label>
                <select
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-800 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FRESHER">Fresher trở lên</option>
                  <option value="JUNIOR">Junior trở lên</option>
                  <option value="MIDDLE">Middle trở lên (Khuyên dùng)</option>
                  <option value="SENIOR">Senior trở lên</option>
                  <option value="EXPERT">Expert (Chuyên gia)</option>
                </select>

                <div className="space-y-1.5 pt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={strictLevel}
                      onChange={(e) => setStrictLevel(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className={strictLevel ? "font-bold text-amber-300" : "text-slate-300"}>
                      Lọc nghiêm ngặt cấp bậc
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={benchOnly}
                      onChange={(e) => setBenchOnly(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Chỉ tìm người đang ngồi Bench (Rảnh việc)</span>
                  </label>
                </div>
              </div>

              {/* Nút tìm kiếm */}
              <div className="md:col-span-3 flex flex-col justify-end">
                <button
                  type="submit"
                  disabled={matching || selectedSkillIds.length === 0}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {matching ? (
                    'Đang tính toán...'
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Săn tìm Kỹ sư phù hợp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Kết quả ghép nối */}
          {matchResults && (
            <div className="pt-4 border-t border-white/10 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Tìm thấy <strong className="text-white">{matchResults.length}</strong> ứng viên đáp ứng yêu cầu:
                </span>
              </div>

              {matchResults.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-slate-400">
                  Không tìm thấy kỹ sư nào phù hợp với toàn bộ tiêu chí trên. Vui lòng hạ bớt cấp độ hoặc bỏ chọn lọc Ghế chờ.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matchResults.map((candidate) => (
                    <div
                      key={candidate.userId}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                              {candidate.hoTen.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{candidate.hoTen}</p>
                              <p className="text-[11px] text-slate-400">{candidate.chucVu}</p>
                            </div>
                          </div>

                          <div className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold text-[11px]">
                            {candidate.matchScore}% Khớp
                          </div>
                        </div>

                        {/* Tình trạng tải */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-400">Dung lượng rảnh:</span>
                          <span
                            className={`font-semibold ${
                              candidate.availableCapacity > 0 ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            {candidate.availableCapacity > 0 ? `Rảnh ${candidate.availableCapacity}%` : 'Full 100%'}
                          </span>
                        </div>

                        {/* Kỹ năng khớp */}
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Kỹ năng đáp ứng:</p>
                          <div className="flex flex-wrap gap-1">
                            {sortSkillsByLevel(candidate.matchedSkills || []).map((ms) => {
                              const conf = PROFICIENCY_CONFIG[ms.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                              return (
                                <span
                                  key={ms.id}
                                  className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 ${conf.bg}`}
                                >
                                  <span>{ms.skillName}</span>
                                  <span className="opacity-75">({conf.label})</span>
                                  {ms.isVerified && <CheckCircle2 size={10} className="text-blue-600" />}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className={`grid ${isReadOnly ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pt-2 border-t border-white/10`}>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(candidate.userId)}
                          className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                          title="Xem chi tiết Radar & kỹ năng"
                        >
                          <UserCheck size={13} className="text-blue-300" />
                          <span>Tech Profile</span>
                        </button>

                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenProjectSelect(candidate)}
                            className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
                            title="Chọn dự án để phân bổ nhân sự này"
                          >
                            <UserPlus size={13} />
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
      </div>

      {/* ── Cụm 2: Ma trận Kỹ năng toàn phòng (Skills Heatmap Matrix) ───────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Ma trận Kỹ năng Đội ngũ Kỹ sư (Skills Matrix)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi trình độ chuyên môn (Fresher → Expert), số năm kinh nghiệm và xác thực năng lực
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Cấp bậc:</span>
            {Object.entries(PROFICIENCY_CONFIG).map(([key, conf]) => (
              <span key={key} className={`px-2 py-0.5 rounded text-[10px] border ${conf.bg}`}>
                {conf.label}
              </span>
            ))}
          </div>
        </div>

        {/* Danh sách Kỹ sư & Ma trận */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải ma trận kỹ năng...</div>
        ) : matrixData.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Chưa có dữ liệu kỹ sư công nghệ nào.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {matrixData.map((profile) => (
              <div key={profile.userId} className="p-5 hover:bg-slate-50/60 transition space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Info kỹ sư */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                      {profile.hoTen.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{profile.hoTen}</span>
                        <span className="text-[11px] text-slate-400">({profile.maNhanVien})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {profile.chucVu} • {profile.departmentName}
                      </p>
                    </div>
                  </div>

                  {/* Chỉ số nhanh & Hành động */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 font-medium">Tải công việc:</p>
                      <p className="text-xs font-bold text-slate-700">
                        {profile.totalAllocation}% ({profile.availableCapacity > 0 ? `Rảnh ${profile.availableCapacity}%` : 'Full tải'})
                      </p>
                    </div>

                    <div className="text-right pl-3 border-l border-slate-200">
                      <p className="text-[11px] text-slate-400 font-medium">Kỹ năng / Đã duyệt:</p>
                      <p className="text-xs font-bold text-blue-600 whitespace-nowrap">
                        {profile.totalSkills} kỹ năng • {profile.verifiedSkills} đã duyệt
                      </p>
                    </div>

                    <button
                      onClick={() => handleViewDetail(profile.userId)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition flex items-center gap-1"
                    >
                      <span>Tech Profile</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Danh sách Badges Kỹ năng của Kỹ sư */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {profile.skills.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Chưa khai báo kỹ năng nào</span>
                  ) : (
                    sortSkillsByLevel(profile.skills).map((skill) => {
                      const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                      return (
                        <div
                          key={skill.id}
                          className={`group relative inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border shadow-xs ${conf.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                          <span className="font-semibold">{skill.skillName}</span>
                          <span className="text-[10px] opacity-75 font-normal">
                            ({conf.label} • {skill.yearsOfExperience}n)
                          </span>

                          {/* Trạng thái xác thực */}
                          {skill.isVerified ? (
                            <span title={`Đã xác thực bởi ${skill.verifierName || 'Quản lý'}`}>
                              <CheckCircle2 size={13} className="text-blue-600 ml-0.5" />
                            </span>
                          ) : isReadOnly ? (
                            <span title="Chờ Trưởng phòng / Giám đốc Công nghệ duyệt">
                              <Clock size={12} className="text-slate-400 ml-0.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVerifySkill(skill.id, profile.hoTen, skill.skillName)}
                              disabled={verifyingId === skill.id}
                              className="ml-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs transition whitespace-nowrap shrink-0"
                              title="Bấm để xác thực kỹ năng này"
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
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Xem Hồ sơ Kỹ thuật (Tech Profile Modal) ────────────────────── */}
      {selectedProfile &&
        createPortal(
          <div data-tech-modal="true" className="fixed inset-0 z-[9980] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn">
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-scaleUp">
              {/* Header */}
              <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center border border-white/20 font-bold text-base text-white">
                    {selectedProfile.hoTen.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">{selectedProfile.hoTen}</h3>
                    <p className="text-xs text-white/80">
                      {selectedProfile.chucVu} • {selectedProfile.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Cột trái: Radar Chart 6 chiều */}
                  <div className="md:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-center">
                      Biểu đồ Radar Năng lực (6 Chiều)
                    </h4>
                    <p className="text-[11px] text-slate-400 text-center mt-0.5">
                      Thang điểm 0 - 100 theo cấp bậc & độ phủ kỹ năng
                    </p>

                    <TechRadarChart scores={selectedProfile.radarScores} size={280} />
                  </div>

                  {/* Cột phải: Toàn bộ Kỹ năng & Chứng chỉ */}
                  <div className="md:col-span-7 space-y-5">
                    {/* Danh sách kỹ năng */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers size={14} className="text-blue-600" />
                          Bộ sưu tập Kỹ năng ({selectedProfile.skills.length})
                        </h4>
                        <span className="text-xs text-blue-600 font-semibold whitespace-nowrap">
                          {selectedProfile.verifiedSkills} kỹ năng đã xác thực
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                        {sortSkillsByLevel(selectedProfile.skills).map((skill) => {
                          const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                          return (
                            <div
                              key={skill.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${conf.bg}`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs font-bold text-slate-800 truncate" title={skill.skillName}>
                                  {skill.skillName}
                                </p>
                                <p className="text-[11px] text-slate-500 whitespace-nowrap">
                                  {conf.label} • {skill.yearsOfExperience} năm KN
                                </p>
                                {skill.highlightProject && (
                                  <p className="text-[10px] text-slate-600 truncate italic" title={skill.highlightProject}>
                                    {skill.highlightProject}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center">
                                {skill.isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap shrink-0">
                                    <CheckCircle2 size={11} className="text-blue-600 shrink-0" />
                                    <span>Đã duyệt</span>
                                  </span>
                                ) : isReadOnly ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-white/80 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">
                                    <Clock size={11} className="text-slate-400 shrink-0" />
                                    <span>Chờ duyệt</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifySkill(skill.id, selectedProfile.hoTen, skill.skillName)}
                                    disabled={verifyingId === skill.id}
                                    className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition shadow-xs whitespace-nowrap shrink-0"
                                  >
                                    {verifyingId === skill.id ? '...' : 'Xác thực'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chứng chỉ quốc tế */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={14} className="text-amber-600" />
                        Chứng chỉ Quốc tế ({selectedProfile.certificates.length})
                      </h4>

                      {selectedProfile.certificates.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Chưa có chứng chỉ quốc tế nào được lưu.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedProfile.certificates.map((cert) => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            const isExpired = cert.expiryDate && cert.expiryDate < todayStr;
                            const isLifetime = !cert.expiryDate;

                            return (
                              <div
                                key={cert.id}
                                className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                                  isExpired ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-amber-50/50 border-amber-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-900">{cert.certificateName}</p>
                                    {isLifetime && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-300">
                                        Vĩnh viễn
                                      </span>
                                    )}
                                    {!isLifetime && !isExpired && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded border border-blue-300">
                                        Còn hiệu lực
                                      </span>
                                    )}
                                    {isExpired && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-100/70 px-1.5 py-0.2 rounded border border-rose-300">
                                        Đã hết hạn
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 text-[11px] mt-0.5">
                                    Tổ chức cấp: {cert.issuingOrganization} • Ngày cấp: {cert.issueDate}
                                    {cert.expiryDate && (
                                      <span> • Hạn: <span className={isExpired ? 'text-rose-600 font-semibold' : ''}>{cert.expiryDate}</span></span>
                                    )}
                                  </p>
                                  {cert.credentialId && (
                                    <p className="text-slate-500 text-[10px] mt-0.5">Mã ID: {cert.credentialId}</p>
                                  )}
                                </div>

                                {cert.credentialUrl && (
                                  <a
                                    href={cert.credentialUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-700 hover:text-amber-900 p-1"
                                    title="Xem chứng chỉ"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500 hidden sm:block">
                  Kỹ sư: <strong className="text-slate-800">{selectedProfile.hoTen}</strong> • {selectedProfile.chucVu}
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
                  >
                    Đóng cửa sổ
                  </button>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const prof = selectedProfile;
                        handleOpenProjectSelect(prof);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition"
                    >
                      <UserPlus size={14} />
                      <span>Phân bổ vào Dự án</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Modal Chọn Dự án để Phân bổ Kỹ sư ─────────────────────────── */}
      {!isReadOnly && isProjectSelectOpen && staffingCandidate &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsProjectSelectOpen(false);
            }}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden border border-slate-100 animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 px-6 py-4.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                    <UserPlus size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Chọn Dự án để Phân bổ Kỹ sư</h3>
                    <p className="text-xs text-white/80">
                      Kỹ sư: <strong className="text-white">{staffingCandidate.hoTen}</strong>
                      {staffingCandidate.chucVu && ` • ${staffingCandidate.chucVu}`}
                      {' '}•{' '}
                      <span className={staffingCandidate.availableCapacity > 0 ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
                        {staffingCandidate.availableCapacity > 0 ? `Dung lượng rảnh: ${staffingCandidate.availableCapacity}%` : 'Đã full 100%'}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProjectSelectOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 overflow-hidden">
                {/* Search */}
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={projectSearchKeyword}
                    onChange={(e) => setProjectSearchKeyword(e.target.value)}
                    placeholder="Tìm theo tên dự án, mã PRJ-, công nghệ tech stack..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                {/* Danh sách dự án */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {(() => {
                    const candidateId = staffingCandidate.userId;
                    // Kiểm tra dự án kỹ sư đã là thành viên đang hoạt động
                    const isCandidateInProject = (p) => {
                      if (!candidateId) return false;
                      return (p.members || []).some(
                        m => (m.isActive ?? true) && String(m.userId) === String(candidateId)
                      );
                    };

                    const activeProjects = projectList.filter(p => p.status !== 'COMPLETED' && p.status !== 'PAUSED');
                    const joinedProjects = activeProjects.filter(p => isCandidateInProject(p));
                    const availableProjects = activeProjects.filter(p => !isCandidateInProject(p));

                    const filtered = availableProjects.filter(p => {
                      if (!projectSearchKeyword.trim()) return true;
                      const kw = projectSearchKeyword.toLowerCase();
                      return (
                        p.projectName?.toLowerCase().includes(kw) ||
                        p.projectCode?.toLowerCase().includes(kw) ||
                        (p.techStack && p.techStack.some(t => t.toLowerCase().includes(kw)))
                      );
                    });

                    if (filtered.length === 0) {
                      const searchedInJoined = joinedProjects.filter(p => {
                        if (!projectSearchKeyword.trim()) return false;
                        const kw = projectSearchKeyword.toLowerCase();
                        return (
                          p.projectName?.toLowerCase().includes(kw) ||
                          p.projectCode?.toLowerCase().includes(kw) ||
                          (p.techStack && p.techStack.some(t => t.toLowerCase().includes(kw)))
                        );
                      });

                      return (
                        <div className="space-y-3">
                          {joinedProjects.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50/80 border border-blue-200 px-3.5 py-2 rounded-xl">
                              <Info size={14} className="text-blue-600 shrink-0" />
                              <span className="truncate">
                                Đã tự động loại trừ <strong>{joinedProjects.length}</strong> dự án kỹ sư đã tham gia:{' '}
                                <span className="font-semibold text-blue-900">{joinedProjects.map(p => p.projectName).join(', ')}</span>
                              </span>
                            </div>
                          )}
                          <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                            {searchedInJoined.length > 0 ? (
                              <p className="text-amber-600 font-medium">
                                Dự án &quot;{searchedInJoined.map(p => p.projectName).join(', ')}&quot; đã có kỹ sư này tham gia nên không thể phân bổ thêm.
                              </p>
                            ) : availableProjects.length === 0 ? (
                              <p>
                                {joinedProjects.length > 0
                                  ? `Kỹ sư ${staffingCandidate.hoTen} hiện đã tham gia tất cả các dự án đang hoạt động.`
                                  : 'Hiện không có dự án nào đang hoạt động để phân bổ.'}
                              </p>
                            ) : (
                              <p>Không tìm thấy dự án nào khớp với từ khóa tìm kiếm.</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const candidateSkillNames = staffingCandidate.skills.map(s => (s.skillName || s.name || '').toLowerCase());

                    return (
                      <div className="space-y-3">
                        {joinedProjects.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50/80 border border-blue-200 px-3.5 py-2 rounded-xl">
                            <Info size={14} className="text-blue-600 shrink-0" />
                            <span className="truncate">
                              Đã tự động loại trừ <strong>{joinedProjects.length}</strong> dự án kỹ sư đã tham gia:{' '}
                              <span className="font-semibold text-blue-900">{joinedProjects.map(p => p.projectName).join(', ')}</span>
                            </span>
                          </div>
                        )}
                        {filtered.map((proj) => {
                          const matchedTechs = (proj.techStack || []).filter(t =>
                            candidateSkillNames.some(cs => cs.includes(t.toLowerCase()) || t.toLowerCase().includes(cs))
                          );
                          const isHighMatch = matchedTechs.length > 0;

                          return (
                            <div
                              key={proj.id}
                              className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isHighMatch
                                  ? 'bg-blue-50/40 border-blue-200 hover:border-blue-300 hover:bg-blue-50/70'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {proj.projectCode}
                                  </span>
                                  <h4 className="font-bold text-xs text-slate-900 truncate">{proj.projectName}</h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                                    {proj.projectType === 'INTERNAL' ? 'Nội bộ' : 'Khách hàng'}
                                  </span>
                                </div>

                                {/* Tech stack */}
                                {proj.techStack && proj.techStack.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                    <span className="text-[10px] text-slate-400">Tech Stack:</span>
                                    {proj.techStack.map((tech, tIdx) => {
                                      const isMatched = matchedTechs.includes(tech);
                                      return (
                                        <span
                                          key={tIdx}
                                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                                            isMatched
                                              ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                              : 'bg-slate-100 text-slate-600 border-slate-200'
                                          }`}
                                        >
                                          {tech}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Match indicator & stats */}
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                  {isHighMatch && (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      <Sparkles size={11} className="text-emerald-600" />
                                      Tương thích {matchedTechs.length} công nghệ
                                    </span>
                                  )}
                                  <span>Đội ngũ: <strong>{proj.totalMembersCount || 0}</strong> nhân sự</span>
                                  <span>Tổng tải: <strong>{proj.totalAllocationSum || 0}%</strong></span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSelectProjectForStaffing(proj)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                                >
                                  <UserPlus size={14} />
                                  <span>Chọn dự án này</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProjectSelectOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

