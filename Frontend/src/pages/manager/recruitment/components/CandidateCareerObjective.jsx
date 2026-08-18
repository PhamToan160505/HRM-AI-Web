import React from 'react';
import { Target } from 'lucide-react';

export default function CandidateCareerObjective({ objective }) {
  if (!objective) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <Target size={18} className="text-blue-600" />
        Mục tiêu nghề nghiệp
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-blue-200 pl-4 py-1">
        "{objective}"
      </p>
    </div>
  );
}
