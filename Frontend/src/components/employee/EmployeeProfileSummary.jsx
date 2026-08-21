import React, { useState } from 'react';
import { Mail, Phone, MapPin, CalendarDays, Home, CreditCard, Building2, Briefcase, Stamp, Edit2, Save, X } from 'lucide-react';
import { Card } from '../common/Card';
import Button from '../common/Button';

export default function EmployeeProfileSummary({ profile, isEditable = false, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
      email: '',
      phone: '',
      cccd: '',
      ngaySinh: '',
      queQuan: '',
      diaChi: '',
      ngayCapCccd: '',
      noiCapCccd: '',
      soNguoiPhuThuoc: 0
  });

  if (!profile) return null;

  const handleStartEdit = () => {
      setEditData({
          email: profile.email || '',
          phone: profile.phone || '',
          cccd: profile.cccd || '',
          ngaySinh: profile.ngaySinh || '',
          queQuan: profile.queQuan || '',
          diaChi: profile.diaChi || '',
          ngayCapCccd: profile.ngayCapCccd || '',
          noiCapCccd: profile.noiCapCccd || '',
          soNguoiPhuThuoc: profile.soNguoiPhuThuoc || 0
      });
      setIsEditing(true);
  };

  const handleSave = () => {
      if (onUpdate) {
          const updates = {};
          if (editData.email.trim() !== (profile.email || '')) updates.email = editData.email.trim();
          if (editData.phone.trim() !== (profile.phone || '')) updates.phone = editData.phone.trim();
          if (editData.cccd.trim() !== (profile.cccd || '')) updates.cccd = editData.cccd.trim();
          if (editData.ngaySinh.trim() !== (profile.ngaySinh || '')) updates.ngaySinh = editData.ngaySinh.trim();
          if (editData.queQuan.trim() !== (profile.queQuan || '')) updates.queQuan = editData.queQuan.trim();
          if (editData.diaChi.trim() !== (profile.diaChi || '')) updates.diaChi = editData.diaChi.trim();
          if (editData.ngayCapCccd.trim() !== (profile.ngayCapCccd || '')) updates.ngayCapCccd = editData.ngayCapCccd.trim();
          if (editData.noiCapCccd.trim() !== (profile.noiCapCccd || '')) updates.noiCapCccd = editData.noiCapCccd.trim();
          if (parseInt(editData.soNguoiPhuThuoc) !== (profile.soNguoiPhuThuoc || 0)) updates.soNguoiPhuThuoc = parseInt(editData.soNguoiPhuThuoc) || 0;
          
          if (Object.keys(updates).length > 0) {
              onUpdate(updates);
          }
      }
      setIsEditing(false);
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-1.5 text-sm font-medium text-gray-800 transition-all outline-none";

  const renderField = (icon, label, field, type = "text", placeholder) => {
      const Icon = icon;
      return (
          <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={14} className="text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
              {isEditing ? (
                  <input 
                      type={type} 
                      className={inputClass} 
                      value={editData[field]} 
                      onChange={(e) => setEditData({...editData, [field]: e.target.value})} 
                      placeholder={placeholder} 
                  />
              ) : (
                  <div className="text-sm font-medium text-gray-800 break-words py-1 leading-relaxed">
                      {profile[field] || <span className="text-gray-400 italic font-normal">Chưa cập nhật</span>}
                  </div>
              )}
          </div>
      );
  };

  return (
    <Card>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 p-2">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-md shrink-0">
          {profile.hoTen ? profile.hoTen.split(' ').pop().charAt(0).toUpperCase() : 'U'}
        </div>
        
        <div className="flex-1 space-y-5 w-full">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{profile.hoTen || 'Chưa cập nhật tên'}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                <Briefcase size={14} /> {profile.chucVu || 'Chưa có chức vụ'}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                <Building2 size={14} /> {profile.role === 'GIAM_DOC' ? 'Toàn công ty' : (profile.departmentId ? 'Phòng ' + profile.departmentId : 'Chưa phân')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-6">
              {renderField(Mail, "Email", "email", "email", "Nhập email")}
              {renderField(Phone, "Số điện thoại", "phone", "tel", "Nhập SĐT")}
              {renderField(CreditCard, "Số CCCD", "cccd", "text", "Nhập CCCD")}
              
              {renderField(CalendarDays, "Ngày sinh", "ngaySinh", "date")}
              {renderField(Home, "Quê quán", "queQuan", "text", "Nhập quê quán")}
              {renderField(MapPin, "Nơi thường trú", "diaChi", "text", "Nhập nơi thường trú")}
              
              {renderField(CalendarDays, "Ngày cấp", "ngayCapCccd", "date")}
              {renderField(Stamp, "Nơi cấp", "noiCapCccd", "text", "Nhập nơi cấp")}
              {renderField(Home, "Số người phụ thuộc", "soNguoiPhuThuoc", "number", "0")}
          </div>
          
          {isEditable && (
              <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end gap-3">
                  {isEditing ? (
                      <>
                          <Button variant="outline" onClick={() => setIsEditing(false)} className="flex items-center gap-2">
                              <X size={16} /> Hủy
                          </Button>
                          <Button variant="primary" onClick={handleSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                              <Save size={16} /> Lưu thay đổi
                          </Button>
                      </>
                  ) : (
                      <Button variant="outline" onClick={handleStartEdit} className="flex items-center gap-2">
                          <Edit2 size={16} /> Chỉnh sửa hồ sơ
                      </Button>
                  )}
              </div>
          )}
        </div>
      </div>
    </Card>
  );
}
