import React, { useState, useEffect } from 'react';
import { Plus, Edit2, KeyRound, Shield, Ban, CheckCircle2, UserPlus, Check, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('USERS'); // 'USERS' or 'REQUESTS'
  const toast = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    hoTen: '', email: '', password: '', role: 'NHAN_VIEN', departmentId: '', chucVu: ''
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, deptsRes, requestsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/departments'),
        api.get('/api/admin/account-requests').catch(() => ({ data: { data: [] } }))
      ]);
      if (usersRes.data.success) setUsers(usersRes.data.data);
      if (deptsRes.data.success) setDepartments(deptsRes.data.data);
      if (requestsRes.data?.success) setPendingRequests(requestsRes.data.data);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/users', {
        ...formData,
        departmentId: formData.departmentId ? parseInt(formData.departmentId) : null
      });
      if (res.data.success) {
        toast.success('Tạo tài khoản thành công');
        setIsCreateModalOpen(false);
        setFormData({ hoTen: '', email: '', password: '', role: 'NHAN_VIEN', departmentId: '', chucVu: '' });
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi tạo tài khoản');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await api.put(`/api/admin/users/${user.id}`, { active: !user.active });
      if (res.data.success) {
        toast.success(`Đã ${!user.active ? 'mở khóa' : 'khóa'} tài khoản ${user.email}`);
        fetchData();
      }
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/api/admin/users/${selectedUser.id}/reset-password`, { newPassword });
      if (res.data.success) {
        toast.success('Đặt lại mật khẩu thành công');
        setIsResetPasswordModalOpen(false);
        setNewPassword('');
        setSelectedUser(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi đặt lại mật khẩu');
    }
  };

  const handleApproveRequest = async (id) => {
    try {
      const res = await api.post(`/api/admin/account-requests/${id}/approve`);
      if (res.data.success) {
        toast.success('Duyệt thành công! Tài khoản đã được gửi qua email.');
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi duyệt yêu cầu');
    }
  };

  const handleRejectRequest = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn từ chối yêu cầu này?')) return;
    try {
      const res = await api.post(`/api/admin/account-requests/${id}/reject`);
      if (res.data.success) {
        toast.success('Đã từ chối yêu cầu.');
        fetchData();
      }
    } catch (error) {
      toast.error('Lỗi khi từ chối yêu cầu');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      ADMIN: 'bg-red-100 text-red-700',
      GIAM_DOC: 'bg-purple-100 text-purple-700',
      GIAM_DOC_PHONG: 'bg-indigo-100 text-indigo-700',
      TRUONG_PHONG: 'bg-blue-100 text-blue-700',
      NHAN_VIEN: 'bg-slate-100 text-slate-700'
    };
    return <span className={`px-2 py-1 rounded-md text-xs font-medium ${badges[role]}`}>{role}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý nhân sự và duyệt tài khoản tự động</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'USERS' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Danh sách nhân sự
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Yêu cầu chờ duyệt
            {pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'USERS' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-end">
             <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
                <Plus size={18} /> Thêm tài khoản thủ công
             </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                  <th className="p-4 font-semibold">Mã NV</th>
                  <th className="p-4 font-semibold">Họ tên / Email</th>
                  <th className="p-4 font-semibold">Phân quyền</th>
                  <th className="p-4 font-semibold">Phòng ban</th>
                  <th className="p-4 font-semibold">Trạng thái</th>
                  <th className="p-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-slate-500">Không có dữ liệu</td></tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono font-medium text-blue-600">{user.maNhanVien || 'N/A'}</td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{user.hoTen}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4 text-sm text-slate-600">
                        {user.departmentId ? departments.find(d => d.id === user.departmentId)?.tenPhong || 'N/A' : '-'}
                      </td>
                      <td className="p-4">
                        {user.active ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 size={16} /> Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-600 text-sm font-medium">
                            <Ban size={16} /> Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => { setSelectedUser(user); setIsResetPasswordModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Đổi mật khẩu"
                        >
                          <KeyRound size={18} />
                        </button>
                        <button 
                          onClick={() => handleToggleActive(user)}
                          className={`p-2 rounded-lg transition-colors ${user.active ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          title={user.active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          <Shield size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'REQUESTS' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                  <th className="p-4 font-semibold">Ngày Yêu cầu</th>
                  <th className="p-4 font-semibold">Họ tên / Email</th>
                  <th className="p-4 font-semibold">Chức vụ</th>
                  <th className="p-4 font-semibold">Phòng ban</th>
                  <th className="p-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
                ) : pendingRequests.length === 0 ? (
                  <tr><td colSpan="5" className="p-10 text-center flex flex-col items-center justify-center">
                    <UserPlus size={40} className="text-slate-300 mb-3" />
                    <p className="text-slate-500">Không có yêu cầu tạo tài khoản nào cần duyệt</p>
                  </td></tr>
                ) : (
                  pendingRequests.map(req => (
                    <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm text-slate-500">
                         {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{req.hoTen}</div>
                        <div className="text-sm text-slate-500">{req.email}</div>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-700">{req.chucVu}</td>
                      <td className="p-4 text-sm text-slate-600">
                        {req.departmentId ? departments.find(d => d.id === req.departmentId)?.tenPhong || 'N/A' : '-'}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Button 
                          variant="outline"
                          onClick={() => handleRejectRequest(req.id)}
                          className="!px-3 !py-1.5 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                        >
                          <X size={16} className="mr-1 inline" /> Từ chối
                        </Button>
                        <Button 
                          variant="primary"
                          onClick={() => handleApproveRequest(req.id)}
                          className="!px-3 !py-1.5"
                        >
                          <Check size={16} className="mr-1 inline" /> Duyệt & Tạo TK
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Thêm người dùng (Thủ công) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-800">Thêm tài khoản thủ công</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên *</label>
                  <Input required value={formData.hoTen} onChange={e => setFormData({...formData, hoTen: e.target.value})} placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@hrm.vn" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu *</label>
                  <Input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chức vụ</label>
                  <Input value={formData.chucVu} onChange={e => setFormData({...formData, chucVu: e.target.value})} placeholder="VD: Lập trình viên" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quyền hạn *</label>
                  <select 
                    required
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  >
                    <option value="NHAN_VIEN">Nhân viên</option>
                    <option value="TRUONG_PHONG">Trưởng phòng</option>
                    <option value="GIAM_DOC_PHONG">Giám đốc phòng ban</option>
                    <option value="GIAM_DOC">Tổng Giám Đốc</option>
                    <option value="ADMIN">Admin Quản trị</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban</label>
                  <select 
                    value={formData.departmentId} 
                    onChange={e => setFormData({...formData, departmentId: e.target.value})}
                    disabled={['ADMIN', 'GIAM_DOC'].includes(formData.role)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- Không thuộc phòng --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.tenPhong}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
                <Button variant="primary" type="submit">Tạo tài khoản</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi mật khẩu */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-800">Đặt lại mật khẩu</h3>
              <p className="text-sm text-slate-500 mt-1">Cho tài khoản: {selectedUser?.email}</p>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới *</label>
                <Input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => { setIsResetPasswordModalOpen(false); setSelectedUser(null); }}>Hủy</Button>
                <Button variant="primary" type="submit">Xác nhận</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
