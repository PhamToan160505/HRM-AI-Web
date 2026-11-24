import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, CheckCircle2, Clock, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatDateVN } from '../techHelpers';

/**
 * Hiển thị danh sách Kỹ sư mới đang Pre-boarding & Thử việc (đồng bộ từ HR EmployeeLifecycle)
 * ngay trên tab Công suất & Bench của Phòng Công nghệ (Module 3).
 */
export default function TechPreboardingBanner({
  isReadOnly = false,
  onGoToMentorship,
  onAssignToProject,
}) {
  const toast = useToast();
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingItemId, setCompletingItemId] = useState(null);

  const loadPreboarding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech-hr/preboarding');
      setEngineers(res.data?.data || []);
    } catch {
      setEngineers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreboarding();
  }, [loadPreboarding]);

  const handleCompleteTechItem = async (empId, itemId) => {
    try {
      setCompletingItemId(itemId);
      await api.post(`/api/tech-hr/preboarding/${empId}/items/${itemId}/complete`);
      toast?.show('Đã xác nhận', 'Đã đồng bộ hoàn tất mục Onboarding kỹ thuật sang Phòng Nhân sự', 'success');
      await loadPreboarding();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể hoàn tất mục checklist', 'error');
    } finally {
      setCompletingItemId(null);
    }
  };

  if (loading || engineers.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-[#0F2557] to-[#1E3A8A] rounded-2xl p-4 sm:p-5 text-white shadow-sm border border-blue-900/60 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
            <UserPlus size={16} className="text-blue-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Kỹ sư mới Pre-boarding &amp; Đang thử việc ({engineers.length})
            </h3>
            <p className="text-[11px] text-blue-200/85">
              Đồng bộ trực tiếp từ Phòng Nhân sự — chuẩn bị môi trường Dev/Git, phân công Mentor 1-1 &amp; đưa vào dự án
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadPreboarding}
          className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          title="Làm mới"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {engineers.map((eng) => {
          const isPreboarding = eng.status === 'PRE_BOARDING';
          return (
            <div
              key={eng.lifecycleEmployeeId}
              className="p-3.5 rounded-xl bg-white/10 border border-white/15 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white truncate">{eng.fullName}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-blue-100">
                      {eng.employeeCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-200/90 truncate">
                    {eng.positionTitle} {eng.levelName ? `• ${eng.levelName}` : ''} • {eng.email}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isPreboarding
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                      : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                  }`}
                >
                  {isPreboarding ? 'Sắp nhận việc' : `Thử việc (${eng.probationStatus})`}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-blue-200/80 tabular">
                <span>
                  {isPreboarding
                    ? `Dự kiến nhận việc: ${formatDateVN(eng.startDatePlanned)}`
                    : `Ngày nhận việc: ${formatDateVN(eng.joinDate || eng.startDatePlanned)}`}
                </span>
                {eng.originTechProjectCode && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/30 border border-blue-300/30 text-white font-semibold">
                    Tuyển cho: {eng.originTechProjectCode}
                  </span>
                )}
              </div>

              {/* Tech Checklist items synced with HR */}
              {eng.techChecklistItems && eng.techChecklistItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  {eng.techChecklistItems.map((item) => {
                    const done = item.status === 'COMPLETED';
                    return (
                      <div key={item.itemId} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`flex items-center gap-1.5 ${done ? 'text-emerald-200 line-through' : 'text-white'}`}>
                          {done ? (
                            <CheckCircle2 size={13} className="text-emerald-300 shrink-0" />
                          ) : (
                            <Clock size={13} className="text-amber-300 shrink-0" />
                          )}
                          <span>{item.label}</span>
                        </span>
                        {!done && !isReadOnly && (
                          <button
                            type="button"
                            disabled={completingItemId === item.itemId}
                            onClick={() => handleCompleteTechItem(eng.lifecycleEmployeeId, item.itemId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#0F2557] hover:bg-blue-50 rounded-md text-[10px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {completingItemId === item.itemId && <Loader2 size={10} className="animate-spin" />}
                            <span>Hoàn tất</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isReadOnly && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  {onGoToMentorship && (
                    <button
                      type="button"
                      onClick={() => onGoToMentorship(eng)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Gán Mentor 1-1</span>
                    </button>
                  )}
                  {!isPreboarding && eng.userId && onAssignToProject && (
                    <button
                      type="button"
                      onClick={() => onAssignToProject(eng)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      <span>Phân bổ Dự án</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
