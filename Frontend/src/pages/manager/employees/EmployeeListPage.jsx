import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Filter, MoreVertical, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../../services/api';
import Button from '../../../components/common/Button';
import { useToast } from '../../../components/common/Toast';
import EmployeeProfileSummary from '../../../components/employee/EmployeeProfileSummary';
import { useAuth } from '../../../context/AuthContext';

const EmployeeListPage = () => {
    const { role } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState(""); // Add role filter
    const [selectedFilterDept, setSelectedFilterDept] = useState(""); // Add department filter
    const [selectedEmployee, setSelectedEmployee] = useState(null); // For detail view
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [cccdImages, setCccdImages] = useState({ frontUrl: null, backUrl: null });
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({ departmentId: '', chucVu: '', baseSalary: '', allowance: '' });
    const [departments, setDepartments] = useState([]);
    const toast = useToast();

    useEffect(() => {
        fetchEmployees();
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/api/departments');
            if (res.data.success) {
                setDepartments(res.data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/employees');
            if (res.data.success) {
                setEmployees(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const maskCccd = (cccd) => {
        if (!cccd) return "Chưa cập nhật";
        if (cccd.length <= 4) return cccd;
        return "*".repeat(cccd.length - 4) + cccd.slice(-4);
    };

    const handleViewDetails = async (emp) => {
        setSelectedEmployee(emp);
        setIsDetailModalOpen(true);
        setCccdImages({ frontUrl: null, backUrl: null });
        
        if (emp.cccdFrontPublicId) {
            try {
                const res = await api.get(`/api/employees/${emp.id}/cccd-image-url`);
                if (res.data.success) {
                    setCccdImages({ frontUrl: res.data.data.frontUrl, backUrl: res.data.data.backUrl });
                }
            } catch (err) {
                toast.show("Lỗi", "Lỗi tải ảnh CCCD", "error");
            }
        }
    };

    const handleOpenAssign = (emp) => {
        setSelectedEmployee(emp);
        setAssignForm({ 
            departmentId: emp.departmentId || '', 
            chucVu: emp.chucVu || '',
            baseSalary: emp.baseSalary || '',
            allowance: emp.allowance || ''
        });
        setIsAssignModalOpen(true);
    };

    const handleSaveAssign = async () => {
        try {
            const res = await api.put(`/api/employees/${selectedEmployee.id}/assignment`, assignForm);
            if (res.data.success) {
                setEmployees(employees.map(e => e.id === selectedEmployee.id ? { ...e, ...assignForm } : e));
                setIsAssignModalOpen(false);
                toast.show("Thành công", "Đã phân công thành công!", "success");
            }
        } catch(err) {
            toast.show("Lỗi", "Lỗi khi phân công", "error");
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const matchSearch = emp.hoTen?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = selectedRole ? emp.role === selectedRole : true;
        const matchDept = selectedFilterDept ? String(emp.departmentId) === String(selectedFilterDept) : true;
        return matchSearch && matchRole && matchDept;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-blue-600" /> Quản lý Nhân sự
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Quản lý hồ sơ, phòng ban và CCCD của nhân viên</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm nhân viên..." 
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        value={selectedFilterDept}
                        onChange={e => setSelectedFilterDept(e.target.value)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer text-gray-600"
                    >
                        <option value="">Tất cả phòng ban</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.tenPhong}</option>
                        ))}
                    </select>
                    <select 
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer text-gray-600"
                    >
                        <option value="">Tất cả chức vụ</option>
                        <option value="CEO">Tổng giám đốc (CEO)</option>
                        <option value="GIAM_DOC_PHONG_BAN">Giám đốc phòng ban</option>
                        <option value="TRUONG_PHONG">Trưởng phòng</option>
                        <option value="NHAN_VIEN">Nhân viên</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-sm text-gray-500 font-medium">
                            <th className="py-4 px-6">Nhân viên</th>
                            <th className="py-4 px-6">Phòng ban</th>
                            <th className="py-4 px-6">Chức vụ</th>
                            <th className="py-4 px-6">Số CCCD</th>
                            <th className="py-4 px-6">Trạng thái hồ sơ</th>
                            <th className="py-4 px-6 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                            </tr>
                        ) : filteredEmployees.map((emp) => (
                            <motion.tr 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                key={emp.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                onClick={() => handleViewDetails(emp)}
                            >
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        {/* Initials Avatar (No actual face image) */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                                            {emp.hoTen ? emp.hoTen.split(' ').pop().charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{emp.hoTen || 'Chưa cập nhật'}</p>
                                            <p className="text-gray-500 text-xs">{emp.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                        {emp.role === 'GIAM_DOC' ? 'Toàn công ty' : 
                                            (emp.departmentId 
                                                ? departments.find(d => d.id === emp.departmentId)?.tenPhong || `Phòng ${emp.departmentId}` 
                                                : 'Chưa xếp')}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="text-gray-700 font-medium">
                                        {emp.chucVu || 'Chưa có'}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2 text-gray-600 font-mono">
                                        <CreditCard size={14} className="text-gray-400" />
                                        {maskCccd(emp.cccd)}
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    {emp.cccd ? (
                                        <div className="flex items-center gap-1.5 text-emerald-600">
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-medium">Đã cập nhật</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-amber-500">
                                            <AlertCircle size={16} />
                                            <span className="text-xs font-medium">Chưa cập nhật</span>
                                        </div>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {emp.cccdFrontPublicId && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleViewDetails(emp); }}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                Xem chi tiết
                                            </button>
                                        )}
                                        {role !== 'ceo' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenAssign(emp); }} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors text-xs font-medium border border-blue-200">
                                                Phân công
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Assignment Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Phân công & Lương thưởng</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" 
                                    value={assignForm.departmentId} 
                                    onChange={e => setAssignForm({...assignForm, departmentId: e.target.value})} 
                                >
                                    <option value="">-- Chọn phòng ban --</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.tenPhong}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                                <input 
                                    type="text" 
                                    placeholder="VD: Nhân viên Tuyển dụng"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" 
                                    value={assignForm.chucVu} 
                                    onChange={e => setAssignForm({...assignForm, chucVu: e.target.value})} 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản (VNĐ)</label>
                                    <input 
                                        type="number" 
                                        placeholder="VD: 20000000"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" 
                                        value={assignForm.baseSalary} 
                                        onChange={e => setAssignForm({...assignForm, baseSalary: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phụ cấp (VNĐ)</label>
                                    <input 
                                        type="number" 
                                        placeholder="VD: 1000000"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" 
                                        value={assignForm.allowance} 
                                        onChange={e => setAssignForm({...assignForm, allowance: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
                            <Button variant="primary" onClick={handleSaveAssign}>Lưu</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {isDetailModalOpen && selectedEmployee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-50 rounded-xl p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto relative">
                        <button 
                            onClick={() => setIsDetailModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            &times;
                        </button>
                        <h2 className="text-xl font-bold mb-6 text-gray-900">Chi tiết nhân sự</h2>
                        
                        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
                            <EmployeeProfileSummary profile={selectedEmployee} />
                        </div>

                        {selectedEmployee.cccdFrontPublicId && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt trước CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg min-h-[200px] p-2">
                                        {cccdImages.frontUrl ? (
                                            <img src={cccdImages.frontUrl} alt="Mặt trước" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt sau CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg min-h-[200px] p-2">
                                        {cccdImages.backUrl ? (
                                            <img src={cccdImages.backUrl} alt="Mặt sau" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Đóng</Button>
                            <Button variant="primary" onClick={() => {
                                setIsDetailModalOpen(false);
                                handleOpenAssign(selectedEmployee);
                            }}>Phân công ngay</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeListPage;
