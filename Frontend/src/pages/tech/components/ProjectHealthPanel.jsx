import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

export default function ProjectHealthPanel({ projectId }) {
  const toast = useToast();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!projectId || loading) return;
    try {
      setLoading(true);
      const res = await api.post(`/api/tech/projects/${projectId}/health-brief`);
      if (res.data?.data) {
        setBrief(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể chạy phân tích sức khỏe dự án.';
      toast?.show('Lỗi phân tích', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toneStyle =
    brief?.healthTone === 'CRITICAL'
      ? {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: ShieldAlert,
          iconColor: 'text-rose-600',
        }
      : brief?.healthTone === 'WARNING'
      ? {
          badge: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: AlertTriangle,
          iconColor: 'text-orange-600',
        }
      : {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600',
        };

  const StatusIcon = toneStyle.icon;

  return (
    <div className="rounded-2xl border border-blue-200/90 bg-slate-50/70 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0F2557] text-white flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              AI Đánh giá Sức khỏe Dự án (Project Health Brief)
            </h4>
            <p className="text-[11px] text-slate-500">
              Tổng hợp dữ liệu Milestones, công suất FTE &amp; giờ công thực tế từ CSDL
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleAnalyze}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1E3A8A] hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer shrink-0 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          <span>{loading ? 'Đang phân tích...' : brief ? 'Phân tích lại' : 'AI Phân tích Sức khỏe'}</span>
        </button>
      </div>

      {brief && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon size={16} className={`${toneStyle.iconColor} shrink-0`} />
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${toneStyle.badge}`}>
                {brief.healthLabel}
              </span>
              <span className="text-xs font-bold text-slate-900 text-pretty">{brief.headline}</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap shrink-0">
              {brief.generatedByAi ? 'Gemini AI Engine' : 'Rule Engine Chuẩn hóa'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-[#1E3A8A] block">Đánh giá Tiến độ &amp; Milestones</span>
              <p className="text-slate-700 leading-relaxed text-pretty">{brief.scheduleAssessment}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-[#1E3A8A] block">Công suất FTE &amp; Giờ công</span>
              <p className="text-slate-700 leading-relaxed text-pretty">{brief.capacityAssessment}</p>
            </div>
          </div>

          {brief.recommendations && brief.recommendations.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Khuyến nghị điều hành
              </span>
              <ul className="space-y-1.5">
                {brief.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed text-pretty">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

