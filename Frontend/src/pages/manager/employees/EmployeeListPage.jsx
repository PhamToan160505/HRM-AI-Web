import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Filter, MoreVertical, CreditCard, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import Button from '../../../components/common/Button';
import { useToast } from '../../../components/common/Toast';
import EmployeeProfileSummary from '../../../components/employee/EmployeeProfileSummary';
import { useAuth } from '../../../context/AuthContext';
import { createPortal } from 'react-dom';

const ForcePortal = ({ children }) => {
  const [mountNode, setMountNode] = useState(null);
  useEffect(() => {
    const node = document.createElement('div');
    node.className = 'force-portal-wrapper';
    document.body.appendChild(node);
    setMountNode(node);
    return () => {
      if (document.body.contains(node)) {
        document.body.removeChild(node);
      }
    };
  }, []);
  if (!mountNode) return null;
  return createPortal(children, mountNode);
};

const EmployeeListPage = () => {
    const { role } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination & Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState("");
    const [selectedFilterDept, setSelectedFilterDept] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 5;

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [cccdImages, setCccdImages] = useState({ frontUrl: null, backUrl: null });
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({ departmentId: '', chucVu: '', baseSalary: '', allowance: '' });
    const [departments, setDepartments] = useState([]);
    const toast = useToast();

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchEmployees();
        }, 300); // debounce search
        return () => clearTimeout(delayDebounceFn);
    }, [page, searchTerm, selectedRole, selectedFilterDept]);

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
            let url = `/api/employees/paginated?page=${page}&size=${pageSize}`;
            if (searchTerm) url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
            if (selectedRole) url += `&targetRole=${selectedRole}`;
            if (selectedFilterDept) url += `&departmentId=${selectedFilterDept}`;

            const res = await api.get(url);
            if (res.data.success) {
                setEmployees(res.data.data.content);
                setTotalPages(res.data.data.totalPages);
                setTotalElements(res.data.data.totalElements);
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
            baseSalary: emp.baseSalary ? Number(emp.baseSalary).toLocaleString('vi-VN') : '',
            allowance: emp.allowance ? Number(emp.allowance).toLocaleString('vi-VN') : ''
        });
        setIsAssignModalOpen(true);
    };

    const handleCurrencyChange = (field, value) => {
        const rawValue = value.replace(/\D/g, '');
        if (rawValue === '') {
            setAssignForm(prev => ({ ...prev, [field]: '' }));
            return;
        }
        const formattedValue = Number(rawValue).toLocaleString('vi-VN');
        setAssignForm(prev => ({ ...prev, [field]: formattedValue }));
    };

    const handleSaveAssign = async () => {
        if (!assignForm.chucVu || assignForm.chucVu.trim() === '') {
            toast.show("Lỗi", "Vui lòng nhập chức vụ", "error");
            return;
        }

        const rawBaseSalary = assignForm.baseSalary.toString().replace(/\./g, '');
        const rawAllowance = assignForm.allowance.toString().replace(/\./g, '');

        if (rawBaseSalary === '' || Number(rawBaseSalary) < 0) {
            toast.show("Lỗi", "Lương cơ bản không hợp lệ (phải >= 0)", "error");
            return;
        }
        if (rawAllowance !== '' && Number(rawAllowance) < 0) {
            toast.show("Lỗi", "Phụ cấp không được là số âm", "error");
            return;
        }

        try {
            const payload = {
                ...assignForm,
                baseSalary: rawBaseSalary,
                allowance: rawAllowance
            };
            const res = await api.put(`/api/employees/${selectedEmployee.id}/assignment`, payload);
            if (res.data.success) {
                fetchEmployees();
                setIsAssignModalOpen(false);
                toast.show("Thành công", "Đã phân công thành công!", "success");
            }
        } catch(err) {
            toast.show("Lỗi", "Lỗi khi phân công", "error");
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-blue-600" /> Quản lý Nhân sự
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Quản lý hồ sơ, phòng ban và CCCD của nhân viên</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm nhân viên..." 
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                        />
                    </div>
                    {role?.toUpperCase() === 'CEO' && (
                        <select 
                            value={selectedFilterDept}
                            onChange={e => { setSelectedFilterDept(e.target.value); setPage(0); }}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer text-gray-600"
                        >
                            <option value="">Tất cả phòng ban</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.tenPhong}</option>
                            ))}
                        </select>
                    )}
                    <select 
                        value={selectedRole}
                        onChange={e => { setSelectedRole(e.target.value); setPage(0); }}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer text-gray-600"
                    >
                        <option value="">Tất cả chức vụ</option>
                        <option value="NHAN_VIEN">Nhân viên</option>
                        <option value="TRUONG_PHONG">Trưởng phòng</option>
                        {role?.toUpperCase() === 'CEO' && (
                            <option value="GIAM_DOC_PHONG_BAN">Giám đốc phòng ban</option>
                        )}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                                <th className="px-6 py-4 whitespace-nowrap">Nhân viên</th>
                                <th className="px-6 py-4 whitespace-nowrap">Phòng ban</th>
                                <th className="px-6 py-4 whitespace-nowrap">Chức vụ</th>
                                <th className="px-6 py-4 whitespace-nowrap">Số CCCD</th>
                                <th className="px-6 py-4 whitespace-nowrap">Trạng thái hồ sơ</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : employees.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 text-sm">
                                        Không tìm thấy nhân viên nào.
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => {
                                    const deptName = departments.find(d => d.id === emp.departmentId)?.tenPhong || 'Chưa có';
                                    const isProfileComplete = emp.cccdFrontPublicId && emp.cccd && emp.phone && emp.ngaySinh && emp.queQuan && emp.diaChi;

                                    return (
                                        <motion.tr 
                                            key={emp.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                            onClick={() => handleViewDetails(emp)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                                                        {emp.hoTen.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{emp.hoTen}</div>
                                                        <div className="text-xs text-gray-500">{emp.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                    {deptName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-700">{emp.chucVu || 'Chưa có'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-sm text-gray-600 gap-2">
                                                    <CreditCard size={14} className="text-gray-400" />
                                                    {maskCccd(emp.cccd)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isProfileComplete ? (
                                                    <div className="flex items-center text-green-600 text-sm gap-1.5 font-medium">
                                                        <CheckCircle2 size={16} /> Đầy đủ
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-amber-600 text-sm gap-1.5 font-medium">
                                                        <AlertCircle size={16} /> Chưa cập nhật
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenAssign(emp);
                                                    }}
                                                    className="inline-flex items-center px-3 py-1.5 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-md text-xs font-medium transition-colors"
                                                >
                                                    Phân công
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white px-6 py-4 border-t border-gray-100">
                        <div>
                            <p className="text-sm text-gray-700">
                                Hiển thị từ <span className="font-medium">{page * pageSize + 1}</span> đến <span className="font-medium">{Math.min((page + 1) * pageSize, totalElements)}</span> trong số <span className="font-medium">{totalElements}</span> nhân viên
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <span className="sr-only">Previous</span>
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPage(i)}
                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                                            ${page === i 
                                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page === totalPages - 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <span className="sr-only">Next</span>
                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Phân công (Assign) */}
            {isAssignModalOpen && (
                <ForcePortal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Phân công - {selectedEmployee?.hoTen}</h3>
                                <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                                    <select 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        value={assignForm.departmentId}
                                        onChange={e => setAssignForm({...assignForm, departmentId: e.target.value})}
                                        disabled={role?.toUpperCase() !== 'CEO'} // Chỉ CEO mới được chuyển phòng ban
                                    >
                                        <option value="">Chọn phòng ban...</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.tenPhong}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="Vd: Lập trình viên Backend..."
                                        value={assignForm.chucVu}
                                        onChange={e => setAssignForm({...assignForm, chucVu: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản (VNĐ) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="Vd: 15.000.000"
                                        value={assignForm.baseSalary}
                                        onChange={e => handleCurrencyChange('baseSalary', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phụ cấp (VNĐ)</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="Vd: 500.000"
                                        value={assignForm.allowance}
                                        onChange={e => handleCurrencyChange('allowance', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
                                <Button variant="primary" onClick={handleSaveAssign}>Lưu thay đổi</Button>
                            </div>
                        </motion.div>
                    </div>
                </ForcePortal>
            )}

            {/* Modal Chi tiết nhân viên */}
            {isDetailModalOpen && selectedEmployee && (
                <ForcePortal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden relative"
                        >
                            <button 
                                onClick={() => setIsDetailModalOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="max-h-[85vh] overflow-y-auto p-1 pb-6">
                                <EmployeeProfileSummary 
                                    profile={selectedEmployee} 
                                    cccdImages={cccdImages}
                                />
                            </div>
                        </motion.div>
                    </div>
                </ForcePortal>
            )}
        </div>
    );
};

export default EmployeeListPage;
