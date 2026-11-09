import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Award,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  X,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import TechRadarChart from './TechRadarChart';
import SkillAddModal from './SkillAddModal';
import CertificateAddModal from './CertificateAddModal';
import {
  PROFICIENCY_CONFIG,
  RADAR_DIMENSIONS,
  sortSkillsByLevel,
  formatDateVN,
} from '../techHelpers';

export default function MyTechProfileTab({ externalProfile = null, onRefreshProfile = null }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [localProfile, setLocalProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState(null);

  // Delete Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: 'SKILL', // 'SKILL' | 'CERT'
    id: null,
    name: '',
    title: '',
    message: '',
  });
  const [deleting, setDeleting] = useState(false);

  const fetchMyProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech/skills/my-profile');
      if (res.data?.data) {
        setLocalProfile(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toastRef.current?.show('Lỗi', 'Không thể tải hồ sơ năng lực kỹ thuật', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!externalProfile) {
      fetchMyProfile();
    }
  }, [externalProfile, fetchMyProfile]);

  const syncProfile = useCallback(async () => {
    if (onRefreshProfile) {
      await onRefreshProfile();
    } else {
      await fetchMyProfile();
    }
  }, [onRefreshProfile, fetchMyProfile]);

  useEffect(() => {
    if (!deleteConfirm.isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) {
        e.stopPropagation();
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [deleteConfirm.isOpen, deleting]);

  const profile = externalProfile || localProfile;

  const requestDeleteSkill = (skillId, skillName) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'SKILL',
      id: skillId,
      name: skillName,
      title: 'Xóa kỹ năng chuyên môn',
      message: `Bạn có chắc chắn muốn xóa kỹ năng "${skillName}" khỏi hồ sơ? Điểm trên biểu đồ Radar sẽ được tự động tính toán lại sau khi xóa.`,
    });
  };

  const requestDeleteCert = (certId, certName) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'CERT',
      id: certId,
      name: certName,
      title: 'Xóa chứng chỉ quốc tế',
      message: `Bạn có chắc chắn muốn xóa chứng chỉ "${certName}" khỏi hồ sơ? Các tiêu chí chuyên môn liên quan sẽ được tự động cập nhật.`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      setDeleting(true);
      if (deleteConfirm.type === 'SKILL') {
        await api.delete(`/api/tech/skills/my-skills/${deleteConfirm.id}`);
        toastRef.current?.show('Thành công', `Đã xóa kỹ năng "${deleteConfirm.name}" khỏi hồ sơ!`, 'success');
      } else {
        await api.delete(`/api/tech/skills/certificates/${deleteConfirm.id}`);
        toastRef.current?.show('Thành công', `Đã xóa chứng chỉ "${deleteConfirm.name}"!`, 'success');
      }
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      await syncProfile();
    } catch (err) {
      console.error(err);
      toastRef.current?.show('Thất bại', err.response?.data?.message || 'Không thể xóa mục đã chọn', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="space-y-5">
        <div className="h-32 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 h-96 skeleton rounded-2xl" />
          <div className="lg:col-span-7 h-96 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
        Không tìm thấy thông tin hồ sơ năng lực kỹ thuật.
      </div>
    );
  }

  const skillsList = profile.skills || [];
  const certsList = profile.certificates || [];
  const existingSkillIds = skillsList.map((s) => s.skillId);
  const sortedSkills = sortSkillsByLevel(skillsList);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* ── Banner Hồ sơ Năng lực — Deep Sapphire Blueprint ─────────────────── */}
      <div className="bg-[#0F2557] rounded-2xl border border-blue-900/80 shadow-[0_8px_28px_-6px_rgba(15,37,87,0.28)] text-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-extrabold text-xl shrink-0">
              {profile.hoTen ? profile.hoTen.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                  {profile.hoTen}
                </h2>
                {profile.maNhanVien && (
                  <span className="font-mono px-2.5 py-0.5 rounded-md bg-white/10 text-blue-100 text-[11px] font-bold border border-white/20 tabular">
                    {profile.maNhanVien}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100/85 mt-1 truncate">
                {profile.chucVu || 'Kỹ sư phần mềm'} • {profile.departmentName || 'Công nghệ'}
              </p>
              <p className="text-[11px] text-blue-200/75 font-mono truncate mt-0.5">{profile.email}</p>
            </div>
          </div>

          {/* 4 Quick Stat Wells */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 tabular">
            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center">
              <p className="text-[11px] text-blue-100/75">Tổng Kỹ năng</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{profile.totalSkills ?? skillsList.length}</p>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center">
              <p className="text-[11px] text-blue-100/75">Đã Xác thực</p>
              <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{profile.verifiedSkills ?? 0}</p>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center">
              <p className="text-[11px] text-blue-100/75">Chứng chỉ</p>
              <p className="text-xl font-extrabold text-blue-200 mt-0.5">{certsList.length}</p>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center">
              <p className="text-[11px] text-blue-100/75">Tải dự án</p>
              <p
                className={`text-xl font-extrabold mt-0.5 ${
                  (profile.totalAllocation ?? 0) > 100
                    ? 'text-rose-300'
                    : (profile.totalAllocation ?? 0) === 100
                    ? 'text-blue-200'
                    : 'text-emerald-300'
                }`}
              >
                {profile.totalAllocation ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Khối 2 Cột: Radar Chart + Kỹ năng & Chứng chỉ ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (5 phần): Biểu đồ Radar 6 Chiều */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] border border-slate-200/90 p-5 sm:p-6 flex flex-col items-center justify-between space-y-4">
          <div className="w-full text-center space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-center gap-1.5">
              <Cpu size={16} className="text-blue-600" />
              <span>Biểu đồ Radar Năng lực (6 Chiều)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Thang điểm 0 – 100 theo cấp bậc, kinh nghiệm và chứng chỉ đã xác thực
            </p>
          </div>

          <div className="py-1">
            <TechRadarChart scores={profile.radarScores || {}} size={280} />
          </div>

          {/* 6-Dimension Score Mini Grid */}
          <div className="w-full grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            {RADAR_DIMENSIONS.map((dim) => {
              const val = Math.round(profile.radarScores?.[dim.key] || 0);
              return (
                <div
                  key={dim.key}
                  className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <span className="text-slate-600 truncate">{dim.label}</span>
                  <span className="font-bold text-blue-700 tabular">{val}</span>
                </div>
              );
            })}
          </div>

          <div className="w-full p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700 space-y-1">
            <p className="font-bold text-[#1E3A8A] flex items-center gap-1.5">
              <UserCheck size={14} className="text-blue-600 shrink-0" />
              <span>Cơ chế thẩm định năng lực</span>
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Kỹ năng tự khai báo được Trưởng phòng / Giám đốc Công nghệ thẩm định để cấp tích xanh xác thực và phục vụ phân bổ vào dự án phù hợp.
            </p>
          </div>
        </div>

        {/* Cột phải (7 phần): Danh sách Kỹ năng & Chứng chỉ */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Bộ sưu tập Kỹ năng */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] border border-slate-200/90 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Layers size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bộ sưu tập Kỹ năng Công nghệ</h3>
                  <p className="text-[11px] text-slate-500">
                    Sắp xếp từ Fresher → Expert • Tự khai báo ngôn ngữ, framework và kinh nghiệm
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSkill(null);
                  setIsSkillModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus size={14} />
                <span>Khai báo Kỹ năng</span>
              </button>
            </div>

            {sortedSkills.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 space-y-1.5">
                <Layers size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Chưa có kỹ năng nào trong hồ sơ</p>
                <p className="text-[11px] text-slate-400">
                  Bấm &quot;Khai báo Kỹ năng&quot; để cập nhật năng lực chuyên môn của bạn.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedSkills.map((skill) => {
                  const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                  return (
                    <div
                      key={skill.id}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-xs flex flex-col justify-between space-y-2.5 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate" title={skill.skillName}>
                            {skill.skillName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] border whitespace-nowrap ${conf.bg}`}>
                              {conf.label}
                            </span>
                            <span className="text-[11px] text-slate-500 whitespace-nowrap tabular">
                              {skill.yearsOfExperience} năm KN
                            </span>
                          </div>
                        </div>

                        {skill.isVerified ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap shrink-0"
                            title={`Đã được xác thực bởi ${skill.verifierName || 'Quản lý'}`}
                          >
                            <CheckCircle2 size={11} className="text-blue-600 shrink-0" />
                            <span>Đã duyệt</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0">
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </div>

                      {skill.highlightProject && (
                        <p className="text-[11px] text-slate-600 italic bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60 line-clamp-2">
                          {skill.highlightProject}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkill(skill);
                            setIsSkillModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                          title="Chỉnh sửa kỹ năng"
                          aria-label="Chỉnh sửa kỹ năng"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteSkill(skill.id, skill.skillName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa kỹ năng"
                          aria-label="Xóa kỹ năng"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Chứng chỉ Quốc tế */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] border border-slate-200/90 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                  <Award size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Chứng chỉ Chuyên môn Quốc tế</h3>
                  <p className="text-[11px] text-slate-500">
                    Chứng nhận uy tín ngành IT (AWS, Oracle, ISTQB, Scrum...)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingCert(null);
                  setIsCertModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus size={14} />
                <span>Thêm Chứng chỉ</span>
              </button>
            </div>

            {certsList.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 space-y-1.5">
                <Award size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Chưa có chứng chỉ nào được lưu</p>
                <p className="text-[11px] text-slate-400">
                  Bổ sung chứng chỉ chuyên môn để gia tăng điểm đánh giá kỹ thuật.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {certsList.map((cert) => {
                  const isExpired = cert.expiryDate && cert.expiryDate < todayStr;
                  const isLifetime = !cert.expiryDate;

                  return (
                    <div
                      key={cert.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs transition ${
                        isExpired
                          ? 'bg-slate-50/80 border-slate-200 opacity-80'
                          : 'bg-blue-50/35 border-blue-200/80 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                            isExpired
                              ? 'bg-slate-200 text-slate-500 border-slate-300'
                              : 'bg-blue-100/80 border-blue-200 text-[#1E3A8A]'
                          }`}
                        >
                          <ShieldCheck size={17} />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-xs">{cert.certificateName}</h4>
                            {isLifetime && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap shrink-0">
                                <Sparkles size={10} className="text-emerald-600 shrink-0" />
                                <span>Vĩnh viễn</span>
                              </span>
                            )}
                            {!isLifetime && !isExpired && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap shrink-0">
                                <CheckCircle2 size={10} className="text-blue-600 shrink-0" />
                                <span>Còn hiệu lực</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap shrink-0">
                                <AlertTriangle size={10} className="text-rose-600 shrink-0" />
                                <span>Đã hết hạn</span>
                              </span>
                            )}
                          </div>

                          <p className="text-slate-600 text-[11px] tabular">
                            Tổ chức cấp: <strong className="text-slate-800">{cert.issuingOrganization}</strong> • Ngày cấp:{' '}
                            {formatDateVN(cert.issueDate)}
                            {cert.expiryDate && (
                              <span>
                                {' '}• Hạn:{' '}
                                <span className={isExpired ? 'text-rose-600 font-semibold' : ''}>
                                  {formatDateVN(cert.expiryDate)}
                                </span>
                              </span>
                            )}
                          </p>
                          {cert.credentialId && (
                            <p className="text-slate-500 text-[10px] font-mono">Mã ID: {cert.credentialId}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {cert.credentialUrl && (
                          <a
                            href={cert.credentialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 transition"
                            title="Xác thực online"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCert(cert);
                            setIsCertModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-100/60 transition cursor-pointer"
                          title="Chỉnh sửa chứng chỉ"
                          aria-label="Chỉnh sửa chứng chỉ"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteCert(cert.id, cert.certificateName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa chứng chỉ"
                          aria-label="Xóa chứng chỉ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Thêm / Sửa Kỹ năng */}
      <SkillAddModal
        isOpen={isSkillModalOpen}
        onClose={() => {
          setIsSkillModalOpen(false);
          setEditingSkill(null);
        }}
        onSuccess={syncProfile}
        initialSkill={editingSkill}
        existingSkillIds={existingSkillIds}
      />

      {/* Modal Thêm / Sửa Chứng chỉ */}
      <CertificateAddModal
        isOpen={isCertModalOpen}
        initialData={editingCert}
        onClose={() => {
          setIsCertModalOpen(false);
          setEditingCert(null);
        }}
        onSuccess={syncProfile}
      />

      {/* ── Popup Xác nhận Xóa (z-[10000]) ─────────────────────────────────── */}
      {deleteConfirm.isOpen &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleting) {
                setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
              }
            }}
          >
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />

            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden border border-slate-200 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">{deleteConfirm.title}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{deleteConfirm.message}</p>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                  aria-label="Đóng hộp thoại"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
}