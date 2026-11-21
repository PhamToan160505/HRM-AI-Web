import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, AlertTriangle, CheckCircle, Settings, Users, X, Landmark, Info } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ConfirmModal from '../../../components/common/ConfirmModal';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { useAuth } from '../../../context/AuthContext';
import PayrollTable from '../../../components/payroll/PayrollTable';
import PayrollBatchTable, { BatchStatusBadge } from '../../../components/payroll/PayrollBatchTable';
import { REJECT_STAGE_LABEL } from '../../../utils/payrollStatus';
import { formatCurrencyVND } from '../../../utils/currency';

/**
 * Trang lương — luồng do phòng Tài chính - Kế toán điều phối:
 *   Trưởng phòng chốt công → Kế toán tính lương → GĐ phòng xác nhận
 *   → Kế toán trưởng kiểm tra → CEO chốt → Kế toán chi trả.
 * Backend trả về danh sách "actions" cho từng phòng nên trang chỉ hiển thị đúng nút người dùng được bấm.
 */
const WORKFLOW_STEPS = [
    { key: 'close', label: 'Trưởng phòng chốt công' },
    { key: 'calc', label: 'Kế toán tính lương' },
    { key: 'director', label: 'GĐ phòng xác nhận' },
    { key: 'chief', label: 'Kế toán trưởng kiểm tra' },
    { key: 'ceo', label: 'CEO chốt' },
    { key: 'pay', label: 'Kế toán chi trả' },
];

const REJECT_ACTIONS = {
    DIRECTOR_REJECT: { url: id => `/api/payroll/director/batches/${id}/reject`, title: 'Từ chối bảng lương', placeholder: 'Ví dụ: Sai số ngày công của nhân viên A...' },
    CHIEF_REJECT: { url: id => `/api/payroll/chief/batches/${id}/reject`, title: 'Trả bảng lương cho kế toán', placeholder: 'Ví dụ: Chưa cập nhật mức lương mới của nhân viên B...' },
    CEO_REJECT: { url: id => `/api/payroll/ceo/batches/${id}/reject`, title: 'Từ chối bảng lương', placeholder: 'Nhập lý do để phòng Tài chính - Kế toán điều chỉnh...' },
};

const SIMPLE_ACTIONS = {
    CLOSE_ATTENDANCE: {
        title: 'Chốt công tháng',
        message: b => `Chốt công tháng ${b.month}/${b.year} của phòng ${b.departmentName} và chuyển phòng Tài chính - Kế toán tính lương?`,
        call: b => api.post(`/api/payroll/attendance/close?month=${b.month}&year=${b.year}`),
    },
    REOPEN_ATTENDANCE: {
        title: 'Mở lại công',
        message: b => `Mở lại công tháng ${b.month}/${b.year}? Bảng lương nháp kế toán đã tính cho phòng (nếu có) sẽ bị hủy.`,
        call: b => api.post(`/api/payroll/attendance/reopen?month=${b.month}&year=${b.year}`),
    },
    SUBMIT: {
        title: 'Gửi duyệt bảng lương',
        message: b => b.hasDirector
            ? `Gửi bảng lương phòng ${b.departmentName} cho Giám đốc phòng xác nhận?`
            : `Phòng ${b.departmentName} không có Giám đốc phòng — bảng lương sẽ chuyển thẳng tới Kế toán trưởng. Tiếp tục?`,
        call: b => api.post(`/api/payroll/finance/batches/${b.id}/submit`),
    },
    DIRECTOR_CONFIRM: {
        title: 'Xác nhận bảng lương',
        message: b => `Xác nhận bảng lương tháng ${b.month}/${b.year} của phòng ${b.departmentName} (${formatCurrencyVND(b.totalNetSalary)} thực nhận)?`,
        call: b => api.post(`/api/payroll/director/batches/${b.id}/confirm`),
    },
    CHIEF_APPROVE: {
        title: 'Duyệt và gửi CEO',
        message: b => `Xác nhận đã kiểm tra bảng lương phòng ${b.departmentName} và gửi Tổng Giám đốc chốt?`,
        call: b => api.post(`/api/payroll/chief/batches/${b.id}/approve`),
    },
    CEO_APPROVE: {
        title: 'Chốt bảng lương',
        message: b => `Chốt bảng lương tháng ${b.month}/${b.year} của phòng ${b.departmentName}: ${formatCurrencyVND(b.totalNetSalary)} thực nhận cho ${b.totalEmployees} nhân sự? Sau khi chốt, kế toán sẽ tiến hành chi trả.`,
        call: b => api.post(`/api/payroll/ceo/batches/${b.id}/approve`),
    },
};

export default function PayrollPage() {
    const { user } = useAuth();
    const toast = useToast();
    const role = user?.role?.toUpperCase();
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: 'Xác nhận' });
    const [access, setAccess] = useState({ accountant: false, chiefAccountant: false });
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [busyKey, setBusyKey] = useState(null);
    const [generateResult, setGenerateResult] = useState(null);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('payroll');

    // Chi tiết kỳ lương
    const [detailBatch, setDetailBatch] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Từ chối / chi trả
    const [rejectState, setRejectState] = useState(null); // { action, batch }
    const [rejectReason, setRejectReason] = useState('');
    const [payBatch, setPayBatch] = useState(null);
    const [paymentReference, setPaymentReference] = useState('');

    // Config Salary State (giữ nguyên chức năng cấu hình lương của Trưởng phòng)
    const [configEmployees, setConfigEmployees] = useState([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [configReason, setConfigReason] = useState('');
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [salaryHistory, setSalaryHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const isCeo = role === 'CEO';
    const companyWide = isCeo || access.accountant;

    useEffect(() => {
        api.get('/api/payroll/access')
            .then(res => res.data?.success && setAccess(res.data.data))
            .catch(() => { /* Không có quyền kế toán → giữ mặc định */ });
    }, []);

    const fetchBatches = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/api/payroll/batches?month=${month}&year=${year}`);
            if (res.data?.success) setBatches(res.data.data || []);
        } catch (error) {
            toast.show('Lỗi', error.response?.data?.message || 'Không thể tải dữ liệu lương.', 'error');
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => {
        fetchBatches();
        setGenerateResult(null);
    }, [fetchBatches]);

    const runAction = async (key, fn, successMessage) => {
        try {
            setBusyKey(key);
            const res = await fn();
            toast.show('Thành công', res?.data?.message || successMessage, 'success');
            await fetchBatches();
            return true;
        } catch (error) {
            toast.show('Lỗi', error.response?.data?.message || 'Không thể thực hiện thao tác', 'error');
            return false;
        } finally {
            setBusyKey(null);
        }
    };

    const handleGenerateAll = async (departmentId = null) => {
        try {
            setGenerating(true);
            const qs = `month=${month}&year=${year}${departmentId ? `&departmentId=${departmentId}` : ''}`;
            const res = await api.post(`/api/payroll/finance/generate?${qs}`);
            if (res.data?.success) {
                const data = res.data.data;
                setGenerateResult(data);
                const count = data.generated?.length || 0;
                toast.show(count ? 'Thành công' : 'Chưa có phòng nào được tính',
                    count ? `Đã tính lương cho ${count} phòng ban` : 'Các phòng chưa chốt công hoặc đang trong quy trình duyệt',
                    count ? 'success' : 'warning');
                fetchBatches();
            }
        } catch (error) {
            toast.show('Lỗi', error.response?.data?.message || 'Không thể tính lương', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const openDetail = async (batch) => {
        setDetailBatch(batch);
        setDetailItems([]);
        setLoadingDetail(true);
        try {
            const res = await api.get(`/api/payroll/batches/${batch.id}/items`);
            if (res.data?.success) setDetailItems(res.data.data || []);
        } catch (error) {
            toast.show('Lỗi', error.response?.data?.message || 'Không thể tải chi tiết bảng lương', 'error');
        } finally {
            setLoadingDetail(false);
        }
    };

    const downloadBankFile = async (batch) => {
        try {
            setBusyKey(`${batch.departmentId}:DOWNLOAD_BANK_FILE`);
            const res = await api.get(`/api/payroll/finance/batches/${batch.id}/bank-file`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `chi-luong-${batch.departmentName}-${batch.month}-${batch.year}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.show('Lỗi', 'Không thể tải file chi lương', 'error');
        } finally {
            setBusyKey(null);
        }
    };

    const handleAction = (action, batch) => {
        const key = `${batch.departmentId}:${action}`;
        if (action === 'VIEW_ITEMS') return openDetail(batch);
        if (action === 'DOWNLOAD_BANK_FILE') return downloadBankFile(batch);
        if (action === 'GENERATE') return handleGenerateAll(batch.departmentId);
        if (action === 'MARK_PAID') {
            setPayBatch(batch);
            setPaymentReference('');
            return;
        }
        if (REJECT_ACTIONS[action]) {
            setRejectState({ action, batch });
            setRejectReason('');
            return;
        }
        const def = SIMPLE_ACTIONS[action];
        if (!def) return;
        setConfirmDialog({
            isOpen: true,
            title: def.title,
            message: def.message(batch),
            onConfirm: () => runAction(key, () => def.call(batch)),
        });
    };

    const submitReject = async () => {
        if (!rejectReason.trim()) {
            toast.show('Cảnh báo', 'Vui lòng nhập lý do', 'warning');
            return;
        }
        const { action, batch } = rejectState;
        const ok = await runAction(`${batch.departmentId}:${action}`,
            () => api.post(REJECT_ACTIONS[action].url(batch.id), { reason: rejectReason.trim() }));
        if (ok) setRejectState(null);
    };

    const submitPay = async () => {
        const batch = payBatch;
        const ok = await runAction(`${batch.departmentId}:MARK_PAID`,
            () => api.post(`/api/payroll/finance/batches/${batch.id}/pay`, { paymentReference }));
        if (ok) setPayBatch(null);
    };

    const handleTabChange = async (tab) => {
        setActiveTab(tab);
        if (tab === 'config' && configEmployees.length === 0) {
            try {
                const res = await api.get('/api/employees');
                if (res.data?.success) {
                    const isGiamDoc = role === 'GIAM_DOC';
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

    // Số liệu tổng hợp
    const closedCount = batches.filter(b => b.status !== 'OPEN' && b.status !== 'ATTENDANCE_REOPENED').length;
    const paidCount = batches.filter(b => b.status === 'PAID').length;
    const totalNet = batches.reduce((s, b) => s + (b.totalNetSalary || 0), 0);
    const waitingOnMe = batches.filter(b => (b.actions || []).some(a => a !== 'VIEW_ITEMS' && a !== 'DOWNLOAD_BANK_FILE')).length;

    const title = access.accountant
        ? 'Kế toán lương toàn công ty'
        : isCeo ? 'Bảng lương toàn công ty' : 'Lương phòng ban';

    return (
        <div className="space-y-6 pb-10">
            <div className="border-b border-gray-200 pt-2 pb-0">
                <h1 className="text-2xl font-bold text-slate-800 mb-1">{title}</h1>
                <p className="text-sm text-slate-500 mb-5">
                    {access.accountant
                        ? 'Tính lương cho các phòng đã chốt công, gửi duyệt và chi trả.'
                        : 'Bảng lương do phòng Tài chính - Kế toán tính dựa trên bảng công đã chốt.'}
                </p>
                <div className="flex space-x-6">
                    <button
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payroll' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        onClick={() => handleTabChange('payroll')}
                    >
                        Bảng lương tháng
                    </button>
                    {(role === 'TRUONG_PHONG' || role === 'GIAM_DOC') && (
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
                    <div className="flex flex-wrap gap-3 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Tháng:</span>
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(parseInt(e.target.value))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>Tháng {m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Năm:</span>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-24 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {access.accountant && (
                            <Button variant="primary" leadingIcon={<Calculator size={16} />} onClick={() => handleGenerateAll()} loading={generating}>
                                Tính lương các phòng đã chốt công
                            </Button>
                        )}
                    </div>

                    {/* Quy trình */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 overflow-x-auto">
                        <ol className="flex items-center gap-2 text-xs font-medium text-slate-600 min-w-max">
                            {WORKFLOW_STEPS.map((s, i) => (
                                <li key={s.key} className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">{i + 1}</span>
                                    <span>{s.label}</span>
                                    {i < WORKFLOW_STEPS.length - 1 && <span className="text-slate-300 mx-1">→</span>}
                                </li>
                            ))}
                        </ol>
                    </div>

                    {companyWide && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-medium text-gray-500">Phòng đã chốt công</div>
                                <div className="text-2xl font-bold text-gray-800 mt-1">{closedCount}<span className="text-sm font-normal text-gray-400"> / {batches.length}</span></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-medium text-gray-500">Cần bạn xử lý</div>
                                <div className="text-2xl font-bold text-amber-600 mt-1">{waitingOnMe}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-medium text-gray-500">Đã chi trả</div>
                                <div className="text-2xl font-bold text-emerald-600 mt-1">{paidCount}<span className="text-sm font-normal text-gray-400"> phòng</span></div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-md text-white">
                                <div className="text-xs font-medium text-blue-100">Tổng thực nhận đã tính</div>
                                <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrencyVND(totalNet)}</div>
                            </div>
                        </div>
                    )}

                    {access.accountant === false && access.financeDepartmentConfigured === false && isCeo && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex gap-2">
                            <Info size={18} className="shrink-0" />
                            Hệ thống chưa có phòng "{access.financeDepartmentName}". Hãy tạo phòng này để kế toán tính và chi lương.
                        </div>
                    )}

                    {generateResult && (generateResult.skipped?.length > 0 || generateResult.blocked?.length > 0 || generateResult.warnings?.length > 0) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={20} />
                                <div className="text-sm text-amber-900 space-y-2">
                                    {generateResult.skipped?.length > 0 && (
                                        <div>
                                            <div className="font-semibold">Phòng chưa được tính lương:</div>
                                            <ul className="mt-1 space-y-0.5">
                                                {generateResult.skipped.map(s => (
                                                    <li key={s.departmentId}>• {s.departmentName}: {s.reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {generateResult.warnings?.length > 0 && (
                                        <div>
                                            <div className="font-semibold">Cần kiểm tra trước khi gửi duyệt:</div>
                                            <ul className="mt-1 space-y-0.5">
                                                {generateResult.warnings.map(w => (
                                                    <li key={w.employeeId}>• {w.hoTen} ({w.departmentName}): {w.reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {generateResult.blocked?.length > 0 && (
                                        <div>
                                            <div className="font-semibold">Nhân viên bị bỏ qua:</div>
                                            <ul className="mt-1 space-y-0.5">
                                                {generateResult.blocked.map(b => (
                                                    <li key={b.employeeId}>• {b.hoTen}: {b.reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setGenerateResult(null)} className="ml-auto text-amber-500 hover:text-amber-700"><X size={16} /></button>
                            </div>
                        </div>
                    )}

                    <Card>
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                            <h2 className="text-lg font-bold text-gray-800">Kỳ lương tháng {month}/{year}</h2>
                        </div>
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <div className="text-gray-500 font-medium">Đang tải dữ liệu...</div>
                            </div>
                        ) : (
                            <PayrollBatchTable batches={batches} onAction={handleAction} busyKey={busyKey} />
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

            {/* Chi tiết kỳ lương */}
            {detailBatch && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[40] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Bảng lương tháng {detailBatch.month}/{detailBatch.year} — Phòng {detailBatch.departmentName}</h3>
                                <div className="mt-1"><BatchStatusBadge status={detailBatch.status} /></div>
                            </div>
                            <button onClick={() => setDetailBatch(null)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                            {(() => {
                                const sum = (f) => detailItems.reduce((s, p) => s + (f(p) || 0), 0);
                                const tiles = [
                                    { label: 'Tổng gross', value: sum(p => p.grossSalary) },
                                    { label: 'Tổng thực nhận', value: sum(p => p.netSalary), highlight: true },
                                    { label: 'Thuế TNCN', value: sum(p => p.thuTncn) },
                                    { label: 'Bảo hiểm NLĐ đóng', value: sum(p => (p.bhxhAmount || 0) + (p.bhytAmount || 0) + (p.bhtnAmount || 0)) },
                                ];
                                return (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {tiles.map(t => (
                                            <div key={t.label} className={t.highlight
                                                ? 'bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-md'
                                                : 'bg-white p-4 rounded-xl border border-gray-100 shadow-sm'}>
                                                <div className={`text-xs font-medium ${t.highlight ? 'text-blue-100' : 'text-gray-500'}`}>{t.label}</div>
                                                <div className="text-lg font-bold mt-1 tabular-nums">{formatCurrencyVND(t.value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                                <h4 className="text-sm font-semibold text-gray-800 mb-3">Lịch sử xử lý</h4>
                                <ul className="grid md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-slate-600">
                                    {[
                                        ['Chốt công', detailBatch.attendanceClosedByName, detailBatch.attendanceClosedAt],
                                        ['Kế toán tính lương', detailBatch.generatedByName, detailBatch.generatedAt],
                                        ['Gửi duyệt', detailBatch.submittedByName, detailBatch.submittedAt],
                                        ['GĐ phòng xác nhận', detailBatch.directorConfirmedByName, detailBatch.directorConfirmedAt],
                                        ['Kế toán trưởng kiểm tra', detailBatch.chiefReviewedByName, detailBatch.chiefReviewedAt],
                                        ['CEO chốt', detailBatch.ceoApprovedByName, detailBatch.ceoApprovedAt],
                                        ['Chi trả', detailBatch.paidByName, detailBatch.paidAt],
                                    ].map(([label, who, at]) => (
                                        <li key={label} className="flex justify-between gap-4">
                                            <span className={at ? 'text-slate-700' : 'text-slate-400'}>{at ? '✓' : '○'} {label}</span>
                                            <span className="text-slate-500 text-xs">{at ? `${who || ''} · ${new Date(at).toLocaleString('vi-VN')}` : '—'}</span>
                                        </li>
                                    ))}
                                </ul>
                                {detailBatch.status === 'REJECTED' && detailBatch.rejectionReason && (
                                    <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
                                        Bị từ chối bởi {REJECT_STAGE_LABEL[detailBatch.rejectedStage] || 'người duyệt'}
                                        {detailBatch.rejectedByName ? ` (${detailBatch.rejectedByName})` : ''}: {detailBatch.rejectionReason}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                                {loadingDetail ? (
                                    <div className="p-10 text-center text-gray-500">Đang tải chi tiết...</div>
                                ) : (
                                    <PayrollTable payrolls={detailItems} />
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setDetailBatch(null)} className="px-6">Đóng</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Từ chối */}
            {rejectState && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-lg">{REJECT_ACTIONS[rejectState.action].title}</h3>
                            <button onClick={() => setRejectState(null)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <label className="block text-sm font-semibold text-slate-700">
                                Lý do — phòng {rejectState.batch.departmentName} <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all min-h-[120px] resize-none"
                                placeholder={REJECT_ACTIONS[rejectState.action].placeholder}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Bảng lương sẽ được trả về phòng Tài chính - Kế toán để tính lại.</p>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setRejectState(null)} className="px-6">Hủy</Button>
                                <Button variant="danger" onClick={submitReject} loading={busyKey === `${rejectState.batch.departmentId}:${rejectState.action}`} className="px-6">
                                    Xác nhận từ chối
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chi trả */}
            {payBatch && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Landmark size={18} /> Xác nhận đã chi lương</h3>
                            <button onClick={() => setPayBatch(null)} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900">
                                Phòng <strong>{payBatch.departmentName}</strong> · {payBatch.totalEmployees} nhân sự ·
                                tổng chi <strong>{formatCurrencyVND(payBatch.totalNetSalary)}</strong>
                            </div>
                            <p className="text-sm text-slate-600">
                                Chỉ bấm xác nhận sau khi lệnh chuyển khoản đã được ngân hàng thực hiện.
                                Hệ thống sẽ khóa bảng lương và gửi phiếu lương cho từng nhân viên.
                            </p>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mã chứng từ / số lệnh chuyển khoản</label>
                                <input
                                    value={paymentReference}
                                    maxLength={100}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder="Ví dụ: UNC-2026-11-001"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setPayBatch(null)} className="px-6">Hủy</Button>
                                <Button variant="primary" onClick={submitPay} loading={busyKey === `${payBatch.departmentId}:MARK_PAID`} leadingIcon={<CheckCircle size={16} />}>
                                    Xác nhận đã chi
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

            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type="warning"
            />
        </div>
    );
}
