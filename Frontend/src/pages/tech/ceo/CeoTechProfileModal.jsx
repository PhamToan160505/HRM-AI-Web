import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Layers,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import TechRadarChart from '../components/TechRadarChart';
import {
  PROFICIENCY_CONFIG,
  RADAR_DIMENSIONS,
  sortSkillsByLevel,
  formatDateVN,
  getCertExpiryInfo,
} from './ceoTechHelpers';

export default function CeoTechProfileModal({
  profile,
  onClose,
  hasTopModalOpen = false,
  zIndexClass = 'z-[9990]',
}) {
  useEffect(() => {
    if (!profile) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !hasTopModalOpen) {
        e.stopPropagation();
        onClose();
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
  }, [profile, hasTopModalOpen, onClose]);

  if (!profile) return null;

  const sortedSkills = sortSkillsByLevel(profile.skills || []);
  const certificates = profile.certificates || [];

  return createPortal(
    <div
      data-tech-modal="true"
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ceo-profile-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Deep Sapphire Corporate */}
        <div className="px-6 py-4.5 bg-[#0F2557] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 font-bold text-base text-white shrink-0">
              {profile.hoTen ? profile.hoTen.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="ceo-profile-modal-title" className="font-bold text-base text-white truncate">
                  {profile.hoTen}
                </h3>
                {profile.maNhanVien && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-blue-100 border border-white/15 tabular">
                    {profile.maNhanVien}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100/80 truncate mt-0.5">
                {profile.chucVu || 'Kỹ sư phần mềm'} • {profile.departmentName || 'Công nghệ'} • {profile.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Đóng cửa sổ (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Quick Capacity Ribbon */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tải dự án hiện tại</span>
              <span
                className={`text-sm font-extrabold tabular ${
                  profile.totalAllocation > 100
                    ? 'text-rose-600'
                    : profile.totalAllocation === 100
                    ? 'text-blue-700'
                    : 'text-emerald-700'
                }`}
              >
                {profile.totalAllocation ?? 0}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Dung lượng còn trống</span>
              <span className="text-sm font-extrabold text-emerald-700 tabular">
                {profile.availableCapacity ?? 0}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tỷ lệ đã xác thực</span>
              <span className="text-sm font-extrabold text-blue-700 tabular">
                {profile.verifiedSkills ?? 0}/{profile.totalSkills ?? sortedSkills.length} kỹ năng
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Cột trái: Radar Chart 6 chiều */}
            <div className="md:col-span-5 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-between space-y-3">
              <div className="text-center">
                <h4 className="text-xs font-bold text-slate-800">Biểu đồ Radar Năng lực (6 Chiều)</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Thang điểm 0 – 100 theo cấp bậc &amp; độ phủ kỹ năng
                </p>
              </div>

              <TechRadarChart scores={profile.radarScores || {}} size={265} />

              <div className="w-full grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/70">
                {RADAR_DIMENSIONS.map((dim) => {
                  const val = Math.round(profile.radarScores?.[dim.key] || 0);
                  return (
                    <div
                      key={dim.key}
                      className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white border border-slate-200/60 text-[11px]"
                    >
                      <span className="text-slate-600 truncate">{dim.label}</span>
                      <span className="font-bold text-blue-700 tabular">{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: Bộ sưu tập kỹ năng & chứng chỉ */}
            <div className="md:col-span-7 space-y-5">
              {/* Skills */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    <span>Bộ sưu tập Kỹ năng ({sortedSkills.length})</span>
                  </h4>
                  <span className="text-xs text-blue-700 font-semibold whitespace-nowrap tabular">
                    {profile.verifiedSkills ?? 0} kỹ năng đã xác thực
                  </span>
                </div>

                {sortedSkills.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    Kỹ sư chưa khai báo kỹ năng chuyên môn nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {sortedSkills.map((skill) => {
                      const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                      return (
                        <div
                          key={skill.id}
                          className="p-3 rounded-xl border border-slate-200/90 bg-white flex items-center justify-between gap-2.5 hover:border-blue-300 transition"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900 truncate" title={skill.skillName}>
                                {skill.skillName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] border whitespace-nowrap ${conf.bg}`}>
                                {conf.label}
                              </span>
                              <span className="text-[11px] text-slate-500 whitespace-nowrap tabular">
                                {skill.yearsOfExperience} năm KN
                              </span>
                            </div>
                            {skill.highlightProject && (
                              <p className="text-[10px] text-slate-500 truncate italic" title={skill.highlightProject}>
                                {skill.highlightProject}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0">
                            {skill.isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 whitespace-nowrap shrink-0">
                                <CheckCircle2 size={11} className="text-blue-600 shrink-0" />
                                <span>Đã duyệt</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                                <Clock size={11} className="text-slate-400 shrink-0" />
                                <span>Chờ duyệt</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chứng chỉ quốc tế */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Award size={14} className="text-orange-600" />
                  <span>Chứng chỉ Quốc tế ({certificates.length})</span>
                </h4>

                {certificates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có chứng chỉ quốc tế nào được lưu.</p>
                ) : (
                  <div className="space-y-2">
                    {certificates.map((cert) => {
                      const expInfo = getCertExpiryInfo(cert);
                      const isExpired = expInfo.status === 'EXPIRED';
                      const isExpiringSoon = expInfo.status === 'EXPIRING_SOON';
                      const isLifetime = expInfo.status === 'LIFETIME';

                      return (
                        <div
                          key={cert.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                            isExpired
                              ? 'bg-rose-50/40 border-rose-200'
                              : isExpiringSoon
                              ? 'bg-orange-50/45 border-orange-200'
                              : 'bg-blue-50/40 border-blue-200/80'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-900">{cert.certificateName}</p>
                              {isLifetime && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                                  Vĩnh viễn
                                </span>
                              )}
                              {expInfo.status === 'VALID' && (
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">
                                  Còn hiệu lực
                                </span>
                              )}
                              {isExpiringSoon && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 whitespace-nowrap tabular">
                                  <Clock size={10} />
                                  <span>{expInfo.label}</span>
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap tabular">
                                  <AlertTriangle size={10} />
                                  <span>{expInfo.label}</span>
                                </span>
                              )}
                            </div>

                            <p className="text-slate-600 text-[11px] tabular">
                              Tổ chức cấp: {cert.issuingOrganization} • Ngày cấp: {formatDateVN(cert.issueDate)}
                              {cert.expiryDate && (
                                <span>
                                  {' '}• Hạn:{' '}
                                  <span
                                    className={
                                      isExpired
                                        ? 'text-rose-600 font-semibold'
                                        : isExpiringSoon
                                        ? 'text-orange-700 font-semibold'
                                        : ''
                                    }
                                  >
                                    {formatDateVN(cert.expiryDate)}
                                  </span>
                                </span>
                              )}
                            </p>
                            {cert.credentialId && (
                              <p className="text-slate-500 text-[10px] font-mono">Mã ID: {cert.credentialId}</p>
                            )}
                          </div>

                          {cert.credentialUrl && (
                            <a
                              href={cert.credentialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition shrink-0"
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>
              Hồ sơ kỹ thuật: <strong className="text-slate-800">{profile.hoTen}</strong> • Chỉ xem
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
