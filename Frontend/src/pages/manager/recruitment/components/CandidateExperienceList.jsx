import React from 'react';
import { Briefcase } from 'lucide-react';

export default function CandidateExperienceList({ experienceList = [] }) {
  if (!experienceList || experienceList.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4">
        Kinh nghiệm làm việc
      </h3>
      
      <div className="space-y-4">
        {experienceList.map((exp, index) => (
          <div key={index} className="relative pl-4 border-l-2 border-slate-200">
            <div className="absolute w-2 h-2 bg-slate-400 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="font-medium text-slate-800">{exp.role}</h4>
                <p className="text-sm font-medium text-blue-600 mt-0.5">{exp.company}</p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                {exp.duration}
              </span>
            </div>
            {exp.description && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {exp.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
