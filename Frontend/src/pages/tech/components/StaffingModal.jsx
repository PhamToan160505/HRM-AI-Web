import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  UserPlus,
  Users,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Sliders,
  Edit2,
  Check,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { PROJECT_ROLES } from '../techHelpers';

export default function StaffingModal({
  isOpen,
  onClose,
  project,
  onSuccess,
  initialUserId = null,
  initialAllocation = null,
}) {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form add member
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('BACKEND_DEV');
  const [allocationPercent, setAllocationPercent] = useState(100);

  // Remove confirmation modal state
  const [removeConfirm, setRemoveConfirm] = useState({
    isOpen: false,
    memberId: null,
    memberName: '',
  });
  const [removing, setRemoving] = useState(false);

  // Inline edit member state
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editRole, setEditRole] = useState('BACKEND_DEV');
  const [editPercent, setEditPercent] = useState(100);
  const [updatingMember, setUpdatingMember] = useState(false);

  const handleClose = useCallback(() => {
    if (!submitting && !removing && !updatingMember) {
      setEditingMemberId(null);
      onClose();
    }
  }, [submitting, removing, updatingMember, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchCandidates();
      document.body.style.overflow = 'hidden';
      setEditingMemberId(null);
      if (initialUserId) {
        setSelectedUserId(String(initialUserId));
      } else {
        setSelectedUserId('');
      }
      if (initialAllocation !== null && initialAllocation !== undefined) {
        setAllocationPercent(Math.max(10, Math.min(100, Number(initialAllocation) || 100)));
      } else {
        setAllocationPercent(100);
      }
    }

    return () => {
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, initialUserId, initialAllocation]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (removeConfirm.isOpen) {
          if (!removing) setRemoveConfirm({ isOpen: false, memberId: null, memberName: '' });
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, removeConfirm.isOpen, removing, handleClose]);

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await api.get('/api/tech/projects/bench');
      if (res.data?.data) {
        setCandidates(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  if (!isOpen || !project) return null;

  const currentMembers = project.members || [];
  const activeMembers = currentMembers.filter((m) => m.isActive);

  const selectedCandidate = candidates.find((c) => String(c.userId) === String(selectedUserId));
  const candidateCurrentAlloc = selectedCandidate ? selectedCandidate.totalAllocation : 0;
  const simulatedTotal = candidateCurrentAlloc + Number(allocationPercent);
  const isOverloadWarning = simulatedTotal > 100;

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.show('Cảnh báo', 'Vui lòng chọn nhân viên kỹ thuật', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/api/tech/projects/${project.id}/members`, {
        userId: Number(selectedUserId),
        projectRole: selectedRole,
        allocationPercent: Number(allocationPercent),
      });

      toast.show('Thành công', 'Đã phân bổ nhân sự vào dự án thành công!', 'success');
      setSelectedUserId('');
      setAllocationPercent(100);
      onSuccess?.();
      fetchCandidates();
    } catch (err) {
      console.error(err);
      toast.show('Thất bại', err.response?.data?.message || 'Không thể thêm thành viên', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeConfirm.memberId) return;

    try {
      setRemoving(true);
      await api.delete(`/api/tech/projects/${project.id}/members/${removeConfirm.memberId}`);
      toast.show(
        'Đã cập nhật',
        `Đã rút ${removeConfirm.memberName} khỏi dự án. Nguồn lực đã được hoàn trả về Bench.`,
        'info'
      );
      setRemoveConfirm({ isOpen: false, memberId: null, memberName: '' });
      onSuccess?.();
      fetchCandidates();
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể rút nhân sự', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const handleStartEdit = (member) => {
    setEditingMemberId(member.id);
    setEditRole(member.projectRole);
    setEditPercent(member.allocationPercent);
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
  };

  const handleSaveEdit = async (memberId) => {
    try {
      setUpdatingMember(true);
      await api.put(`/api/tech/projects/${project.id}/members/${memberId}`, {
        projectRole: editRole,
        allocationPercent: Number(editPercent),
      });

      toast.show('Thành công', 'Đã cập nhật vai trò và tỷ lệ tải thành công!', 'success');
      setEditingMemberId(null);
      onSuccess?.();
      fetchCandidates();
    } catch (err) {
      console.error(err);
      toast.show('Thất bại', err.response?.data?.message || 'Không thể cập nhật thành viên', 'error');
    } finally {
      setUpdatingMember(false);
    }
  };

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9995] overflow-y-auto bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staffing-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Deep Sapphire */}
        <div className="shrink-0 px-6 py-4.5 sm:py-5 bg-[#0F2557] text-white flex items-center justify-between border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Users size={21} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-blue-100 border border-white/20 tabular">
                  {project.projectCode}
                </span>
                <h2 id="staffing-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                  {project.projectName}
                </h2>
              </div>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Quản lý đội ngũ kỹ thuật, chỉ định Tech Lead và phân bổ công suất (% Allocation)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Đóng cửa sổ (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Phân bổ Nhân sự mới */}
          <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3.5">
              <UserPlus size={16} className="text-blue-600" />
              <span>Phân bổ Nhân sự mới vào Dự án</span>
            </h3>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Chọn nhân viên */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">Kỹ sư / Lập trình viên</label>
                  <select
                    value={selectedUserId}
                    disabled={loadingCandidates}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setSelectedUserId(uid);
                      const cand = candidates.find((c) => String(c.userId) === String(uid));
                      if (cand && cand.availableCapacity > 0) {
                        setAllocationPercent(cand.availableCapacity);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 cursor-pointer"
                  >
                    <option value="">
                      {loadingCandidates ? '-- Đang tải danh sách --' : '-- Chọn kỹ sư từ phòng kỹ thuật --'}
                    </option>
                    {candidates.map((cand) => {
                      const isAlreadyIn = activeMembers.some((m) => String(m.userId) === String(cand.userId));
                      return (
                        <option key={cand.userId} value={cand.userId} disabled={isAlreadyIn}>
                          {cand.hoTen} {cand.chucVu ? `(${cand.chucVu})` : ''} -{' '}
                          {cand.availableCapacity > 0 ? `Rảnh ${cand.availableCapacity}%` : 'Đã full 100%'}
                          {isAlreadyIn ? ' [Đã trong dự án]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Chọn vai trò */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">Vai trò trong Dự án</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 font-medium cursor-pointer"
                  >
                    {PROJECT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* % Allocation slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-600">Tỷ lệ tải (% Allocation)</label>
                    <span className="font-bold text-xs text-blue-700 bg-blue-100/90 border border-blue-200 px-2 py-0.5 rounded-md tabular">
                      {allocationPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1.5">
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={allocationPercent}
                      onChange={(e) => setAllocationPercent(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {selectedCandidate && isOverloadWarning && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-xs tabular">
                  <AlertTriangle size={16} className="text-orange-600 shrink-0" />
                  <span>
                    <strong>Cảnh báo quá tải:</strong> {selectedCandidate.hoTen} hiện đang gánh {candidateCurrentAlloc}% công suất. Thêm {allocationPercent}% sẽ đẩy tổng tải lên <strong>{simulatedTotal}%</strong>.
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting || !selectedUserId}
                  className="px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Đang thêm...' : 'Xác nhận gán vào Dự án'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Danh sách thành viên hiện tại */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)</span>
              </h3>
              <span className="text-xs text-slate-500 tabular">
                Tổng công suất huy động:{' '}
                <strong className="text-blue-700 font-bold">
                  {activeMembers.reduce((sum, m) => sum + (m.allocationPercent || 0), 0)}%
                </strong>
              </span>
            </div>

            {activeMembers.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">Dự án này chưa có thành viên nào.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sử dụng biểu mẫu phía trên để phân bổ Tech Lead và các kỹ sư.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMembers.map((member) => {
                  const roleConfig = PROJECT_ROLES.find((r) => r.value === member.projectRole) || {
                    label: member.projectRole,
                    shortLabel: member.projectRole,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isLead = member.projectRole === 'TECH_LEAD';
                  const isEditingThis = editingMemberId === member.id;

                  if (isEditingThis) {
                    const otherProjectsLoad = Math.max(0, (member.totalCurrentAllocation || 0) - member.allocationPercent);
                    const previewTotalLoad = otherProjectsLoad + Number(editPercent);
                    const isOverloadPreview = previewTotalLoad > 100;

                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50/40 shadow-xs space-y-3 md:col-span-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{member.userName}</h4>
                              <p className="text-[10px] text-slate-500 font-mono truncate">{member.userEmail}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-100/90 border border-blue-200 px-2.5 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
                            <Sliders size={12} /> Đang chỉnh sửa phân bổ
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">Vai trò trong Dự án</label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500 font-medium cursor-pointer"
                            >
                              {PROJECT_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-600 uppercase">
                                Tỷ lệ tải (% Allocation)
                              </label>
                              <span className="text-xs font-extrabold text-blue-700 tabular">{editPercent}%</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={editPercent}
                              onChange={(e) => setEditPercent(Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[11px] flex-wrap gap-2 tabular">
                          <span className="text-slate-600">
                            Tổng tải cá nhân sau khi sửa:{' '}
                            <strong className={isOverloadPreview ? 'text-rose-600 font-bold' : 'text-slate-800 font-bold'}>
                              {previewTotalLoad}%
                            </strong>{' '}
                            (ở dự án khác: {otherProjectsLoad}%)
                          </span>
                          {isOverloadPreview && (
                            <span className="font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle size={12} /> Quá tải ({previewTotalLoad}%)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={updatingMember}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(member.id)}
                            disabled={updatingMember}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Check size={13} />
                            <span>{updatingMember ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                        isLead
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-white border-slate-200/90 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                            isLead ? 'bg-[#1E3A8A] text-white' : 'bg-slate-800 text-white'
                          }`}
                        >
                          {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{member.userName}</h4>
                            {isLead && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1E3A8A] text-white whitespace-nowrap">
                                TECH LEAD
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{member.userEmail}</p>

                          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${roleConfig.badgeClass}`}>
                              {roleConfig.shortLabel || roleConfig.label}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 tabular whitespace-nowrap">
                              Tải: {member.allocationPercent}%
                            </span>
                            {member.totalCurrentAllocation > 100 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 whitespace-nowrap tabular">
                                <AlertTriangle size={10} /> Quá tải ({member.totalCurrentAllocation}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(member)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Chỉnh sửa vai trò & tỷ lệ tải"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveConfirm({ isOpen: true, memberId: member.id, memberName: member.userName })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Rút nhân sự khỏi dự án"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            * Khi dự án hoàn thành, toàn bộ thành viên sẽ tự động được hoàn trả % công suất về ghế chờ (Bench).
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>

        {/* Confirm Remove Member Dialog (Level 3: z-[10000]) */}
        {removeConfirm.isOpen && (
          <div data-tech-modal="true" className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => !removing && setRemoveConfirm({ isOpen: false, memberId: null, memberName: '' })}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden border border-slate-200 z-10"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">Xác nhận rút nhân sự</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Bạn có chắc chắn muốn rút nhân sự{' '}
                    <strong className="text-slate-800">{removeConfirm.memberName}</strong> khỏi dự án này không? Toàn bộ % công suất sẽ được hoàn trả về ghế chờ (Bench).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => setRemoveConfirm({ isOpen: false, memberId: null, memberName: '' })}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => setRemoveConfirm({ isOpen: false, memberId: null, memberName: '' })}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={removing}
                  onClick={handleConfirmRemove}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{removing ? 'Đang rút...' : 'Xác nhận rút nhân sự'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
