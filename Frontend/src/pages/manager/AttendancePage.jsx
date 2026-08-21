import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Download, AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';

import { useAuth } from '../../context/AuthContext';

export default function ManagerAttendancePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approvingRecord, setApprovingRecord] = useState(null);
    const [viewingRecord, setViewingRecord] = useState(null);
    const [loaiNghiPhep, setLoaiNghiPhep] = useState('NORMAL_LEAVE');
    
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'ALL');
    
    const toast = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();

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
    
    // Update URL when filter changes
    const handleFilterChange = (e) => {
        const newStatus = e.target.value;
        setFilterStatus(newStatus);
        if (newStatus === 'ALL') {
            searchParams.delete('status');
        } else {
            searchParams.set('status', newStatus);
        }
        setSearchParams(searchParams);
    };

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
    
    const getCheckoutStatusBadge = (timeOutStr) => {
        if (!timeOutStr) return <span className="text-gray-400 italic">Chưa check-out</span>;
        const [hours, minutes] = timeOutStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        
        // 16:45 = 16 * 60 + 45 = 1005
        if (totalMinutes < 1005) {
            return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Về sớm</span>;
        }
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Đúng giờ</span>;
    };
    
    const filteredRecords = records.filter(record => {
        if (filterStatus === 'PENDING') return record.isException && record.exceptionStatus === 'PENDING';
        return true; // if ALL or other unsupported filters
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Chấm công</h1>
                    <p className="text-sm text-slate-500 mt-1">Duyệt và theo dõi giờ làm việc của nhân sự trong phòng ban</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex items-center gap-2">
                        <Download size={16} /> Xuất báo cáo
                    </Button>
                </div>
            </div>

            <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl gap-4">
                    <h2 className="text-lg font-bold text-gray-800 shrink-0">Danh sách chấm công hôm nay</h2>
                    <div className="flex items-center gap-3 w-full justify-end">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Tìm nhân viên..." 
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Nhân viên</th>
                                <th className="px-6 py-4 font-semibold">Giờ vào (Check-in)</th>
                                <th className="px-6 py-4 font-semibold">Giờ ra (Check-out)</th>
                                <th className="px-6 py-4 font-semibold">TT Check-in</th>
                                <th className="px-6 py-4 font-semibold">TT Check-out</th>
                                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">Không có dữ liệu.</td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-800">{record.hoTen}</div>
                                            {record.role && (
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {record.role === 'GIAM_DOC' ? 'Giám đốc' : record.role === 'TRUONG_PHONG' ? 'Trưởng phòng' : 'Nhân viên'}
                                                </div>
                                            )}
                                        </td>
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
                                        <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                                        <td className="px-6 py-4">{getCheckoutStatusBadge(record.timeOut)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button 
                                                variant="outline" 
                                                className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                                                onClick={() => setViewingRecord(record)}
                                            >
                                                Xem chi tiết
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>


            {/* View Details Modal */}
            {viewingRecord && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Chi tiết chấm công</h3>
                            <button onClick={() => setViewingRecord(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                                    {viewingRecord.hoTen ? viewingRecord.hoTen.charAt(0) : '?'}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{viewingRecord.hoTen}</p>
                                    <p className="text-sm text-gray-500">
                                        {viewingRecord.role === 'GIAM_DOC' ? 'Giám đốc' : viewingRecord.role === 'TRUONG_PHONG' ? 'Trưởng phòng' : 'Nhân viên'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 mb-1">Giờ vào (Check-in)</p>
                                    <p className="font-mono font-semibold text-emerald-600">{viewingRecord.timeIn ? formatTime(viewingRecord.timeIn) : '--:--'}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 mb-1">Giờ ra (Check-out)</p>
                                    <p className="font-mono font-semibold text-blue-600">{viewingRecord.timeOut ? formatTime(viewingRecord.timeOut) : '--:--'}</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Trạng thái Check-in:</span>
                                    {getStatusBadge(viewingRecord.status)}
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Trạng thái Check-out:</span>
                                    {getCheckoutStatusBadge(viewingRecord.timeOut)}
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Ngoại lệ:</span>
                                    {viewingRecord.isException ? (
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${viewingRecord.exceptionStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : viewingRecord.exceptionStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {viewingRecord.exceptionStatus === 'PENDING' ? 'Đang chờ duyệt' : viewingRecord.exceptionStatus === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 italic">Không có</span>
                                    )}
                                </div>
                            </div>

                            {viewingRecord.scanHistory && (() => {
                                try {
                                    const times = JSON.parse(viewingRecord.scanHistory);
                                    if (times && times.length > 0) {
                                        return (
                                            <div className="pt-4 border-t border-gray-100">
                                                <p className="text-sm font-semibold text-gray-700 mb-2">Lịch sử quét khuôn mặt ({times.length} lần):</p>
                                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                    {times.map((t, i) => (
                                                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 font-mono">
                                                            Lần {i+1}: {formatTime(t)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                } catch(e) {}
                                return null;
                            })()}

                            {viewingRecord.isException && viewingRecord.exceptionReason && (
                                <div className="pt-4 border-t border-gray-100">
                                    <p className="text-sm font-semibold text-gray-700 mb-1">Lý do ngoại lệ:</p>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">{viewingRecord.exceptionReason}</p>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <Button variant="outline" onClick={() => setViewingRecord(null)}>Đóng</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
