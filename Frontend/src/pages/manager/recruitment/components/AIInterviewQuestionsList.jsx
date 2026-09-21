import React from 'react';
import { MessageSquareText } from 'lucide-react';

export default function AIInterviewQuestionsList({ questions = [] }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MessageSquareText size={20} />
        </div>
        <div>
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">Câu hỏi phỏng vấn gợi ý</h3>
            <p className="text-xs text-slate-500 mt-0.5">Dựa trên kinh nghiệm và kỹ năng của ứng viên</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {questions.map((q, index) => {
            // Check if AI generated "Câu 1:" prefix and remove it to style it properly
            const cleanQuestion = q.replace(/^Câu \d+:\s*/i, '');
            
            return (
                <div key={index} className="flex gap-4 group">
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold font-mono group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            {index + 1}
                        </div>
                    </div>
                    <div className="bg-slate-50/80 hover:bg-blue-50/50 transition-colors border border-slate-100 rounded-2xl p-4 flex-1">
                        <p className="text-[14px] leading-relaxed text-slate-700 font-medium">
                            {cleanQuestion}
                        </p>
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  );
}
