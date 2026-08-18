import React, { useState } from 'react';

export default function RecruitmentSubTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'overview', label: 'Tổng quan hồ sơ' },
    { id: 'ai-assessment', label: 'AI Đánh giá' },
    { id: 'approval', label: 'Phê duyệt & Quyết định' }
  ];

  return (
    <div className="flex border-b border-slate-200">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === tab.id 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
