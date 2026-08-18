import React from 'react';
import { GraduationCap } from 'lucide-react';

export default function CandidateEducationSection({ educationList = [] }) {
  if (!educationList || educationList.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <GraduationCap size={18} className="text-blue-600" />
        Học vấn
      </h3>
      
      <div className="space-y-4">
        {educationList.map((edu, index) => (
          <div key={index} className="relative pl-4 border-l-2 border-blue-200">
            <div className="absolute w-2 h-2 bg-blue-600 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
            <h4 className="font-medium text-slate-800">{edu.degree}</h4>
            <p className="text-sm text-slate-600 mt-0.5">{edu.school}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
