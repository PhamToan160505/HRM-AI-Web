import React from 'react';
import { Star, FileText } from 'lucide-react';

export default function AIFitScoreCard({ fitScore, decisionLog, onOpenReasonModal }) {
  const isHighMatch = fitScore >= 80;
  const isMediumMatch = fitScore >= 50 && fitScore < 80;
  
  const scoreColor = isHighMatch ? 'text-emerald-600' : isMediumMatch ? 'text-amber-600' : 'text-rose-600';
  const bgColor = isHighMatch ? 'bg-emerald-50 border-emerald-200' : isMediumMatch ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
  const progressBg = isHighMatch ? 'bg-emerald-500' : isMediumMatch ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className={`rounded-xl shadow-sm border p-5 ${bgColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Star size={20} className={`${scoreColor} fill-current`} />
          Điểm Phù Hợp (AI)
        </h3>
        <div className="text-3xl font-black text-slate-800">
          {fitScore}<span className="text-lg text-slate-500 font-medium">/100</span>
        </div>
      </div>
      
      <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-200 mb-4">
        <div className={`h-full rounded-full transition-all duration-1000 ${progressBg}`} style={{ width: `${fitScore}%` }}></div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {isHighMatch ? 'Rất phù hợp với JD' : isMediumMatch ? 'Phù hợp một phần' : 'Không phù hợp'}
        </p>
        {decisionLog && (
          <button 
            onClick={() => onOpenReasonModal(decisionLog)}
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium bg-white px-2 py-1 rounded shadow-sm border border-slate-200"
          >
            <FileText size={14} />
            Xem lý do AI
          </button>
        )}
      </div>
    </div>
  );
}
