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

    const parseSafeDate = (dateVal) => {
        if (!dateVal) return "Không xác định";
        if (Array.isArray(dateVal)) {
            return new Date(dateVal[0], dateVal[1] - 1, dateVal[2], dateVal[3] || 0, dateVal[4] || 0).toLocaleDateString('vi-VN');
        }
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? "Không xác định" : d.toLocaleDateString('vi-VN');
    };

    const handleEnrollClick = async () => {
        try {
            const res = await api.get('/api/employees/me/face-status');
            if (res.data?.data?.hasEnrolled) {
                setConfirmEnrollment(parseSafeDate(res.data.data.enrolledAt));
            } else {
                navigate('../face-enroll');
            }
        } catch (error) {
            console.error("Error checking face status", error);
            navigate('../face-enroll');
        }
    };

    const proceedToEnroll = () => {
        setConfirmEnrollment(null);
        navigate('../face-enroll');
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '--:--';
        return timeStr.substring(0, 5);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PRESENT': return <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100/50 rounded-md text-[10px] font-bold leading-none">Đúng giờ</span>;
            case 'LATE': return <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100/50 rounded-md text-[10px] font-bold leading-none">Đi trễ</span>;
            case 'ABSENT': return <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100/50 rounded-md text-[10px] font-bold leading-none">Vắng mặt</span>;
            default: return <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-100/50 rounded-md text-[10px] font-bold leading-none">{status}</span>;
        }
    };

    const getCheckoutStatusBadge = (timeOut) => {
        if (!timeOut) return null;
        const [hours, minutes] = timeOut.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes < 1005) { // 16:45
            return <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100/50 rounded-md text-[10px] font-bold leading-none">Về sớm</span>;
        }
        return <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100/50 rounded-md text-[10px] font-bold leading-none">Đúng giờ</span>;
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

            days.push({
                day: i,
                date: dateStr,
                isWeekend,
                isPast,
                isToday,
                att,
                req,
                status: req ? 'ON_LEAVE' : (att ? 'ATTENDED' : (isPast && !isWeekend ? 'UNEXCUSED_ABSENCE' : 'PENDING'))
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
            case 'NORMAL_LEAVE': return { text: 'Nghỉ phép', icon: '🌴', bg: 'bg-violet-50', textC: 'text-violet-600', border: 'border-violet-100/50' };
            case 'HALF_DAY_LEAVE': return { text: 'Nghỉ nửa ngày', icon: '☀️', bg: 'bg-amber-50', textC: 'text-amber-600', border: 'border-amber-100/50' };
            case 'SPECIAL_WFH_LEAVE': return { text: 'WFH', icon: '💻', bg: 'bg-blue-50', textC: 'text-blue-600', border: 'border-blue-100/50' };
            case 'UNPAID_LEAVE': return { text: 'Nghỉ K.Lương', icon: '⛔', bg: 'bg-stone-50', textC: 'text-stone-600', border: 'border-stone-100/50' };
            case 'OVERTIME': return { text: 'Làm thêm', icon: '⏰', bg: 'bg-indigo-50', textC: 'text-indigo-600', border: 'border-indigo-100/50' };
            default: return { text: 'Đơn từ', icon: '📄', bg: 'bg-slate-50', textC: 'text-slate-600', border: 'border-slate-100/50' };
        }
    };

    const renderCalendar = () => {
        const days = generateCalendar();
        const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

        return (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mt-6">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
                    {weekDays.map(d => (
                        <div key={d} className="py-4 text-center text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 grid-rows-6 h-[560px] sm:h-[640px]">
                    {days.map((dayObj, idx) => {
                        if (!dayObj) {
                            return <div key={`empty-${idx}`} className="p-2 border-b border-r border-slate-100/60 bg-slate-50/30" />;
                        }

                        let bgClass = "bg-white";
                        if (dayObj.isToday) bgClass = "bg-blue-50/20";
                        if (dayObj.isWeekend) bgClass = "bg-slate-50/50";

                        return (
                            <div key={dayObj.day} className={`p-2 border-b border-r border-slate-100/60 relative ${bgClass} transition-all hover:bg-slate-50 overflow-y-auto overflow-x-hidden custom-scrollbar group`}>
                                <div className="flex justify-end mb-2">
                                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-all ${dayObj.isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : (dayObj.isWeekend ? 'text-slate-400' : 'text-slate-700 group-hover:text-blue-600')}`}>
                                        {dayObj.day}
                                    </div>
                                </div>

                                <div className="space-y-1.5 flex flex-col items-start w-full">
                                    {dayObj.status === 'ATTENDED' && (
                                        <div className="flex flex-col gap-1.5 w-full">
                                            {!(dayObj.att && dayObj.att.status === 'ABSENT' && (dayObj.att.timeIn === '00:00:00' || !dayObj.att.timeIn)) && (
                                                <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100/80 w-full transition-all hover:border-slate-200">
                                                    <div className="flex justify-between items-center w-full px-0.5">
                                                        <div className="flex items-center gap-1.5" title="Giờ vào">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                                                            <span className="font-semibold text-slate-700 text-[11px] font-mono tracking-tight">{formatTime(dayObj.att?.timeIn)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5" title="Giờ ra">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0" />
                                                            <span className="font-semibold text-slate-700 text-[11px] font-mono tracking-tight">{formatTime(dayObj.att?.timeOut)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {getStatusBadge(dayObj.att?.status)}
                                                        {getCheckoutStatusBadge(dayObj.att?.timeOut)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {dayObj.req && (
                                        <div className={`px-2 py-1.5 ${getRequestBadgeInfo(dayObj.req.requestType).bg} ${getRequestBadgeInfo(dayObj.req.requestType).textC} rounded-lg border ${getRequestBadgeInfo(dayObj.req.requestType).border} flex items-center gap-1.5 w-full mt-1 truncate transition-all hover:scale-[1.02]`} title={getRequestBadgeInfo(dayObj.req.requestType).text}>
                                            <span className="shrink-0 text-[12px]">{getRequestBadgeInfo(dayObj.req.requestType).icon}</span> <span className="text-[10px] font-bold truncate tracking-wide">{getRequestBadgeInfo(dayObj.req.requestType).text}</span>
                                        </div>
                                    )}

                                    {dayObj.status === 'UNEXCUSED_ABSENCE' && (
                                        <div className="px-2 py-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100/50 flex items-center gap-1.5 w-full mt-1 truncate transition-all hover:scale-[1.02]">
                                            <AlertCircle size={10} className="shrink-0" /> <span className="text-[10px] font-bold truncate tracking-wide">Nghỉ không phép</span>
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

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 bg-white border border-slate-200/60 shadow-sm rounded-xl p-1">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="font-semibold text-slate-700 min-w-[120px] text-center text-sm">
                                Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
                            </span>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => {
                                fetchHistoryAndRequests();
                                toast.show("Thành công", "Đã làm mới dữ liệu chấm công", "success");
                            }} 
                            className="text-slate-500 hover:text-blue-600 transition-all p-2.5 bg-white border border-slate-200/60 shadow-sm rounded-xl hover:bg-blue-50 active:scale-95"
                            title="Làm mới dữ liệu"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
                        </button>
                    </div>
                </div>
                
                {viewMode === 'calendar' ? (
                    <div className="p-6 pt-2">
                        {renderCalendar()}
                    </div>
                ) : (
                    <div className="p-6 pt-2">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm">
                            <table className="w-full text-left text-sm bg-white">
                                <thead className="bg-slate-50 border-b border-slate-200/60">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Ngày</th>
                                        <th className="px-6 py-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Giờ vào (Check-in)</th>
                                        <th className="px-6 py-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Giờ ra (Check-out)</th>
                                        <th className="px-6 py-4 text-xs font-bold tracking-widest text-slate-500 uppercase">TT Check-in</th>
                                        <th className="px-6 py-4 text-xs font-bold tracking-widest text-slate-500 uppercase">TT Check-out</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && filteredHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">Đang tải dữ liệu...</td>
                                        </tr>
                                    ) : filteredHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-16 text-center text-slate-400 flex flex-col items-center">
                                                <Clock size={40} className="text-slate-200 mb-3" />
                                                <span className="font-medium text-slate-500">Chưa có dữ liệu chấm công tháng này.</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredHistory.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 font-semibold text-slate-700">{record.date}</td>
                                                <td className="px-6 py-4">
                                                    {record.timeIn ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                                                                <span className="font-mono text-slate-700 font-bold">{formatTime(record.timeIn)}</span>
                                                            </div>
                                                            {record.locationIn && <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={record.locationIn}>{record.locationIn}</span>}
                                                        </div>
                                                    ) : <span className="text-slate-300 font-mono">--:--</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {record.timeOut ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0" />
                                                                <span className="font-mono text-slate-700 font-bold">{formatTime(record.timeOut)}</span>
                                                            </div>
                                                            {record.locationOut && <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={record.locationOut}>{record.locationOut}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[13px]">Chưa check-out</span>
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
