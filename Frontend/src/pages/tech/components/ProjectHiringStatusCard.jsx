import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Users, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import ProjectHiringDetailModal from './ProjectHiringDetailModal';

const REQ_STATUS_LABELS = {
  DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_APPROVAL: { label: 'Chờ phê duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  REVISION_REQUIRED: { label: 'Yêu cầu chỉnh sửa', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  APPROVED: { label: 'HR đang tuyển', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  REJECTED: { label: 'Từ chối', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  FULFILLED: { label: 'Đã tuyển đủ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

/**
 * Widget hiển thị tiến độ tuyển dụng của HR cho một Dự án Công nghệ cụ thể (Module 1).
 */
export default function ProjectHiringStatusCard({
  project,
  isReadOnly = false,
  onRequestHiring,
  refreshKey = 0,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!project?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tech-hr/projects/${project.id}/hiring-status`);
      setData(res.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, refreshKey]);

  const reqs = data?.requisitions || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0F2557] border border-blue-200 flex items-center justify-center">
            <Briefcase size={15} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tiến độ Tuyển dụng Liên kết Phòng Nhân sự ({reqs.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Theo dõi realtime các yêu cầu tuyển dụng &amp; ghế tuyển HR gắn với dự án {project?.projectCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStatus}
            className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
            title="Làm mới tiến độ tuyển dụng"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!isReadOnly && onRequestHiring && (
            <button
              type="button"
              onClick={onRequestHiring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F2557] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Plus size={13} />
              <span>Đề xuất Tuyển dụng (HR)</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-5 text-center text-xs text-slate-400">Đang đồng bộ tiến độ từ Phòng Nhân sự...</div>
      ) : reqs.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between gap-3 flex-wrap">
          <span>Dự án này chưa có yêu cầu tuyển dụng nào đang mở bên Phòng Nhân sự.</span>
          {!isReadOnly && onRequestHiring && (
            <button
              type="button"
              onClick={onRequestHiring}
              className="text-blue-700 font-bold hover:underline cursor-pointer"
            >
              + Gửi yêu cầu tuyển ngay
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-4 text-xs bg-blue-50/50 border border-blue-100 rounded-xl px-3.5 py-2 tabular">
            <span>
              Tổng chỉ tiêu tuyển: <strong className="text-[#0F2557]">{data.totalRequestedHeadcount} nhân sự</strong>
            </span>
            <span>
              Đã chốt Offer / Nhận việc: <strong className="text-emerald-700">{data.totalFilledSeats}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {reqs.map((r) => {
              const st = REQ_STATUS_LABELS[r.status] || {
                label: r.status,
                cls: 'bg-slate-100 text-slate-600 border-slate-200',
              };
              return (
                <div
                  key={r.requisitionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRequisitionId(r.requisitionId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedRequisitionId(r.requisitionId);
                    }
                  }}
                  title="Bấm để xem Chi tiết & Lịch sử đang tuyển"
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/45 hover:border-blue-300 hover:shadow-xs space-y-2 text-xs transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 group-hover:text-[#0F2557] truncate flex items-center gap-1">
                        <span className="truncate">{r.title}</span>
                        <ChevronRight size={13} className="text-slate-400 group-hover:text-blue-600 shrink-0 transition" />
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Cấp bậc: <strong>{r.capBac}</strong> • Cần tuyển: <strong>{r.soLuong}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.urgencyLevel === 'CRITICAL' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          <AlertCircle size={10} /> Khẩn
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/70 tabular flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} className="text-blue-600" />
                      <span>{r.activeApplications} ứng viên</span>
                    </span>
                    <span>
                      Ghế mở: <strong>{r.openSeats}</strong> • Offer: <strong>{r.acceptedSeats}</strong> • Nhận việc:{' '}
                      <strong className="text-emerald-700">{r.joinedSeats}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ProjectHiringDetailModal
        requisitionId={selectedRequisitionId}
        onClose={() => setSelectedRequisitionId(null)}
      />
    </div>
  );
}
