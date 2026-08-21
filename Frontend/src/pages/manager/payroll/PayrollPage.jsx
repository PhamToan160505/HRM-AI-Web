import React, { useState, useEffect } from 'react';
import { Download, Calculator, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
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
    
    // Config Salary Modal
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [configEmployees, setConfigEmployees] = useState([]);
    const [savingConfig, setSavingConfig] = useState(false);
    
    const toast = useToast();
    const { user } = useAuth();

    useEffect(() => {
        fetchPayrolls();
    }, [month, year]);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/payroll/department?month=${month}&year=${year}`);
            if (response.data?.success) {
                setPayrolls(response.data.data || []);
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

    const handleOpenConfig = async () => {
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
                setIsConfigModalOpen(true);
            }
        } catch (err) {
            toast.show("Lỗi", "Không thể tải danh sách nhân viên", "error");
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSavingConfig(true);
            for (const emp of configEmployees) {
                await api.put(`/api/employees/${emp.id}/assignment`, {
                    baseSalary: emp.baseSalary,
                    allowance: emp.allowance
                });
            }
            toast.show("Thành công", "Đã cập nhật lương cho nhân viên", "success");
            setIsConfigModalOpen(false);
        } catch (error) {
            toast.show("Lỗi", "Lỗi khi lưu lương", "error");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleConfigChange = (id, field, value) => {
        setConfigEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {user?.role === 'GIAM_DOC' ? 'Phê duyệt lương' : 'Bảng lương phòng ban'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Quản lý và xét duyệt lương tháng {month}/{year}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={month} 
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                        {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>Tháng {m}</option>
                        ))}
                    </select>
                    <input 
                        type="number" 
                        value={year} 
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-24"
                    />
                    {(user?.role?.toUpperCase() === 'TRUONG_PHONG' || user?.role?.toUpperCase() === 'GIAM_DOC') && (
                        <>
                            <Button variant="outline" className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleOpenConfig}>
                                <Settings size={16} /> Thiết lập lương
                            </Button>
                            <Button variant="primary" className="flex items-center gap-2" onClick={handleGenerate} loading={generating}>
                                <Calculator size={16} /> Tính lương
                            </Button>
                        </>
                    )}
                    <Button variant="outline" className="flex items-center gap-2">
                        <Download size={16} /> Xuất Excel
                    </Button>
                </div>
            </div>

            {blockedEmployees.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">Bảng lương chi tiết</h2>
                </div>
                
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải bảng lương...</div>
                ) : (
                    <PayrollTable 
                        payrolls={payrolls} 
                        role={user?.role} 
                        onApprove={handleApprove}
                        onReject={(record) => setRejectRecord(record)}
                    />
                )}
            </Card>

            {rejectRecord && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Từ chối phiếu lương</h3>
                            <button onClick={() => setRejectRecord(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Lý do từ chối</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[100px]"
                                    placeholder="Nhập lý do chi tiết..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <Button variant="outline" onClick={() => setRejectRecord(null)}>Hủy</Button>
                                <Button variant="primary" onClick={handleRejectSubmit} className="bg-red-600 hover:bg-red-700 focus:ring-red-500">Xác nhận từ chối</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isConfigModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="font-bold text-gray-800">Thiết lập mức lương nhân viên</h3>
                            <button onClick={() => setIsConfigModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white border-b sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-600">Nhân viên</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600">Lương cơ bản (VNĐ)</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600">Phụ cấp (VNĐ)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {configEmployees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-gray-800">{emp.hoTen}</td>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="number"
                                                    value={emp.baseSalary}
                                                    onChange={e => handleConfigChange(emp.id, 'baseSalary', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="number"
                                                    value={emp.allowance}
                                                    onChange={e => handleConfigChange(emp.id, 'allowance', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {configEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-4 py-8 text-center text-gray-500">Không có nhân viên nào</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Hủy</Button>
                            <Button variant="primary" onClick={handleSaveConfig} loading={savingConfig}>Lưu thay đổi</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
