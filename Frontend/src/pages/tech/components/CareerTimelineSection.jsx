import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { CAREER_EVENT_CONFIG, formatDateTimeVN } from '../techHelpers';

/**
 * Hiển thị Dòng thời gian Lộ trình Nghề nghiệp (Career Timeline) của một kỹ sư.
 * Tự động tải từ API /api/tech/reviews/career-timeline/{userId} khi truyền userId.
 */
export default function CareerTimelineSection({ userId, initialEvents = null }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [loading, setLoading] = useState(initialEvents == null && Boolean(userId));

  useEffect(() => {
    if (initialEvents != null) {
      setEvents(initialEvents);
      setLoading(false);
      return;
    }
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    api
      .get(`/api/tech/reviews/career-timeline/${userId}`)
      .then((res) => {
        if (!cancelled) {
          setEvents(res.data?.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, initialEvents]);

  return (
    <div className="space-y-3 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-[#1E3A8A]" />
          <span>Dòng thời gian Lộ trình Nghề nghiệp (Career Timeline) ({events.length})</span>
        </h4>
      </div>

      {loading ? (
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          <span>Đang tải dòng thời gian sự nghiệp...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="p-5 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-1">
          <TrendingUp size={24} className="mx-auto text-slate-300" />
          <p className="text-xs font-semibold text-slate-600">Chưa có cột mốc nghề nghiệp nào được ghi nhận</p>
          <p className="text-[11px] text-slate-400">
            Các sự kiện đánh giá định kỳ, nâng bậc kỹ năng, thăng chức danh hoặc tốt nghiệp Kèm cặp 1-1 sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4">
          <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((ev) => {
              const evCfg =
                CAREER_EVENT_CONFIG[ev.eventType] || CAREER_EVENT_CONFIG.REVIEW_COMPLETED;
              return (
                <div key={ev.id} className="relative space-y-1">
                  <span
                    className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white flex items-center justify-center ${evCfg.dotClass}`}
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evCfg.badgeClass}`}>
                      {evCfg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular">
                      {formatDateTimeVN(ev.eventDate)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                  {(ev.oldValue || ev.newValue) && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-white border border-slate-200/80 text-slate-700">
                      {ev.oldValue && <span className="text-slate-500">{ev.oldValue}</span>}
                      {ev.oldValue && ev.newValue && <ArrowRight size={11} className="text-blue-600" />}
                      {ev.newValue && <span className="text-[#1E3A8A] font-bold">{ev.newValue}</span>}
                    </div>
                  )}
                  {ev.note && (
                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                      {ev.note}
                    </p>
                  )}
                  {ev.actorName && (
                    <p className="text-[10px] text-slate-400">
                      Xác nhận bởi: <strong className="text-slate-600">{ev.actorName}</strong>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
