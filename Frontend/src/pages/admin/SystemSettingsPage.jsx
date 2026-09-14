import React, { useState, useEffect } from 'react';
import { Save, Settings } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/settings');
      if (res.data.success) {
        setSettings(res.data.data);
        const initialForm = {};
        res.data.data.forEach(s => {
          initialForm[s.key] = s.value;
        });
        setFormData(initialForm);
      }
    } catch (error) {
      toast.error('Lỗi khi tải cấu hình hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key, description) => {
    try {
      const res = await api.post('/api/admin/settings', {
        key: key,
        value: formData[key],
        description: description
      });
      if (res.data.success) {
        toast.success(`Lưu cấu hình ${key} thành công`);
        fetchSettings();
      }
    } catch (error) {
      toast.error(`Lỗi khi lưu cấu hình ${key}`);
    }
  };

  const predefinedSettings = [
    { key: 'LATE_PENALTY_AMOUNT', label: 'Số tiền phạt đi muộn (VNĐ)', description: 'Mức tiền phạt mặc định khi nhân viên đi làm muộn', type: 'number' },
    { key: 'STANDARD_WORK_HOURS', label: 'Số giờ làm việc chuẩn/ngày', description: 'Số giờ làm việc tiêu chuẩn trong 1 ngày', type: 'number' },
    { key: 'MAX_LEAVE_DAYS', label: 'Số ngày phép tối đa', description: 'Tổng số ngày nghỉ phép tối đa trong năm', type: 'number' },
    { key: 'chatbot_sensitive_keywords', label: 'Từ khóa nhạy cảm Chatbot AI', description: 'Các từ khóa cấm Chatbot tự động lưu bộ nhớ đệm (cách nhau bằng dấu phẩy)', type: 'text' }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cấu hình hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Thay đổi các tham số động cho phần mềm</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Đang tải cấu hình...</div>
        ) : (
          <div className="space-y-6">
            {predefinedSettings.map(setting => (
              <div key={setting.key} className="flex flex-col md:flex-row md:items-end gap-4 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">{setting.label}</label>
                  <p className="text-xs text-slate-500 mb-2">{setting.description} (Key: <code className="bg-slate-100 px-1 rounded">{setting.key}</code>)</p>
                  <Input 
                    type={setting.type}
                    value={formData[setting.key] || ''} 
                    onChange={e => setFormData({ ...formData, [setting.key]: e.target.value })}
                    placeholder="Nhập giá trị..."
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={() => handleSave(setting.key, setting.description)}
                  className="flex items-center gap-2 md:mb-1"
                >
                  <Save size={16} /> Lưu thay đổi
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
