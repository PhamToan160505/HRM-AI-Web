import React from 'react';
import { MessageSquareText } from 'lucide-react';

export default function AIInterviewQuestionsList({ questions = [] }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquareText size={18} className="text-indigo-600" />
        <h3 className="font-semibold text-slate-800">Câu hỏi phỏng vấn (AI Gợi ý)</h3>
        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-auto">Gemini Generated</span>
      </div>
      
      <div className="space-y-3">
        {questions.map((q, index) => (
          <div key={index} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-800">Câu {index + 1}: {q}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
