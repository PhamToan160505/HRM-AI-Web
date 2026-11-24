import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Server,
  Plus,
  ExternalLink,
  GitBranch,
  History,
  RotateCw,
  Terminal,
  X,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatDateTimeVN } from '../techHelpers';

const ENV_STATUS_CONFIG = {
  ONLINE: {
    label: 'Đang hoạt động',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500',
  },
  DEGRADED: {
    label: 'Hiệu năng giảm',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  MAINTENANCE: {
    label: 'Bảo trì hệ thống',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-500',
  },
  OFFLINE: {
    label: 'Tạm ngắt kết nối',
    badge: 'bg-slate-200 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },
};

export default function ProjectEnvironmentsPanel({
  projectId,
  canManage = false,
}) {
  const toast = useToast();
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Deploy logs modal
  const [activeEnvForLogs, setActiveEnvForLogs] = useState(null);
  const [deployLogs, setDeployLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Add environment modal
  const [isAddEnvOpen, setIsAddEnvOpen] = useState(false);
  const [envName, setEnvName] = useState('DEV');
  const [displayName, setDisplayName] = useState('');
  const [accessUrl, setAccessUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [serverHost, setServerHost] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingEnv, setSubmittingEnv] = useState(false);

  // Edit environment modal
  const [editingEnv, setEditingEnv] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editStatus, setEditStatus] = useState('ONLINE');
  const [editAccessUrl, setEditAccessUrl] = useState('');
  const [editGitBranch, setEditGitBranch] = useState('main');
  const [editServerHost, setEditServerHost] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [submittingEditEnv, setSubmittingEditEnv] = useState(false);

  // Delete environment confirmation modal
  const [deleteEnvTarget, setDeleteEnvTarget] = useState(null);
  const [deletingEnv, setDeletingEnv] = useState(false);

  // Add deployment log modal
  const [deployEnvTarget, setDeployEnvTarget] = useState(null);
  const [versionTag, setVersionTag] = useState('');
  const [commitHash, setCommitHash] = useState('');
  const [deployStatus, setDeployStatus] = useState('SUCCESS');
  const [changelog, setChangelog] = useState('');
  const [submittingDeploy, setSubmittingDeploy] = useState(false);

  const fetchEnvironments = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tech/projects/${projectId}/environments`);
      if (res.data?.data) {
        setEnvironments(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải danh sách môi trường', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const openDeployLogs = async (env) => {
    setActiveEnvForLogs(env);
    try {
      setLoadingLogs(true);
      const res = await api.get(`/api/tech/projects/${projectId}/environments/${env.id}/deployments`);
      if (res.data?.data) {
        setDeployLogs(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải nhật ký triển khai', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCreateEnv = async (e) => {
    e.preventDefault();
    if (!envName.trim() || !displayName.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập mã và tên môi trường', 'warning');
      return;
    }
    try {
      setSubmittingEnv(true);
      const res = await api.post(`/api/tech/projects/${projectId}/environments`, {
        envName: envName.trim().toUpperCase(),
        displayName: displayName.trim(),
        accessUrl: accessUrl.trim() || null,
        gitBranch: gitBranch.trim() || null,
        serverHost: serverHost.trim() || null,
        notes: notes.trim() || null,
      });
      if (res.data?.data) {
        setEnvironments((prev) => [...prev, res.data.data]);
        toast?.show('Thành công', 'Đã thêm môi trường triển khai', 'success');
        setIsAddEnvOpen(false);
        setEnvName('DEV');
        setDisplayName('');
        setAccessUrl('');
        setServerHost('');
        setNotes('');
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tạo môi trường', 'error');
    } finally {
      setSubmittingEnv(false);
    }
  };

  const handleCreateDeployLog = async (e) => {
    e.preventDefault();
    if (!versionTag.trim() || !deployEnvTarget) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập phiên bản release', 'warning');
      return;
    }
    try {
      setSubmittingDeploy(true);
      const res = await api.post(
        `/api/tech/projects/${projectId}/environments/${deployEnvTarget.id}/deployments`,
        {
          versionTag: versionTag.trim(),
          commitHash: commitHash.trim() || null,
          status: deployStatus,
          changelog: changelog.trim() || null,
        }
      );
      if (res.data?.data) {
        toast?.show('Thành công', `Đã ghi nhận triển khai phiên bản ${versionTag}`, 'success');
        setDeployEnvTarget(null);
        setVersionTag('');
        setCommitHash('');
        setChangelog('');
        fetchEnvironments();
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể lưu deployment log', 'error');
    } finally {
      setSubmittingDeploy(false);
    }
  };

  const handleStartEditEnv = (env) => {
    setEditingEnv(env);
    setEditDisplayName(env.displayName || '');
    setEditStatus(env.status || 'ONLINE');
    setEditAccessUrl(env.accessUrl || '');
    setEditGitBranch(env.gitBranch || 'main');
    setEditServerHost(env.serverHost || '');
    setEditNotes(env.notes || '');
  };

  const handleUpdateEnv = async (e) => {
    e.preventDefault();
    if (!editingEnv) return;
    if (!editDisplayName.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập tên hiển thị môi trường', 'warning');
      return;
    }
    try {
      setSubmittingEditEnv(true);
      const res = await api.put(`/api/tech/projects/${projectId}/environments/${editingEnv.id}`, {
        displayName: editDisplayName.trim(),
        status: editStatus,
        accessUrl: editAccessUrl.trim() || null,
        gitBranch: editGitBranch.trim() || null,
        serverHost: editServerHost.trim() || null,
        notes: editNotes.trim() || null,
      });
      if (res.data?.data) {
        setEnvironments((prev) =>
          prev.map((item) => (item.id === editingEnv.id ? res.data.data : item))
        );
        toast?.show('Thành công', `Đã cập nhật môi trường ${res.data.data.displayName}`, 'success');
        setEditingEnv(null);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật môi trường', 'error');
    } finally {
      setSubmittingEditEnv(false);
    }
  };

  const handleConfirmDeleteEnv = async () => {
    if (!deleteEnvTarget) return;
    try {
      setDeletingEnv(true);
      await api.delete(`/api/tech/projects/${projectId}/environments/${deleteEnvTarget.id}`);
      setEnvironments((prev) => prev.filter((item) => item.id !== deleteEnvTarget.id));
      toast?.show('Đã xóa', `Đã xóa môi trường ${deleteEnvTarget.displayName}`, 'info');
      setDeleteEnvTarget(null);
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa môi trường', 'error');
    } finally {
      setDeletingEnv(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Server size={14} className="text-blue-600" />
          <span>Môi trường Triển khai &amp; Hạ tầng Máy chủ ({environments.length})</span>
        </h4>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsAddEnvOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
          >
            <Plus size={12} />
            <span>Thêm môi trường</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Đang tải danh sách môi trường...</div>
      ) : environments.length === 0 ? (
        <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 text-center text-xs text-slate-400">
          Chưa thiết lập môi trường triển khai nào (Dev, Staging, UAT, Production).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {environments.map((env) => {
            const statusConf = ENV_STATUS_CONFIG[env.status] || ENV_STATUS_CONFIG.ONLINE;
            return (
              <div
                key={env.id}
                className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-2xs hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {env.envName}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900">{env.displayName}</h5>
                    </div>
                    {env.serverHost && (
                      <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Terminal size={10} className="text-slate-400" />
                        <span>{env.serverHost}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusConf.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      {statusConf.label}
                    </span>

                    {canManage && (
                      <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleStartEditEnv(env)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                          title="Chỉnh sửa thông tin môi trường"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteEnvTarget(env)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Xóa môi trường"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {env.accessUrl && (
                    <div className="flex items-center gap-1.5 truncate">
                      <ExternalLink size={12} className="text-blue-600 shrink-0" />
                      <a
                        href={env.accessUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold truncate"
                      >
                        {env.accessUrl}
                      </a>
                    </div>
                  )}

                  {env.gitBranch && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <GitBranch size={12} className="text-slate-400 shrink-0" />
                      <span>Branch: <strong>{env.gitBranch}</strong></span>
                    </div>
                  )}

                  {env.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 rounded p-1.5 border border-slate-100 line-clamp-2">
                      {env.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 tabular">
                    <span>
                      Triển khai: <strong>{env.deploymentCount || 0} lần</strong>
                    </span>
                    {env.latestVersionTag ? (
                      <span className="text-emerald-700 font-semibold">
                        Phiên bản: {env.latestVersionTag}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa triển khai</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openDeployLogs(env)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-700 transition cursor-pointer"
                  >
                    <History size={12} />
                    <span>Lịch sử Deploy</span>
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeployEnvTarget(env);
                        setVersionTag('');
                        setCommitHash('');
                        setChangelog('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                    >
                      <RotateCw size={11} />
                      <span>Ghi nhận Deploy</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lịch sử Triển khai */}
      {activeEnvForLogs &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto">
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <History size={16} />
                    <span>Nhật ký Triển khai — Môi trường {activeEnvForLogs.displayName}</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">
                    Mã: {activeEnvForLogs.envName} • {deployLogs.length} đợt triển khai đã ghi nhận
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveEnvForLogs(null)}
                  className="p-1.5 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {loadingLogs ? (
                  <div className="py-8 text-center text-xs text-slate-400">Đang tải lịch sử...</div>
                ) : deployLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">Chưa có lượt triển khai nào được ghi nhận.</div>
                ) : (
                  <div className="space-y-2.5">
                    {deployLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              {log.versionTag}
                            </span>
                            {log.commitHash && (
                              <span className="font-mono text-[11px] text-slate-500">
                                #{log.commitHash.substring(0, 7)}
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : log.status === 'ROLLED_BACK'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {log.status === 'SUCCESS' ? 'Thành công' : log.status === 'ROLLED_BACK' ? 'Đã Rollback' : 'Thất bại'}
                          </span>
                        </div>

                        {log.changelog && (
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{log.changelog}</p>
                        )}

                        <p className="text-[10px] text-slate-400 tabular">
                          Triển khai bởi <strong>{log.deployedByName || 'Kỹ sư'}</strong> lúc {formatDateTimeVN(log.deployedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveEnvForLogs(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Thêm Môi trường mới */}
      {isAddEnvOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto">
            <form
              onSubmit={handleCreateEnv}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus size={16} />
                  <span>Thêm Môi trường Triển khai Dự án</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddEnvOpen(false)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Mã môi trường (DEV, STAGING, PROD)
                    </label>
                    <input
                      type="text"
                      required
                      value={envName}
                      onChange={(e) => setEnvName(e.target.value)}
                      placeholder="VD: STAGING"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="VD: Staging K8s Cluster"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Đường dẫn truy cập URL
                  </label>
                  <input
                    type="url"
                    value={accessUrl}
                    onChange={(e) => setAccessUrl(e.target.value)}
                    placeholder="https://staging.internal.hrm-ai.com"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Nhánh Git liên kết
                    </label>
                    <input
                      type="text"
                      value={gitBranch}
                      onChange={(e) => setGitBranch(e.target.value)}
                      placeholder="release/v2.x"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Máy chủ / IP Server
                    </label>
                    <input
                      type="text"
                      value={serverHost}
                      onChange={(e) => setServerHost(e.target.value)}
                      placeholder="k8s-node-01.internal"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Ghi chú hướng dẫn kết nối / VPN
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Yêu cầu bật VPN WireGuard trước khi truy cập URL staging..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEnvOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingEnv}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingEnv ? 'Đang tạo...' : 'Tạo Môi trường'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Ghi nhận Deployment Log mới */}
      {deployEnvTarget &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto">
            <form
              onSubmit={handleCreateDeployLog}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <RotateCw size={16} />
                    <span>Ghi nhận Triển khai Môi trường {deployEnvTarget.displayName}</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">Lưu nhật ký version và commit hash triển khai</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeployEnvTarget(null)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Phiên bản Release Tag *
                    </label>
                    <input
                      type="text"
                      required
                      value={versionTag}
                      onChange={(e) => setVersionTag(e.target.value)}
                      placeholder="VD: v2.4.0-rc1"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Commit Hash (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={commitHash}
                      onChange={(e) => setCommitHash(e.target.value)}
                      placeholder="VD: 7a8b9c0"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Trạng thái Triển khai
                  </label>
                  <select
                    value={deployStatus}
                    onChange={(e) => setDeployStatus(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  >
                    <option value="SUCCESS">Thành công (SUCCESS)</option>
                    <option value="ROLLED_BACK">Đã khôi phục bản cũ (ROLLED_BACK)</option>
                    <option value="FAILED">Thất bại / Lỗi build (FAILED)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Nội dung thay đổi (Changelog / Release Notes)
                  </label>
                  <textarea
                    rows={3}
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="- Đã bổ sung tính năng DoD Checklist&#10;- Tối ưu hiệu năng truy vấn Timesheet POI..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeployEnvTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingDeploy}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingDeploy ? 'Đang lưu...' : 'Lưu Nhật ký Deploy'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Chỉnh sửa Môi trường */}
      {editingEnv &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
          >
            <form
              role="dialog"
              aria-modal="true"
              onSubmit={handleUpdateEnv}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
            >
              <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Edit2 size={16} />
                    <span>Chỉnh sửa Môi trường Triển khai</span>
                  </h3>
                  <p className="text-xs text-blue-200/80">
                    Mã định danh: <span className="font-mono font-bold text-white bg-blue-900/70 px-1.5 py-0.5 rounded">{editingEnv.envName}</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submittingEditEnv}
                  onClick={() => setEditingEnv(null)}
                  className="p-1 text-blue-100/75 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tên hiển thị *
                    </label>
                    <input
                      type="text"
                      required
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="VD: Staging Pre-Release"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Trạng thái vận hành *
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="ONLINE">Đang hoạt động (ONLINE)</option>
                      <option value="DEGRADED">Hiệu năng giảm (DEGRADED)</option>
                      <option value="MAINTENANCE">Bảo trì hệ thống (MAINTENANCE)</option>
                      <option value="OFFLINE">Tạm ngắt kết nối (OFFLINE)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Đường dẫn truy cập URL
                  </label>
                  <input
                    type="url"
                    value={editAccessUrl}
                    onChange={(e) => setEditAccessUrl(e.target.value)}
                    placeholder="https://staging.internal.hrm-ai.com"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Nhánh Git liên kết
                    </label>
                    <input
                      type="text"
                      value={editGitBranch}
                      onChange={(e) => setEditGitBranch(e.target.value)}
                      placeholder="staging hoặc release/v2.x"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Máy chủ / IP Server
                    </label>
                    <input
                      type="text"
                      value={editServerHost}
                      onChange={(e) => setEditServerHost(e.target.value)}
                      placeholder="10.12.0.45 (AWS EC2 t3.xlarge)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Ghi chú hướng dẫn kết nối / VPN
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Yêu cầu bật VPN WireGuard trước khi truy cập URL staging..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submittingEditEnv}
                  onClick={() => setEditingEnv(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingEditEnv}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingEditEnv && <Loader2 size={13} className="animate-spin" />}
                  <span>{submittingEditEnv ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal Xác nhận Xóa Môi trường */}
      {deleteEnvTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4 my-auto animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Xác nhận xóa môi trường</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn có chắc chắn muốn xóa môi trường{' '}
                    <strong className="text-slate-900">{deleteEnvTarget.displayName}</strong>{' '}
                    (<span className="font-mono font-semibold text-slate-700">{deleteEnvTarget.envName}</span>) khỏi dự án này không?
                  </p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5">
                    ⚠️ <strong>Lưu ý:</strong> Toàn bộ nhật ký triển khai (Deployment Logs) liên quan đến môi trường này cũng sẽ bị xóa. Thao tác này không thể hoàn tác.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deletingEnv}
                  onClick={() => setDeleteEnvTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deletingEnv}
                  onClick={handleConfirmDeleteEnv}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingEnv && <Loader2 size={13} className="animate-spin" />}
                  <span>{deletingEnv ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
