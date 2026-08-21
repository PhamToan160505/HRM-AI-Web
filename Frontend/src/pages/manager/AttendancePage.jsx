import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';

export default function ManagerAttendancePage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approvingRecord, setApprovingRecord] = useState(null);
    const [loaiNghiPhep, setLoaiNghiPhep] = useState('NORMAL_LEAVE');
    const toast = useToast();

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/attendance/department');
            if (response.data?.success) {
                setRecords(response.data.data || []);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách chấm công.", "error");
            console.error("Error fetching department attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, []);

    const handleApprove = async (status) => {
        try {
            const res = await api.patch(`/api/attendance/${approvingRecord.attendanceId}/approve-exception`, {
                status,
                loaiNghiPhep: status === 'APPROVED' ? loaiNghiPhep : null
            });
            if (res.data?.success) {
                toast.show("Thành công", status === 'APPROVED' ? "Đã duyệt đơn" : "Đã từ chối đơn", "success");
                setApprovingRecord(null);
                fetchAttendance();
            }
        } catch (error) {
            toast.show("Lỗi", error.response?.data?.message || "Không thể xử lý đơn.", "error");
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '--:--';
        return timeStr.substring(0, 5);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PRESENT': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Đúng giờ</span>;
            case 'LATE': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">Đi trễ</span>;
            case 'ABSENT': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Vắng mặt</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Chấm công</h1>
                    <p className="text-sm text-slate-500 mt-1">Duyệt và theo dõi giờ làm việc của nhân sự trong phòng ban</p>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                    <Download size={16} /> Xuất báo cáo
                </Button>
            </div>

            <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">Danh sách chấm công hôm nay</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm nhân viên..." 
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Nhân viên</th>
                                <th className="px-6 py-4 font-semibold">Giờ vào (Check-in)</th>
                                <th className="px-6 py-4 font-semibold">Giờ ra (Check-out)</th>
                                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-800">{record.hoTen}</td>
                                        <td className="px-6 py-4">
                                            {record.timeIn ? (
                                                <span className="font-mono text-emerald-600 font-semibold">{formatTime(record.timeIn)}</span>
                                            ) : '--:--'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {record.timeOut ? (
                                                <span className="font-mono text-blue-600 font-semibold">{formatTime(record.timeOut)}</span>
                                            ) : (
                                                <span className="text-gray-400 italic">Chưa check-out</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(record.status)}
                                            {record.isException && record.exceptionStatus === 'PENDING' && (
                                                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Chờ duyệt</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {record.isException && record.exceptionStatus === 'PENDING' ? (
                                                <Button 
                                                    variant="primary" 
                                                    className="px-3 py-1.5 text-xs"
                                                    onClick={() => setApprovingRecord(record)}
                                                >
                                                    Duyệt đơn
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                                                    onClick={() => toast.show('Thông báo', 'Tính năng đang được phát triển', 'info')}
                                                >
                                                    Xem chi tiết
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {approvingRecord && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Duyệt đơn xin ngoại lệ</h3>
                            <button onClick={() => setApprovingRecord(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-sm">
                                <p><span className="text-gray-500">Nhân viên:</span> <span className="font-medium text-gray-800">{approvingRecord.hoTen}</span></p>
                                <p><span className="text-gray-500">Lý do:</span> <span className="font-medium text-gray-800">{approvingRecord.exceptionReason}</span></p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Loại nghỉ phép (Bắt buộc chọn khi Duyệt)</label>
                                <select 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={loaiNghiPhep}
                                    onChange={(e) => setLoaiNghiPhep(e.target.value)}
                                >
                                    <option value="NORMAL_LEAVE">Nghỉ phép thường (1 ngày/tháng)</option>
                                    <option value="SPECIAL_WFH_LEAVE">Nghỉ làm việc tại nhà (WFH - 1 ngày/tháng)</option>
                                    <option value="HALF_DAY_LEAVE">Nghỉ nửa ngày (Trừ 0.5 ngày công)</option>
                                    <option value="UNPAID">Nghỉ không lương (Trừ 1 ngày công)</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <Button variant="outline" onClick={() => handleApprove('REJECTED')} className="text-red-600 hover:bg-red-50">
                                    Từ chối
                                </Button>
                                <Button variant="primary" onClick={() => handleApprove('APPROVED')}>
                                    Phê duyệt
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
