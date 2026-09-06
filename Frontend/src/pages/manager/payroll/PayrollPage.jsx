import React, { useState, useEffect } from 'react';
import { Download, Calculator, AlertTriangle, CheckCircle, Settings, Users, X } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { useAuth } from '../../../context/AuthContext';
import PayrollTable from '../../../components/payroll/PayrollTable';
import PayrollReportTable from '../../../components/payroll/PayrollReportTable';

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState([]);
    const [departmentSummaries, setDepartmentSummaries] = useState([]);
    const [viewingDepartment, setViewingDepartment] = useState(null); // { id, name }
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [rejectRecord, setRejectRecord] = useState(null); // For individual rejection
    const [rejectReason, setRejectReason] = useState('');
    
    const [isRejectDepartmentModalOpen, setIsRejectDepartmentModalOpen] = useState(false);
    const [rejectDepartmentReason, setRejectDepartmentReason] = useState('');
    
    const [blockedEmployees, setBlockedEmployees] = useState([]);
    const [activeTab, setActiveTab] = useState('payroll');
    
    // Config Salary State
    const [configEmployees, setConfigEmployees] = useState([]);
    const [savingConfig, setSavingConfig] = useState(false);
    
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [configReason, setConfigReason] = useState('');
    
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [salaryHistory, setSalaryHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    const toast = useToast();
    const { user } = useAuth();
    
    const isCeo = user?.role?.toUpperCase() === 'CEO';
    const isCeoOrDirector = isCeo || user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN';

    useEffect(() => {
        fetchPayrolls();
    }, [month, year]);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            
            if ((isCeo || user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN') && !viewingDepartment) {
                const endpoint = isCeo 
                    ? `/api/payroll/ceo/reports?month=${month}&year=${year}`
                    : `/api/payroll/director/reports?month=${month}&year=${year}`;
                
                const [res, deptRes, empRes] = await Promise.all([
                    api.get(endpoint),
                    api.get('/api/departments'),
                    api.get('/api/employees')
                ]);
                
                if (res.data?.success && deptRes.data?.success && empRes.data?.success) {
                    const depts = deptRes.data.data;
                    const deptMap = depts.reduce((acc, curr) => {
                        acc[curr.id] = curr.tenPhong;
                        return acc;
                    }, {});

                    const employees = empRes.data.data;
                    const empMap = employees.reduce((acc, curr) => {
                        acc[curr.id] = curr;
                        return acc;
                    }, {});
                    
                    const enrichedReports = (res.data.data || []).map(r => {
                        const sender = empMap[r.createdBy];
                        return {
                            ...r,
                            departmentName: deptMap[r.departmentId] || `Phòng ${r.departmentId}`,
                            senderName: sender ? sender.hoTen : `User ${r.createdBy}`,
                            senderRole: sender ? (sender.role === 'TRUONG_PHONG' ? 'Trưởng phòng' : sender.role === 'GIAM_DOC_PHONG_BAN' ? 'Giám đốc' : sender.role) : ''
                        };
                    });
                    setDepartmentSummaries(enrichedReports);
                }
            } else {
                const [payrollRes, empRes] = await Promise.all([
                    api.get(`/api/payroll/department?month=${month}&year=${year}`),
                    api.get('/api/employees')
                ]);
                
                if (payrollRes.data?.success && empRes.data?.success) {
                    const employees = empRes.data.data;
                    const empMap = employees.reduce((acc, curr) => {
                        acc[curr.id] = curr;
                        return acc;
                    }, {});

                    let enrichedPayrolls = (payrollRes.data.data || []).map(p => ({
                        ...p,
                        employeeName: empMap[p.employeeId]?.hoTen || `NV ${p.employeeId}`,
                        departmentId: empMap[p.employeeId]?.departmentId
                    }));

                    if ((isCeo || user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN') && viewingDepartment) {
                        enrichedPayrolls = enrichedPayrolls.filter(p => p.departmentId === viewingDepartment.id);
                    }

                    setPayrolls(enrichedPayrolls);
                }
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải dữ liệu lương.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayrolls();
    }, [viewingDepartment]);

    const handleApproveAllManager = async () => {
        if (!window.confirm("Bạn có chắc muốn duyệt lương tất cả nhân viên trong phòng ban?")) return;
        try {
            const res = await api.post(`/api/payroll/manager/approve-all?month=${month}&year=${year}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã duyệt tất cả lương", "success");
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };
    
    const handleSubmitManagerReport = async (force = false) => {
        if (!force && !window.confirm(`Bạn có chắc muốn gửi báo cáo lên Giám đốc phòng ban?`)) return;
        try {
            const res = await api.post(`/api/payroll/manager/submit-report?month=${month}&year=${year}&force=${force}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã gửi báo cáo lương lên Giám đốc phòng ban", "success");
                fetchPayrolls();
            }
        } catch (error) {
            if (error.response?.status === 409) {
                if (window.confirm(error.response.data.message)) {
                    handleSubmitManagerReport(true);
                }
            } else {
                toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
            }
        }
    };

    const handleApproveDirectorReport = async (id) => {
        if (!window.confirm("Bạn có chắc muốn duyệt báo cáo này?")) return;
        try {
            const res = await api.post(`/api/payroll/director/approve-report/${id}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã duyệt báo cáo", "success");
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };
    
    const handleSubmitDirectorReport = async () => {
        if (!window.confirm("Bạn có chắc muốn gửi báo cáo tổng hợp lên Tổng Giám đốc?")) return;
        try {
            const res = await api.post(`/api/payroll/director/submit-report?month=${month}&year=${year}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã gửi báo cáo tổng hợp", "success");
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };

    const handleApproveCeoReport = async (id) => {
        if (!window.confirm("Bạn có chắc muốn duyệt báo cáo này của phòng ban?")) return;
        try {
            const res = await api.post(`/api/payroll/ceo/approve-report/${id}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã duyệt báo cáo", "success");
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setBlockedEmployees([]);
            const res = await api.post(`/api/payroll/generate?month=${month}&year=${year}`);
            if (res.data?.success) {
                const data = res.data.data[0];
                toast.show("Thành công", `Đã tính lương cho ${data.generated.length} nhân viên`, "success");
                if (data.blocked && data.blocked.length > 0) {
                    setBlockedEmployees(data.blocked);
                }
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Không thể tính lương", "error");
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm("Bạn có chắc muốn duyệt phiếu lương này? Phiếu lương đã duyệt sẽ không thể sửa đổi.")) return;
        try {
            const res = await api.post(`/api/payroll/${id}/approve`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã duyệt lương", "success");
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Không thể duyệt", "error");
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectReason.trim()) {
            toast.show("Cảnh báo", "Vui lòng nhập lý do từ chối", "warning");
            return;
        }
        try {
            const res = await api.post(`/api/payroll/${rejectRecord.id}/reject`, { reason: rejectReason });
            if (res.data?.success) {
                toast.show("Thành công", "Đã từ chối phiếu lương", "success");
                setRejectRecord(null);
                setRejectReason('');
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };

    const handleRejectDepartmentSubmit = async () => {
        if (!rejectDepartmentReason.trim()) {
            toast.show("Cảnh báo", "Vui lòng nhập lý do từ chối báo cáo", "warning");
            return;
        }
        try {
            const res = await api.post(`/api/payroll/ceo/reject-report/${viewingDepartment.id}`, { 
                reason: rejectDepartmentReason 
            });
            if (res.data?.success) {
                toast.show("Thành công", "Đã từ chối báo cáo phòng ban", "success");
                setIsRejectDepartmentModalOpen(false);
                setRejectDepartmentReason('');
                setViewingDepartment(null);
                fetchPayrolls();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Lỗi xử lý", "error");
        }
    };

    const handleTabChange = async (tab) => {
        setActiveTab(tab);
        if (tab === 'config' && configEmployees.length === 0) {
            try {
                const res = await api.get('/api/employees');
                if (res.data?.success) {
                    const isGiamDoc = user?.role?.toUpperCase() === 'GIAM_DOC';
                    const emps = res.data.data.filter(e => isGiamDoc || e.departmentId === user?.departmentId);
                    setConfigEmployees(emps.map(e => ({
                        id: e.id,
                        hoTen: e.hoTen,
                        baseSalary: e.baseSalary || 0,
                        allowance: e.allowance || 0
                    })));
                }
            } catch (err) {
                toast.show("Lỗi", "Không thể tải danh sách nhân viên", "error");
            }
        }
    };

    const handleOpenConfirm = () => {
        setIsConfirmModalOpen(true);
        setConfigReason('');
    };

    const executeSaveConfig = async () => {
        if (!configReason.trim()) {
            toast.show("Cảnh báo", "Vui lòng nhập lý do thay đổi", "warning");
            return;
        }
        try {
            setSavingConfig(true);
            for (const emp of configEmployees) {
                await api.put(`/api/employees/${emp.id}/assignment`, {
                    baseSalary: emp.baseSalary,
                    allowance: emp.allowance,
                    reason: configReason
                });
            }
            toast.show("Thành công", "Đã cập nhật lương cho nhân viên", "success");
            setIsConfirmModalOpen(false);
        } catch (error) {
            toast.show("Lỗi", "Lỗi khi lưu lương", "error");
        } finally {
            setSavingConfig(false);
        }
    };

    const fetchSalaryHistory = async () => {
        setIsHistoryModalOpen(true);
        setLoadingHistory(true);
        try {
            const res = await api.get('/api/employees/salary-history');
            if (res.data?.success) {
                setSalaryHistory(res.data.data || []);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải lịch sử", "error");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleConfigChange = (id, field, value) => {
        setConfigEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="border-b border-gray-200 pt-2 pb-0">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">
                    {user?.role?.toUpperCase() === 'CEO' ? 'Quản lý lương toàn công ty' : 'Quản lý lương phòng ban'}
                </h1>
                <div className="flex space-x-6">
                    <button 
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payroll' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        onClick={() => handleTabChange('payroll')}
                    >
                        Bảng lương tháng
                    </button>
                    {(user?.role?.toUpperCase() === 'TRUONG_PHONG' || user?.role?.toUpperCase() === 'GIAM_DOC') && (
                        <button 
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            onClick={() => handleTabChange('config')}
                        >
                            Cấu hình lương nhân viên
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'payroll' ? (
                <>
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Tháng:</span>
                                <select 
                                    value={month} 
                                    onChange={(e) => setMonth(parseInt(e.target.value))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>Tháng {m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Năm:</span>
                                <input 
                                    type="number" 
                                    value={year} 
                                    onChange={(e) => setYear(parseInt(e.target.value))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-24 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {(user?.role?.toUpperCase() === 'TRUONG_PHONG' || user?.role?.toUpperCase() === 'GIAM_DOC') && (
                                <Button variant="primary" className="flex items-center gap-2" onClick={handleGenerate} loading={generating}>
                                    <Calculator size={16} /> Tính lương tháng {month}
                                </Button>
                            )}
                            {user?.role?.toUpperCase() === 'TRUONG_PHONG' && (
                                <>
                                    <Button variant="outline" className="flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={handleApproveAllManager}>
                                        <CheckCircle size={16} /> Duyệt tất cả nhân viên
                                    </Button>
                                    <Button variant="primary" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => handleSubmitManagerReport()}>
                                        <CheckCircle size={16} /> Tạo báo cáo gửi Giám đốc
                                    </Button>
                                </>
                            )}
                            {user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' && !viewingDepartment && (
                                <Button variant="primary" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleSubmitDirectorReport}>
                                    <CheckCircle size={16} /> Gửi báo cáo lên Tổng Giám đốc
                                </Button>
                            )}
                            <Button variant="outline" className="flex items-center gap-2 text-green-700 border-green-200 hover:bg-green-50">
                                <Download size={16} /> Xuất Excel
                            </Button>
                        </div>
                    </div>

                    {blockedEmployees.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 shadow-sm">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-red-500 mt-0.5" size={20} />
                                <div>
                                    <h3 className="font-bold text-red-800">Cảnh báo: Có nhân viên bị chặn tính lương do ngoại lệ chưa duyệt!</h3>
                                    <ul className="mt-2 space-y-1 text-sm text-red-700">
                                        {blockedEmployees.map((b, i) => (
                                            <li key={i}>• {b.hoTen} (Mã: {b.employeeId}) - Lý do: {b.reason}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-2 text-sm text-red-800 font-medium">Vui lòng duyệt/từ chối các đơn ngoại lệ của họ ở mục Chấm công trước khi tính lại lương.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Card>
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">
                                {isCeo
                                    ? `Báo cáo bảng lương toàn công ty tháng ${month}/${year}` 
                                    : user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' && !viewingDepartment
                                        ? `Báo cáo bảng lương tháng ${month}/${year}`
                                        : `Bảng lương chi tiết tháng ${month}/${year}`
                                }
                            </h2>
                        </div>
                        
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <div className="text-gray-500 font-medium">Đang tải dữ liệu...</div>
                            </div>
                        ) : (
                            (isCeo || user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN') && !viewingDepartment ? (
                                <PayrollReportTable 
                                    reports={departmentSummaries}
                                    role={user?.role}
                                    onApprove={(id) => isCeo ? handleApproveCeoReport(id) : handleApproveDirectorReport(id)}
                                    onReject={(id, name) => {
                                        setViewingDepartment({ id, name });
                                        setIsRejectDepartmentModalOpen(true);
                                    }}
                                    onViewDetail={(id, name) => setViewingDepartment({ id, name })}
                                />
                            ) : (
                                <PayrollTable 
                                    payrolls={payrolls} 
                                    role={user?.role} 
                                    onApprove={handleApprove}
                                    onReject={(record) => setRejectRecord(record)}
                                />
                            )
                        )}
                    </Card>

                    {/* CEO or Director Viewing Department Detail Modal */}
                    {(isCeo || user?.role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN') && viewingDepartment && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[40] p-4">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                                    <h3 className="font-bold text-gray-800 text-lg">Báo cáo thống kê lương tháng {month}/{year} - Phòng {viewingDepartment.name}</h3>
                                    <button onClick={() => setViewingDepartment(null)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                                    {(() => {
                                        const deptPayrolls = payrolls;
                                        const totalGross = deptPayrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
                                        const totalNet = deptPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
                                        const totalTax = deptPayrolls.reduce((sum, p) => sum + (p.thuTncn || 0), 0);
                                        const totalInsurance = deptPayrolls.reduce((sum, p) => sum + (p.bhxhAmount || 0) + (p.bhytAmount || 0) + (p.bhtnAmount || 0), 0);
                                        const totalAllowance = deptPayrolls.reduce((sum, p) => sum + (p.allowance || 0), 0);
                                        const totalPenalty = deptPayrolls.reduce((sum, p) => sum + (p.latePenalty || 0), 0);

                                        return (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                                                        <span className="text-sm font-medium text-gray-500">Tổng quỹ lương (Gross)</span>
                                                        <span className="text-2xl font-bold text-gray-800">{totalGross.toLocaleString('vi-VN')} đ</span>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl shadow-md text-white flex flex-col gap-1">
                                                        <span className="text-sm font-medium text-blue-100">Tổng chi trả thực tế (Net)</span>
                                                        <span className="text-2xl font-bold">{totalNet.toLocaleString('vi-VN')} đ</span>
                                                    </div>
                                                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                                                        <span className="text-sm font-medium text-gray-500">Tổng nhân sự</span>
                                                        <span className="text-2xl font-bold text-gray-800">{deptPayrolls.length} <span className="text-sm font-normal text-gray-500">nhân viên</span></span>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                                                    <h4 className="text-base font-semibold text-gray-800 mb-4">Chi tiết các khoản trích xuất</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
                                                            <div className="text-xs text-red-600 font-medium mb-1">Tổng Thuế TNCN</div>
                                                            <div className="text-lg font-bold text-red-700">{totalTax.toLocaleString('vi-VN')} đ</div>
                                                        </div>
                                                        <div className="p-4 bg-orange-50/50 rounded-lg border border-orange-100">
                                                            <div className="text-xs text-orange-600 font-medium mb-1">Tổng Bảo hiểm (XH, YT, TN)</div>
                                                            <div className="text-lg font-bold text-orange-700">{totalInsurance.toLocaleString('vi-VN')} đ</div>
                                                        </div>
                                                        <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                            <div className="text-xs text-emerald-600 font-medium mb-1">Tổng Phụ cấp</div>
                                                            <div className="text-lg font-bold text-emerald-700">{totalAllowance.toLocaleString('vi-VN')} đ</div>
                                                        </div>
                                                        <div className="p-4 bg-slate-100/50 rounded-lg border border-slate-200">
                                                            <div className="text-xs text-slate-600 font-medium mb-1">Phạt đi muộn/về sớm</div>
                                                            <div className="text-lg font-bold text-slate-700">{totalPenalty.toLocaleString('vi-VN')} đ</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                                    <CheckCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                                                    <div className="text-sm text-blue-800 leading-relaxed">
                                                        Báo cáo này đã được tính toán và tổng hợp bởi hệ thống dựa trên chấm công thực tế của tất cả nhân viên trong <strong>Phòng {viewingDepartment.name}</strong>. Giám đốc phòng ban đã xác nhận và trình lên để xem xét duyệt quỹ lương.
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setViewingDepartment(null)} className="px-6">Đóng</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <Card>
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center rounded-t-xl">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Thiết lập mức lương gốc</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Dữ liệu này được dùng làm cơ sở tính lương hàng tháng</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={fetchSalaryHistory} className="flex items-center gap-2">
                                <Settings size={16} /> Lịch sử thay đổi
                            </Button>
                            <Button variant="primary" onClick={handleOpenConfirm}>
                                <CheckCircle size={16} className="mr-2 inline" /> Lưu thay đổi
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white border-b border-gray-100 text-gray-500">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Nhân viên</th>
                                    <th className="px-6 py-4 font-semibold">Lương cơ bản (VNĐ)</th>
                                    <th className="px-6 py-4 font-semibold">Phụ cấp cố định (VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {configEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-800 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                {emp.hoTen.charAt(0)}
                                            </div>
                                            <div>
                                                {emp.hoTen}
                                                <div className="text-xs text-gray-400 font-normal">Mã NV: {emp.id}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="number"
                                                value={emp.baseSalary}
                                                onChange={e => handleConfigChange(emp.id, 'baseSalary', e.target.value)}
                                                className="w-48 px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all tabular-nums font-medium"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="number"
                                                value={emp.allowance}
                                                onChange={e => handleConfigChange(emp.id, 'allowance', e.target.value)}
                                                className="w-48 px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all tabular-nums font-medium text-blue-700"
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {configEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                                                    <Users className="w-6 h-6 text-gray-400" />
                                                </div>
                                                Không có nhân viên nào trong phòng ban
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {rejectRecord && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-lg">Từ chối phiếu lương</h3>
                            <button onClick={() => setRejectRecord(null)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Lý do từ chối phiếu lương của {rejectRecord.employeeName}</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all min-h-[120px] resize-none"
                                    placeholder="Nhập lý do chi tiết để nhân sự/trưởng phòng tính lại..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-6">
                                <Button variant="outline" onClick={() => setRejectRecord(null)} className="px-6">Hủy</Button>
                                <Button variant="primary" onClick={handleRejectSubmit} className="bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-600/20 border-transparent px-6">
                                    Xác nhận từ chối
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isRejectDepartmentModalOpen && viewingDepartment && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-lg">Từ chối báo cáo phòng ban</h3>
                            <button onClick={() => setIsRejectDepartmentModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Lý do từ chối báo cáo của phòng {viewingDepartment.name}</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all min-h-[120px] resize-none"
                                    placeholder="Nhập lý do từ chối để Giám đốc/Trưởng phòng ban điều chỉnh lại..."
                                    value={rejectDepartmentReason}
                                    onChange={(e) => setRejectDepartmentReason(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-6">
                                <Button variant="outline" onClick={() => setIsRejectDepartmentModalOpen(false)} className="px-6">Hủy</Button>
                                <Button variant="primary" onClick={handleRejectDepartmentSubmit} className="bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-600/20 border-transparent px-6">
                                    Xác nhận từ chối
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-lg">Xác nhận cập nhật lương</h3>
                            <button onClick={() => setIsConfirmModalOpen(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100">
                                Việc thay đổi lương cơ bản và phụ cấp sẽ tạo ra lịch sử lưu vết hệ thống. Vui lòng ghi rõ lý do.
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Lý do thay đổi <span className="text-red-500">*</span></label>
                                <textarea
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 min-h-[100px]"
                                    placeholder="Ví dụ: Tăng lương định kỳ năm 2026..."
                                    value={configReason}
                                    onChange={(e) => setConfigReason(e.target.value)}
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>Hủy</Button>
                                <Button variant="primary" onClick={executeSaveConfig} loading={savingConfig}>
                                    <CheckCircle size={16} className="mr-2 inline" /> Xác nhận lưu
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-lg">Lịch sử cấu hình lương</h3>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            {loadingHistory ? (
                                <div className="p-12 text-center">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                    <div className="text-gray-500 font-medium">Đang tải lịch sử...</div>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white border-b sticky top-0 shadow-sm z-10 text-gray-600">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Ngày cập nhật</th>
                                            <th className="px-4 py-3 font-semibold">Nhân viên</th>
                                            <th className="px-4 py-3 font-semibold">Lương CB cũ → Mới</th>
                                            <th className="px-4 py-3 font-semibold">Phụ cấp cũ → Mới</th>
                                            <th className="px-4 py-3 font-semibold">Lý do</th>
                                            <th className="px-4 py-3 font-semibold">Người duyệt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {salaryHistory.map(h => (
                                            <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {new Date(h.changeDate).toLocaleString('vi-VN')}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    {h.employeeName}
                                                </td>
                                                <td className="px-4 py-3 tabular-nums">
                                                    <span className="text-gray-500 line-through mr-2">{(h.oldBaseSalary || 0).toLocaleString()}đ</span>
                                                    <span className="text-blue-600 font-semibold">{(h.newBaseSalary || 0).toLocaleString()}đ</span>
                                                </td>
                                                <td className="px-4 py-3 tabular-nums">
                                                    <span className="text-gray-500 line-through mr-2">{(h.oldAllowance || 0).toLocaleString()}đ</span>
                                                    <span className="text-blue-600 font-semibold">{(h.newAllowance || 0).toLocaleString()}đ</span>
                                                </td>
                                                <td className="px-4 py-3 max-w-[200px] truncate" title={h.reason}>
                                                    {h.reason}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                        {h.changedByName}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {salaryHistory.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="px-4 py-12 text-center text-gray-500">Chưa có lịch sử thay đổi nào</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
