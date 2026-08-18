import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function AIFraudFlagCard({ isFraud, decisionLog, onOpenReasonModal }) {
  if (!isFraud) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-emerald-600" />
        </div>
        <div>
          <h4 className="font-semibold text-emerald-800">CV An toàn</h4>
          <p className="text-sm text-emerald-600">AI không phát hiện dấu hiệu gian lận nào.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
        <ShieldAlert size={20} className="text-rose-600" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-rose-800">Phát hiện Dấu hiệu Gian lận!</h4>
          {decisionLog && (
            <button 
              onClick={() => onOpenReasonModal(decisionLog)}
              className="text-xs font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 px-2 py-1 rounded transition-colors"
            >
              Chi tiết
            </button>
          )}
        </div>
        <p className="text-sm text-rose-700 mt-1">
          Hệ thống phát hiện những điểm bất thường trong lịch sử làm việc hoặc kỹ năng. Vui lòng xác minh kỹ!
        </p>
      </div>
    </div>
  );
}
