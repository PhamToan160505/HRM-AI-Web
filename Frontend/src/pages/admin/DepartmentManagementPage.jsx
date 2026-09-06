import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Lock, Unlock, Search } from 'lucide-react';
import { useToast } from '../../components/common/Toast';
import api from '../../services/api';

export default function DepartmentManagementPage() {
  const { show } = useToast();
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [currentDept, setCurrentDept] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({ tenPhong: '', moTa: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/departments');
      if (res.data.success) {
        setDepartments(res.data.data);
      }
    } catch (error) {
      show('Lỗi', 'Không thể tải danh sách phòng ban', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDepartments = departments.filter(d => 
    d.tenPhong.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.moTa && d.moTa.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ tenPhong: '', moTa: '' });
    setCurrentDept(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept) => {
    setModalMode('edit');
    setFormData({ tenPhong: dept.tenPhong, moTa: dept.moTa || '' });
    setCurrentDept(dept);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        await api.post('/api/departments', formData);
        show('Thành công', 'Đã thêm phòng ban mới', 'success');
      } else {
        await api.put(`/api/departments/${currentDept.id}`, formData);
        show('Thành công', 'Đã cập nhật phòng ban', 'success');
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (error) {
      show('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLock = async (dept) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${dept.isLock ? 'mở khóa' : 'khóa'} phòng ban ${dept.tenPhong}?`)) return;
    
    try {
      const res = await api.put(`/api/departments/${dept.id}/toggle-lock`);
      show('Thành công', res.data.message, 'success');
      fetchDepartments();
    } catch (error) {
      show('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý phòng ban</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách và trạng thái các phòng ban trong hệ thống</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Thêm phòng ban
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm phòng ban..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Tên phòng ban</th>
                <th className="px-6 py-4 font-semibold">Mô tả</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    Không tìm thấy phòng ban nào
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{dept.tenPhong}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-500 max-w-xs truncate">{dept.moTa || <span className="italic text-slate-400">Không có mô tả</span>}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        dept.isLock 
                          ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        {dept.isLock ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditModal(dept)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => toggleLock(dept)}
                          className={`p-1 transition-colors ${
                            dept.isLock ? 'text-emerald-500 hover:text-emerald-700' : 'text-rose-500 hover:text-rose-700'
                          }`}
                          title={dept.isLock ? 'Mở khóa' : 'Khóa'}
                        >
                          {dept.isLock ? <Unlock size={16} /> : <Lock size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm/Sửa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative z-10 animate-fade-in-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {modalMode === 'add' ? 'Thêm phòng ban mới' : 'Cập nhật phòng ban'}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Tên phòng ban <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tenPhong}
                  onChange={(e) => setFormData({ ...formData, tenPhong: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  placeholder="Nhập tên phòng ban"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  rows={3}
                  value={formData.moTa}
                  onChange={(e) => setFormData({ ...formData, moTa: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  placeholder="Mô tả chức năng phòng ban"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {modalMode === 'add' ? 'Thêm mới' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
