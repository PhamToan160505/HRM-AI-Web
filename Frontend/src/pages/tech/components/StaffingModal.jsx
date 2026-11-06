import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UserPlus,
  Users,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Sparkles,
  Sliders,
  Edit2,
  Check
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

const PROJECT_ROLES = [
  { value: 'TECH_LEAD', label: 'Tech Lead (Trưởng nhóm kỹ thuật)', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'BACKEND_DEV', label: 'Backend Developer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'FRONTEND_DEV', label: 'Frontend Developer', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'FULLSTACK_DEV', label: 'Fullstack Developer', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'MOBILE_DEV', label: 'Mobile Developer (iOS/Android)', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'QA_TESTER', label: 'QA / Automation Tester', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'DEVOPS', label: 'DevOps / Cloud Engineer', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'UI_UX_DESIGNER', label: 'UI/UX Designer', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export default function StaffingModal({ isOpen, onClose, project, onSuccess }) {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form add member
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('BACKEND_DEV');
  const [allocationPercent, setAllocationPercent] = useState(100);

  // State chỉnh sửa thành viên hiện có
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editRole, setEditRole] = useState('BACKEND_DEV');
  const [editPercent, setEditPercent] = useState(100);
  const [updatingMember, setUpdatingMember] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCandidates();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech/projects/bench');
      if (res.data?.data) {
        setCandidates(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  const currentMembers = project.members || [];
  const activeMembers = currentMembers.filter(m => m.isActive);

  // Tìm thông tin ứng viên đang chọn để kiểm tra quá tải
  const selectedCandidate = candidates.find(c => String(c.userId) === String(selectedUserId));
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

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn rút nhân sự "${memberName}" khỏi dự án này?`)) {
      return;
    }

    try {
      await api.delete(`/api/tech/projects/${project.id}/members/${memberId}`);
      toast.show('Đã cập nhật', `Đã rút ${memberName} khỏi dự án. Nguồn lực đã được hoàn trả về Bench.`, 'info');
      onSuccess?.();
      fetchCandidates();
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể rút nhân sự', 'error');
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
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto max-h-[88vh] flex flex-col overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Cố định ở đỉnh */}
        <div className="shrink-0 px-6 py-4.5 sm:py-5 bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Users size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {project.projectCode}
                </span>
                <h2 className="text-lg font-bold">{project.projectName}</h2>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Quản lý đội ngũ kỹ thuật, chỉ định Tech Lead và phân bổ công suất (% Allocation)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Vùng cuộn ở giữa */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Thêm nhân sự mới */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-blue-600" />
              <span>Phân bổ Nhân sự mới vào Dự án</span>
            </h3>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Chọn nhân viên */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Kỹ sư / Lập trình viên
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={e => {
                      const uid = e.target.value;
                      setSelectedUserId(uid);
                      const cand = candidates.find(c => String(c.userId) === String(uid));
                      if (cand && cand.availableCapacity > 0) {
                        setAllocationPercent(cand.availableCapacity);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn kỹ sư từ phòng kỹ thuật --</option>
                    {candidates.map(cand => {
                      // Ẩn nếu đã ở trong dự án
                      const isAlreadyIn = activeMembers.some(m => String(m.userId) === String(cand.userId));
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

                {/* Chọn vai trò chuyên môn */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Vai trò trong Dự án
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    {PROJECT_ROLES.map(r => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* % Allocation slider & input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">
                      Tỷ lệ tải (% Allocation)
                    </label>
                    <span className="font-bold text-xs text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                      {allocationPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={allocationPercent}
                      onChange={e => setAllocationPercent(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Cảnh báo quá tải nếu simulatedTotal > 100 */}
              {selectedCandidate && isOverloadWarning && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs animate-shake">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>Cảnh báo quá tải:</strong> {selectedCandidate.hoTen} hiện đang gánh {candidateCurrentAlloc}% công suất. Thêm {allocationPercent}% nữa sẽ đẩy tổng tải lên <strong>{simulatedTotal}%</strong>.
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting || !selectedUserId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Đang thêm...' : 'Xác nhận gán vào Dự án'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Danh sách thành viên hiện tại */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)</span>
              </h3>
              <span className="text-xs text-slate-500">
                Tổng công suất huy động:{' '}
                <strong className="text-blue-700 font-bold">
                  {activeMembers.reduce((sum, m) => sum + (m.allocationPercent || 0), 0)}%
                </strong>
              </span>
            </div>

            {activeMembers.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">Dự án này chưa có thành viên nào.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Sử dụng biểu mẫu phía trên để phân bổ Tech Lead và các Developer.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMembers.map(member => {
                  const roleConfig = PROJECT_ROLES.find(r => r.value === member.projectRole) || {
                    label: member.projectRole,
                    color: 'bg-slate-100 text-slate-700 border-slate-200'
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
                        className="p-4 rounded-xl border-2 border-blue-400 bg-blue-50/40 shadow-sm space-y-3 transition-all md:col-span-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                              {member.userName ? member.userName.charAt(0) : 'U'}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">{member.userName}</h4>
                              <p className="text-[10px] text-slate-500 font-mono">{member.userEmail}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-100/90 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sliders size={12} /> Đang chỉnh sửa phân bổ
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Chọn vai trò */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">
                              Vai trò trong Dự án
                            </label>
                            <select
                              value={editRole}
                              onChange={e => setEditRole(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500 font-medium"
                            >
                              {PROJECT_ROLES.map(r => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Điều chỉnh tỷ lệ tải */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-600 uppercase">
                                Tỷ lệ tải (% Allocation)
                              </label>
                              <span className="text-xs font-extrabold text-blue-700 font-mono">
                                {editPercent}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={editPercent}
                              onChange={e => setEditPercent(Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </div>

                        {/* Cảnh báo quá tải thời gian thực */}
                        <div className="pt-1 flex items-center justify-between text-[11px] flex-wrap gap-2">
                          <span className="text-slate-600">
                            Tổng tải cá nhân sau khi sửa:{' '}
                            <strong className={isOverloadPreview ? 'text-red-600 font-bold' : 'text-slate-800 font-bold'}>
                              {previewTotalLoad}%
                            </strong>{' '}
                            (ở dự án khác: {otherProjectsLoad}%)
                          </span>
                          {isOverloadPreview && (
                            <span className="font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                              <AlertTriangle size={12} /> Cảnh báo: Quá tải ({previewTotalLoad}%)!
                            </span>
                          )}
                        </div>

                        {/* Nút hành động Lưu / Hủy */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={updatingMember}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(member.id)}
                            disabled={updatingMember}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
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
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isLead
                          ? 'bg-purple-50/40 border-purple-200 shadow-sm'
                          : 'bg-white border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow">
                          {member.userName ? member.userName.charAt(0) : 'U'}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-800">{member.userName}</h4>
                            {isLead && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300/60 shadow-xs">
                                <Sparkles size={10} className="text-amber-600" />
                                TECH LEAD
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">{member.userEmail}</p>

                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleConfig.color}`}>
                              {roleConfig.label}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                              Tải: {member.allocationPercent}%
                            </span>
                            {member.totalCurrentAllocation > 100 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
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
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Chỉnh sửa vai trò & tỷ lệ tải"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.userName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

        {/* Footer - Cố định ở đáy */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            * Khi dự án hoàn thành, toàn bộ thành viên sẽ tự động được hoàn trả % công suất về ghế chờ (Bench).
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-xs transition"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

