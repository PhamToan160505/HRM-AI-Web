import React from 'react';
import { Mail, Phone, MapPin, Briefcase, Calendar, User } from 'lucide-react';

export default function CandidateProfileCard({ application, extractedData }) {
  const fullName = extractedData?.fullName?.value || application?.fullName || 'Ứng viên';
  const role = extractedData?.currentRole || application?.jobPosting?.title || 'Ứng viên tiềm năng';

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
      {/* Cột trái (Avatar + Liên hệ) */}
      <div className="md:col-span-5 flex flex-col items-center text-center">
        <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4 shadow-inner border border-blue-200 overflow-hidden">
          <span className="text-4xl font-bold text-blue-600">
            {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
          </span>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800">{fullName}</h2>
        <p className="text-sm font-medium text-slate-600 mt-1 mb-6">{role}</p>

        <div className="w-full space-y-3 text-left">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Phone size={16} className="text-blue-500 shrink-0" />
            <span>{extractedData?.phone?.value || application?.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Mail size={16} className="text-blue-500 shrink-0" />
            <span className="truncate">{extractedData?.email?.value || application?.email || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <MapPin size={16} className="text-blue-500 shrink-0" />
            <span>{extractedData?.address?.value || application?.address || 'Hà Nội'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Calendar size={16} className="text-blue-500 shrink-0" />
            <span>{extractedData?.dob?.value || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <User size={16} className="text-blue-500 shrink-0" />
            <span>{extractedData?.gender?.value || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Cột phải (Học vấn + Mục tiêu) */}
      <div className="md:col-span-7 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-3">Học vấn</h3>
          {extractedData?.education && extractedData.education.length > 0 ? (
            extractedData.education.map((edu, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:justify-between text-sm mb-2">
                <span className="font-semibold text-blue-700">{edu.school || edu.institution}</span>
                <span className="text-slate-700">{edu.degree || edu.major}</span>
              </div>
            ))
          ) : (
            <div className="flex flex-col sm:flex-row sm:justify-between text-sm">
              <span className="font-semibold text-blue-700">Đại học</span>
              <span className="text-slate-700">Chưa cập nhật</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-3 mt-8">Mục tiêu nghề nghiệp</h3>
          <p className="text-sm text-slate-700 leading-relaxed text-justify">
            {extractedData?.careerObjective || 'Chưa cập nhật mục tiêu nghề nghiệp. Vui lòng xem thêm trong file CV đính kèm.'}
          </p>
        </div>
      </div>
    </div>
  );
}
