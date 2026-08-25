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
    const [confirmEnrollment, setConfirmEnrollment] = useState(null);
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

    const handleEnrollClick = async () => {
        try {
            const res = await api.get('/api/employees/me/face-status');
            if (res.data?.data?.hasEnrolled) {
                // If enrolled, show confirm modal
                setConfirmEnrollment(new Date(res.data.data.enrolledAt).toLocaleDateString('vi-VN'));
            } else {
                // If not, go straight to enroll page
                navigate('/employee/face-enroll');
            }
        } catch (error) {
            console.error("Error checking face status", error);
            navigate('/employee/face-enroll'); // fallback
        }
    };

    const proceedToEnroll = () => {
        setConfirmEnrollment(null);
        navigate('/employee/face-enroll');
    };

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

    const getCheckoutStatusBadge = (timeOut) => {
        if (!timeOut) return <span className="text-gray-400 italic">--</span>;
        const [hours, minutes] = timeOut.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        // 16:45 = 16 * 60 + 45 = 1005
        if (totalMinutes < 1005) {
            return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Về sớm</span>;
        }
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Đúng giờ</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Chấm công AI</h1>
                    <p className="text-sm text-slate-500 mt-1">Ghi nhận giờ vào/ra bằng nhận diện khuôn mặt</p>
                </div>
                <div className="flex gap-4">
                    <Button 
                        variant="outline" 
                        className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={handleEnrollClick}
                    >
                        <Camera size={18} /> Cập nhật khuôn mặt
                    </Button>
                    <Button 
                        variant="primary" 
                        className="flex items-center gap-2"
                        onClick={() => setIsPunchModalOpen(true)}
                    >
                        <Clock size={18} /> Chấm công ngay
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
                                <th className="px-6 py-4 font-semibold">TT Check-in</th>
                                <th className="px-6 py-4 font-semibold">TT Check-out</th>
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
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-emerald-600 font-semibold">{formatTime(record.timeIn)}</span>
                                                    {record.locationIn && <span className="text-xs text-gray-500 truncate max-w-[200px]" title={record.locationIn}>{record.locationIn}</span>}
                                                </div>
                                            ) : '--:--'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {record.timeOut ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-blue-600 font-semibold">{formatTime(record.timeOut)}</span>
                                                    {record.locationOut && <span className="text-xs text-gray-500 truncate max-w-[200px]" title={record.locationOut}>{record.locationOut}</span>}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Chưa check-out</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                                        <td className="px-6 py-4">{getCheckoutStatusBadge(record.timeOut)}</td>
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

            {/* Custom Confirm Modal */}
            {confirmEnrollment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-scale-up">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-4">
                            <AlertCircle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Đã có dữ liệu khuôn mặt</h3>
                        <p className="text-gray-600 mb-6">
                            Bạn đã quét khuôn mặt vào ngày <strong className="text-gray-800">{confirmEnrollment}</strong>. Bạn có chắc chắn muốn cập nhật lại không?
                        </p>
                        <div className="flex gap-3 w-full">
                            <Button variant="outline" className="flex-1" onClick={() => setConfirmEnrollment(null)}>
                                Hủy
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={proceedToEnroll}>
                                Đồng ý
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
