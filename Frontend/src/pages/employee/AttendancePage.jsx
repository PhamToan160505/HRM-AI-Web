import React, { useState, useEffect } from 'react';
import { Camera, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import FacePunchModal from './FacePunchModal';
import { useToast } from '../../components/common/Toast';
import { useNavigate } from 'react-router-dom';

export default function EmployeeAttendancePage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/attendance/me');
            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (err) {
            console.error(err);
            toast.show("Lỗi", "Không thể tải lịch sử chấm công", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatTime = (timeStr) => {
        if (!timeStr) return '--:--';
        // timeStr usually "08:30:00"
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
                    <h1 className="text-2xl font-bold text-slate-800">Chấm công AI</h1>
                    <p className="text-sm text-slate-500 mt-1">Ghi nhận giờ vào/ra bằng nhận diện khuôn mặt</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate('/employee/face-enroll')} className="flex items-center gap-2">
                        <Camera size={16} /> Cập nhật khuôn mặt
                    </Button>
                    <Button variant="primary" onClick={() => setIsPunchModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Clock size={16} /> Chấm công ngay
                    </Button>
                </div>
            </div>

            <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">Lịch sử chấm công</h2>
                    <button onClick={fetchHistory} className="text-gray-500 hover:text-blue-600 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Ngày</th>
                                <th className="px-6 py-4 font-semibold">Giờ vào (Check-in)</th>
                                <th className="px-6 py-4 font-semibold">Giờ ra (Check-out)</th>
                                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                                <th className="px-6 py-4 font-semibold">Ghi chú ngoại lệ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500 flex flex-col items-center">
                                        <Clock size={32} className="text-gray-300 mb-2" />
                                        Chưa có dữ liệu chấm công. Hãy bắt đầu bằng cách "Chấm công ngay".
                                    </td>
                                </tr>
                            ) : (
                                history.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-800">{record.date}</td>
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
                                        <td className="px-6 py-4">
                                            {record.isException ? (
                                                <div className="flex items-center gap-1.5 text-amber-600">
                                                    <AlertCircle size={14} /> {record.exceptionStatus === 'PENDING' ? 'Chờ duyệt' : 'Đã xử lý'}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isPunchModalOpen && (
                <FacePunchModal 
                    onCancel={() => setIsPunchModalOpen(false)}
                    onSuccess={() => {
                        setIsPunchModalOpen(false);
                        fetchHistory(); // Reload history after punch
                    }}
                />
            )}
        </div>
    );
}
