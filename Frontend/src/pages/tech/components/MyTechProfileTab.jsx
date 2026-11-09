import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Building,
  UserCheck,
  X,
  AlertTriangle
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import TechRadarChart from './TechRadarChart';
import SkillAddModal from './SkillAddModal';
import CertificateAddModal from './CertificateAddModal';
import { sortSkillsByLevel } from './SkillsMatrixTab';

const PROFICIENCY_CONFIG = {
  FRESHER: { label: 'Fresher', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  JUNIOR: { label: 'Junior', bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  MIDDLE: { label: 'Middle', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  SENIOR: { label: 'Senior', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold', dot: 'bg-amber-500' },
  EXPERT: { label: 'Expert', bg: 'bg-purple-50 text-purple-800 border-purple-300 font-bold', dot: 'bg-purple-600' },
};

export default function MyTechProfileTab() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
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

  useEffect(() => {
    fetchMyProfile();
  }, []);

  useEffect(() => {
    if (deleteConfirm.isOpen) {
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
  }, [deleteConfirm.isOpen]);

  const fetchMyProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech/skills/my-profile');
      if (res.data?.data) {
        setProfile(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể tải hồ sơ năng lực kỹ thuật', 'error');
    } finally {
      setLoading(false);
    }
  };

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
        toast.show('Thành công', `Đã xóa kỹ năng "${deleteConfirm.name}" khỏi hồ sơ!`, 'success');
      } else {
        await api.delete(`/api/tech/skills/certificates/${deleteConfirm.id}`);
        toast.show('Thành công', `Đã xóa chứng chỉ "${deleteConfirm.name}"!`, 'success');
      }
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      fetchMyProfile();
    } catch (err) {
      console.error(err);
      toast.show('Thất bại', err.response?.data?.message || 'Không thể xóa mục đã chọn', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !profile) {
    return <div className="p-12 text-center text-xs text-slate-400">Đang tải hồ sơ kỹ thuật...</div>;
  }

  if (!profile) {
    return <div className="p-12 text-center text-xs text-slate-400">Không tìm thấy thông tin hồ sơ kỹ thuật.</div>;
  }

  const existingSkillIds = profile.skills.map((s) => s.skillId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Banner Tổng quan Hồ sơ Kỹ thuật ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl shadow-xl text-white p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-2xl shadow-inner">
              {profile.hoTen.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">{profile.hoTen}</h2>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold border border-white/30">
                  {profile.maNhanVien}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1">
                {profile.chucVu} • {profile.departmentName}
              </p>
              <p className="text-xs text-white/70 mt-0.5">{profile.email}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-center min-w-[100px]">
              <p className="text-[11px] text-white/70">Tổng Kỹ năng</p>
              <p className="text-xl font-black text-white mt-0.5">{profile.totalSkills}</p>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-center min-w-[100px]">
              <p className="text-[11px] text-white/70">Đã Xác thực</p>
              <p className="text-xl font-black text-emerald-300 mt-0.5">{profile.verifiedSkills}</p>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-center min-w-[100px]">
              <p className="text-[11px] text-white/70">Chứng chỉ</p>
              <p className="text-xl font-black text-amber-300 mt-0.5">{profile.certificates.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Khối 2 Cột: Radar Chart + Kỹ năng & Chứng chỉ ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (5 phần): Biểu đồ Radar năng lực */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-between">
          <div className="w-full text-center space-y-1">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles size={16} className="text-blue-600" />
              Biểu đồ Radar Năng lực Chuyên môn
            </h3>
            <p className="text-xs text-slate-500">
              Phân tích 6 chiều kỹ thuật tự động dựa trên cấp độ và chứng nhận đã thẩm định
            </p>
          </div>

          <div className="my-2">
            <TechRadarChart scores={profile.radarScores} size={300} />
          </div>

          <div className="w-full p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <UserCheck size={14} className="text-blue-600" />
              Gợi ý phát triển kỹ thuật:
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Điểm số các chiều được tích lũy theo cấp độ (Fresher → Expert), số năm thực chiến và các chứng nhận quốc tế đã được Trưởng phòng thẩm định.
            </p>
          </div>
        </div>

        {/* Cột phải (7 phần): Danh sách Kỹ năng & Chứng chỉ */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Bộ sưu tập Kỹ năng */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Bộ sưu tập Kỹ năng Công nghệ</h3>
                  <p className="text-[11px] text-slate-500">Tự khai báo ngôn ngữ, framework và kinh nghiệm</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSkill(null);
                  setIsSkillModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus size={14} />
                <span>Khai báo Kỹ năng</span>
              </button>
            </div>

            {profile.skills.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Bạn chưa khai báo kỹ năng nào. Hãy bấm "Khai báo Kỹ năng" để bổ sung vào hồ sơ!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortSkillsByLevel(profile.skills).map((skill) => {
                  const conf = PROFICIENCY_CONFIG[skill.proficiencyLevel] || PROFICIENCY_CONFIG.MIDDLE;
                  return (
                    <div
                      key={skill.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 transition hover:shadow-xs ${conf.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                            <h4 className="font-bold text-xs text-slate-800">{skill.skillName}</h4>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Cấp bậc: <strong>{conf.label}</strong> • {skill.yearsOfExperience} năm KN
                          </p>
                        </div>

                        {/* Status badge */}
                        {skill.isVerified ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs whitespace-nowrap shrink-0"
                            title={`Đã được xác thực bởi ${skill.verifierName || 'Quản lý'}`}
                          >
                            <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                            <span>Đã xác thực</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0">
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </div>

                      {skill.highlightProject && (
                        <p className="text-[11px] text-slate-600 italic bg-white/60 p-2 rounded-lg border border-slate-200/50">
                          {skill.highlightProject}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkill(skill);
                            setIsSkillModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white/80 transition"
                          title="Chỉnh sửa kỹ năng"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteSkill(skill.id, skill.skillName)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white/80 transition"
                          title="Xóa kỹ năng"
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chứng chỉ Chuyên môn Quốc tế</h3>
                  <p className="text-[11px] text-slate-500">Chứng nhận bằng cấp (AWS, Oracle, ISTQB, Scrum...)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingCert(null);
                  setIsCertModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus size={14} />
                <span>Thêm Chứng chỉ</span>
              </button>
            </div>

            {profile.certificates.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Bạn chưa thêm chứng chỉ nào. Bổ sung chứng chỉ để tăng độ uy tín và điểm năng lực kỹ thuật!
              </div>
            ) : (
              <div className="space-y-2.5">
                {profile.certificates.map((cert) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isExpired = cert.expiryDate && cert.expiryDate < todayStr;
                  const isLifetime = !cert.expiryDate;

                  return (
                    <div
                      key={cert.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs transition ${
                        isExpired
                          ? 'bg-slate-50/80 border-slate-200 opacity-80'
                          : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                            isExpired
                              ? 'bg-slate-200 text-slate-500 border-slate-300'
                              : 'bg-amber-100 border-amber-300 text-amber-700'
                          }`}
                        >
                          <ShieldCheck size={18} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-xs">{cert.certificateName}</h4>
                            {isLifetime && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Sparkles size={11} className="text-emerald-600" />
                                Vĩnh viễn
                              </span>
                            )}
                            {!isLifetime && !isExpired && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                <CheckCircle2 size={11} className="text-blue-600" />
                                Còn hiệu lực
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle size={11} className="text-rose-600" />
                                Đã hết hạn
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            Tổ chức cấp: <strong>{cert.issuingOrganization}</strong> • Ngày cấp: {cert.issueDate}
                            {cert.expiryDate && (
                              <span>
                                {' '}• Hạn: <span className={isExpired ? 'text-rose-600 font-semibold' : ''}>{cert.expiryDate}</span>
                              </span>
                            )}
                          </p>
                          {cert.credentialId && (
                            <p className="text-slate-500 text-[10px]">Credential ID: {cert.credentialId}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {cert.credentialUrl && (
                          <a
                            href={cert.credentialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 transition"
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-100/50 transition"
                          title="Chỉnh sửa chứng chỉ"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteCert(cert.id, cert.certificateName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Xóa chứng chỉ"
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
        onSuccess={fetchMyProfile}
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
        onSuccess={fetchMyProfile}
      />

      {/* ── Popup Hộp thoại Xác nhận Xóa (Custom Delete Confirm Modal) ─────────── */}
      {deleteConfirm.isOpen &&
        createPortal(
          <div data-tech-modal="true" className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Lớp nền mờ che kín toàn bộ màn hình (bao gồm cả Sidebar và Header) */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => !deleting && setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
            />

            {/* Popup Modal Box */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-xs">
                  <Trash2 size={24} className="stroke-[2.2]" />
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">{deleteConfirm.title}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {deleteConfirm.message}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

