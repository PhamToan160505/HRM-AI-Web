import React, { useState, useEffect } from 'react';
import { Camera, Clock, CheckCircle, AlertCircle, RefreshCw, Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import FacePunchModal from '../employee/FacePunchModal';
import { useToast } from '../../components/common/Toast';
import { useNavigate } from 'react-router-dom';
import { requestService } from '../../services/request.service';

export default function DirectorMyAttendancePage() {
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'table'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [history, setHistory] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
    const [confirmEnrollment, setConfirmEnrollment] = useState(null);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchHistoryAndRequests = async () => {
        setLoading(true);
        try {
            const [attRes, reqData] = await Promise.all([
                api.get('/api/attendance/me'),
                requestService.getMyRequests()
            ]);
            
            if (attRes.data.success) {
                setHistory(attRes.data.data);
            }
            setRequests(reqData || []);
        } catch (err) {
            console.error(err);
            toast.show("Lỗi", "Không thể tải dữ liệu", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistoryAndRequests();
    }, []);

    const handleEnrollClick = async () => {
        try {
            const res = await api.get('/api/employees/me/face-status');
            if (res.data?.data?.hasEnrolled) {
                setConfirmEnrollment(new Date(res.data.data.enrolledAt).toLocaleDateString('vi-VN'));
            } else {
                navigate('/employee/face-enroll');
            }
        } catch (error) {
            console.error("Error checking face status", error);
            navigate('/employee/face-enroll');
        }
    };

    const proceedToEnroll = () => {
        setConfirmEnrollment(null);
        navigate('/employee/face-enroll');
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '--:--';
        return timeStr.substring(0, 5);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PRESENT': return <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-semibold leading-none">Đúng giờ</span>;
            case 'LATE': return <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-semibold leading-none">Đi trễ</span>;
            case 'ABSENT': return <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-semibold leading-none">Vắng mặt</span>;
            default: return <span className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded text-[9px] font-semibold leading-none">{status}</span>;
        }
    };

    const getCheckoutStatusBadge = (timeOut) => {
        if (!timeOut) return null;
        const [hours, minutes] = timeOut.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes < 1005) { // 16:45
            return <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-semibold leading-none">Về sớm</span>;
        }
        return <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-semibold leading-none">Đúng giờ</span>;
    };

    // Calendar & Filtering logic
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const filterByMonthYear = (dateString) => {
        const d = new Date(dateString);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    };

    const filteredHistory = history.filter(h => filterByMonthYear(h.date));

    // Calendar generation
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday(0) to 6, Monday(1) to 0
    };

    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6; // Sunday or Saturday
            const att = history.find(h => h.date === dateStr);
            const dateObjTime = dateObj.getTime();
            const req = requests.find(r => {
                if (r.status !== 'APPROVED') return false;
                // Safely parse date regardless of string or array format
                const sDateObj = new Date(r.startDate);
                const eDateObj = new Date(r.endDate);
                const sTime = sDateObj.setHours(0, 0, 0, 0);
                const eTime = eDateObj.setHours(23, 59, 59, 999);
                return dateObjTime >= sTime && dateObjTime <= eTime;
            });
            const isPast = dateObj < today;
            const isToday = dateObj.getTime() === today.getTime();

            const isRealAttendance = att && !(att.status === 'ABSENT' && (att.timeIn === '00:00:00' || !att.timeIn));

            let status = null;
            if (isRealAttendance) {
                status = 'ATTENDED';
            } else if (req && req.requestType !== 'OVERTIME') {
                status = 'ON_LEAVE';
            } else if (att) {
                status = 'ATTENDED';
            } else if (isPast && !isWeekend) {
                status = 'UNEXCUSED_ABSENCE';
            }

            days.push({
                day: i,
                dateStr,
                dateObj,
                isWeekend,
                isToday,
                isPast,
                att,
                req,
                status
            });
        }
        
        // Pad the rest to always have exactly 6 rows (42 cells)
        while (days.length < 42) {
            days.push(null);
        }
        
        return days;
    };

    const getRequestBadgeInfo = (type) => {
        switch (type) {
            case 'NORMAL_LEAVE': return { text: 'Nghỉ phép', icon: '🌴', bg: 'bg-violet-100', textC: 'text-violet-700', border: 'border-violet-200' };
            case 'HALF_DAY_LEAVE': return { text: 'Nghỉ nửa ngày', icon: '☀️', bg: 'bg-amber-100', textC: 'text-amber-700', border: 'border-amber-200' };
            case 'SPECIAL_WFH_LEAVE': return { text: 'WFH', icon: '💻', bg: 'bg-blue-100', textC: 'text-blue-700', border: 'border-blue-200' };
            case 'UNPAID_LEAVE': return { text: 'Nghỉ K.Lương', icon: '⛔', bg: 'bg-stone-100', textC: 'text-stone-700', border: 'border-stone-200' };
            case 'OVERTIME': return { text: 'Làm thêm', icon: '⏰', bg: 'bg-indigo-100', textC: 'text-indigo-700', border: 'border-indigo-200' };
            default: return { text: 'Đơn từ', icon: '📄', bg: 'bg-gray-100', textC: 'text-gray-700', border: 'border-gray-200' };
        }
    };

    const renderCalendar = () => {
        const days = generateCalendar();
        const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                    {weekDays.map(d => (
                        <div key={d} className="py-3 text-center text-sm font-semibold text-gray-600 border-r last:border-r-0 border-gray-100">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 grid-rows-6 h-[480px] sm:h-[540px]">
                    {days.map((dayObj, idx) => {
                        if (!dayObj) {
                            return <div key={`empty-${idx}`} className="p-1 border-b border-r border-gray-100 bg-gray-50/50" />;
                        }

                        let bgClass = "bg-white";
                        if (dayObj.isToday) bgClass = "bg-blue-50/30";
                        if (dayObj.isWeekend) bgClass = "bg-gray-50";

                        return (
                            <div key={dayObj.day} className={`p-1 border-b border-r border-gray-100 relative ${bgClass} transition-colors hover:bg-gray-50 overflow-y-auto overflow-x-hidden custom-scrollbar`}>
                                <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium mb-1 shrink-0 ${dayObj.isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                                    {dayObj.day}
                                </div>

                                <div className="space-y-0.5 flex flex-col items-start text-[9px] leading-tight">
                                    {dayObj.status === 'ATTENDED' && (
                                        <div className="flex flex-col gap-0.5 w-full">
                                            {!(dayObj.att.status === 'ABSENT' && (dayObj.att.timeIn === '00:00:00' || !dayObj.att.timeIn)) && (
                                                <div className="flex justify-between items-center bg-gray-100/80 px-1 py-0.5 rounded w-full">
                                                    <div className="flex items-center gap-0.5" title="Giờ vào">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                                        <span className="font-semibold text-gray-600">{formatTime(dayObj.att.timeIn)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5" title="Giờ ra">
                                                        <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                                        <span className="font-semibold text-gray-600">{formatTime(dayObj.att.timeOut)}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex gap-1 flex-wrap">
                                                {getStatusBadge(dayObj.att.status)}
                                                {getCheckoutStatusBadge(dayObj.att.timeOut)}
                                            </div>
                                        </div>
                                    )}

                                    {dayObj.req && (
                                        <div className={`px-1 py-0.5 ${getRequestBadgeInfo(dayObj.req.requestType).bg} ${getRequestBadgeInfo(dayObj.req.requestType).textC} rounded border ${getRequestBadgeInfo(dayObj.req.requestType).border} font-medium flex items-center gap-1 w-full mt-1 truncate`} title={getRequestBadgeInfo(dayObj.req.requestType).text}>
                                            <span className="shrink-0">{getRequestBadgeInfo(dayObj.req.requestType).icon}</span> <span className="truncate">{getRequestBadgeInfo(dayObj.req.requestType).text}</span>
                                        </div>
                                    )}

                                    {dayObj.status === 'UNEXCUSED_ABSENCE' && (
                                        <div className="px-1 py-0.5 bg-rose-100 text-rose-700 rounded border border-rose-200 font-medium flex items-center gap-1 w-full mt-1 truncate">
                                            <AlertCircle size={8} className="shrink-0" /> <span className="truncate">Nghỉ không phép</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Chấm công cá nhân</h1>
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
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex gap-2">
                        <Button
                            variant={viewMode === 'calendar' ? 'primary' : 'outline'}
                            onClick={() => setViewMode('calendar')}
                            className="flex items-center gap-2 px-4"
                        >
                            <Calendar size={16} /> Tổng quan tháng
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'primary' : 'outline'}
                            onClick={() => setViewMode('table')}
                            className="flex items-center gap-2 px-4"
                        >
                            <List size={16} /> Lịch sử chấm công
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-semibold text-gray-700 min-w-[120px] text-center">
                            Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    
                    <button onClick={fetchHistoryAndRequests} className="text-gray-500 hover:text-blue-600 transition-colors p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                
                {viewMode === 'calendar' ? (
                    <div className="p-6 pt-2">
                        {renderCalendar()}
                    </div>
                ) : (
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
                                {loading && filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                                            <Clock size={32} className="text-gray-300 mb-2" />
                                            Chưa có dữ liệu chấm công tháng này.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHistory.map((record) => (
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
                )}
            </Card>

            {isPunchModalOpen && (
                <FacePunchModal 
                    onCancel={() => setIsPunchModalOpen(false)}
                    onSuccess={() => {
                        setIsPunchModalOpen(false);
                        fetchHistoryAndRequests();
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
