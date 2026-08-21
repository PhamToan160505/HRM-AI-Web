import React, { useState, useEffect } from 'react';
import { Download, Calculator, AlertTriangle, CheckCircle, Settings, Users, X } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { useAuth } from '../../../context/AuthContext';
import PayrollTable from '../../../components/payroll/PayrollTable';

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [rejectRecord, setRejectRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
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

    useEffect(() => {
        fetchPayrolls();
    }, [month, year]);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const [payrollRes, empRes] = await Promise.all([
                api.get(`/api/payroll/department?month=${month}&year=${year}`),
                api.get('/api/employees')
            ]);
            
            if (payrollRes.data?.success && empRes.data?.success) {
                const employees = empRes.data.data;
                const empMap = employees.reduce((acc, curr) => {
                    acc[curr.id] = curr.hoTen;
                    return acc;
                }, {});

                const enrichedPayrolls = (payrollRes.data.data || []).map(p => ({
                    ...p,
                    employeeName: empMap[p.employeeId] || `NV ${p.employeeId}`
                }));

                setPayrolls(enrichedPayrolls);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách lương.", "error");
        } finally {
            setLoading(false);
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
                    {user?.role === 'GIAM_DOC' ? 'Quản lý lương' : 'Quản lý lương phòng ban'}
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
                            <h2 className="text-lg font-bold text-gray-800">Bảng lương chi tiết tháng {month}/{year}</h2>
                        </div>
                        
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <div className="text-gray-500 font-medium">Đang tải bảng lương...</div>
                            </div>
                        ) : (
                            <PayrollTable 
                                payrolls={payrolls} 
                                role={user?.role} 
                                onApprove={handleApprove}
                                onReject={(record) => setRejectRecord(record)}
                            />
                        )}
                    </Card>
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
