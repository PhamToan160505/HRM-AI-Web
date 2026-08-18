import React from 'react';
import { X, BrainCircuit, TerminalSquare } from 'lucide-react';

export default function AIDecisionReasonModal({ isOpen, onClose, log }) {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-blue-600" />
            Chi tiết đánh giá của AI
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div>
            <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 text-blue-600">Lời phê / Phân tích chi tiết</h4>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
              {log.decisionReason}
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}
