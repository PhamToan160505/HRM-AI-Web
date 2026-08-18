import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, CreditCard, AlertTriangle, MapPin, Globe } from 'lucide-react';

export default function ApplicationPersonalInfoForm({ application, mode = 'manager', onSave, initialData }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cccd: '',
    dob: '',
    gender: '',
    nation: '',
    nationality: '',
    religion: '',
    address: ''
  });
  
  const [confidences, setConfidences] = useState({});

  useEffect(() => {
    // Nếu có initialData (từ OCR ở bước public)
    let extracted = initialData;
    
    // Nếu có application (ở bước manager view)
    if (application && application.extractedData) {
      try {
        extracted = typeof application.extractedData === 'string' 
          ? JSON.parse(application.extractedData) 
          : application.extractedData;
      } catch (e) {
        console.error("Lỗi parse JSON extractedData", e);
      }
    }

    if (extracted) {
      setFormData({
        fullName: extracted.fullName?.value || application?.fullName || '',
        email: extracted.email?.value || application?.email || '',
        phone: extracted.phone?.value || application?.phone || '',
        cccd: extracted.cccd?.value || '',
        dob: extracted.dob?.value || '',
        gender: extracted.gender?.value || '',
        nation: extracted.nation?.value || '',
        nationality: extracted.nationality?.value || '',
        religion: extracted.religion?.value || '',
        address: extracted.address?.value || application?.address || ''
      });
      
      setConfidences({
        fullName: extracted.fullName?.confidence || 100,
        email: extracted.email?.confidence || 100,
        phone: extracted.phone?.confidence || 100,
        cccd: extracted.cccd?.confidence || 100,
        dob: extracted.dob?.confidence || 100,
        gender: extracted.gender?.confidence || 100,
        nation: extracted.nation?.confidence || 100,
        nationality: extracted.nationality?.confidence || 100,
        religion: extracted.religion?.confidence || 100,
        address: extracted.address?.confidence || 100
      });
    } else if (application) {
      // Fallback
      setFormData({
        fullName: application.fullName || '',
        email: application.email || '',
        phone: application.phone || '',
        cccd: '',
        dob: '',
        gender: '',
        nation: '',
        nationality: '',
        religion: '',
        address: application.address || ''
      });
    }
  }, [application, initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isEditable = mode === 'public' || mode === 'edit';

  const renderField = (name, label, icon, type = "text") => {
    const confidence = confidences[name];
    const isLowConfidence = confidence !== undefined && confidence < 80;

    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
          {label}
          {isLowConfidence && mode === 'manager' && (
            <span className="flex items-center gap-1 text-amber-600 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`AI Confidence: ${confidence}%`}>
              <AlertTriangle size={10} />
              Cần kiểm tra
            </span>
          )}
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
          <input 
            type={type}
            name={name}
            value={formData[name]}
            onChange={handleChange}
            readOnly={!isEditable}
            className={`w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              isLowConfidence && mode === 'manager' ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
            } ${!isEditable && 'opacity-80'}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800">Thông tin cá nhân</h3>
        {mode === 'public' && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">Vui lòng kiểm tra lại thông tin AI trích xuất</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {renderField('fullName', 'Họ và tên', <User size={16} />)}
        {renderField('dob', 'Ngày sinh', <Calendar size={16} />)}
        {renderField('gender', 'Giới tính', <User size={16} />)}
        {renderField('email', 'Email', <Mail size={16} />, 'email')}
        {renderField('phone', 'SĐT', <Phone size={16} />)}
        {renderField('cccd', 'CCCD', <CreditCard size={16} />)}
        
        {renderField('nation', 'Dân tộc', <Globe size={16} />)}
        {renderField('nationality', 'Quốc tịch', <Globe size={16} />)}
        {renderField('religion', 'Tôn giáo', <Globe size={16} />)}
        {renderField('address', 'Địa chỉ', <MapPin size={16} />)}
      </div>

      {mode === 'public' && onSave && (
        <div className="mt-6 flex justify-end">
          <button 
            type="button"
            onClick={() => onSave(formData)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Xác nhận thông tin
          </button>
        </div>
      )}
    </div>
  );
}
