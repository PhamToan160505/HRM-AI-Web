import React from 'react';

export default function ApplicationAttachmentsBlock({ application }) {
  if (!application) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4">File đính kèm</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CV File */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">File CV</label>
          <div className="flex">
            <div className="flex-1 min-w-0 border border-slate-300 rounded-l-lg px-3 py-2 bg-white flex items-center">
              <span className="text-sm text-slate-600 truncate">
                {application.cvUrl ? 'CV_DinhKem.pdf' : 'Không có CV'}
              </span>
            </div>
            {application.cvUrl && (
              <a 
                href={application.cvUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center"
              >
                Mở file
              </a>
            )}
          </div>
        </div>

        {/* CCCD File */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ảnh CCCD</label>
          <div className="flex">
            <div className="flex-1 min-w-0 border border-slate-300 rounded-l-lg px-3 py-2 bg-white flex items-center">
              <span className="text-sm text-slate-600 truncate">
                {application.cccdUrl ? 'CCCD_DinhKem.jpg' : 'Không có CCCD'}
              </span>
            </div>
            {application.cccdUrl && (
              <a 
                href={application.cccdUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center"
              >
                Mở file
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
