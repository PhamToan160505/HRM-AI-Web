import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, RefreshCw, DollarSign, Calendar } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';

export default function EmployeeHistoryTimeline({ employeeId, createdAt }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        if (employeeId) {
            fetchHistory();
        }
    }, [employeeId]);

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/api/employees/${employeeId}/history`);
            if (res.data.success) {
                const historyData = res.data.data;
                if (createdAt) {
                    historyData.push({
                        id: 'creation-event',
                        eventType: 'JOINED',
                        description: 'Tài khoản nhân viên được tạo trên hệ thống',
                        eventDate: createdAt,
                        oldValue: null,
                        newValue: 'Hoạt động'
                    });
                }
                setHistory(historyData);
            }
        } catch (error) {
            toast.error('Không thể tải lịch sử nhân sự');
        } finally {
            setLoading(false);
        }
    };

    const getEventIcon = (type) => {
        switch (type) {
            case 'JOINED': return <Calendar size={16} className="text-emerald-600" />;
            case 'PROMOTED': return <TrendingUp size={16} className="text-blue-600" />;
            case 'TRANSFERRED': return <RefreshCw size={16} className="text-amber-600" />;
            case 'SALARY_CHANGED': return <DollarSign size={16} className="text-purple-600" />;
            case 'ROLE_CHANGED': return <TrendingUp size={16} className="text-rose-600" />;
            default: return <Clock size={16} className="text-slate-600" />;
        }
    };

    const getEventColor = (type) => {
        switch (type) {
            case 'JOINED': return 'bg-emerald-100 border-emerald-200';
            case 'PROMOTED': return 'bg-blue-100 border-blue-200';
            case 'TRANSFERRED': return 'bg-amber-100 border-amber-200';
            case 'SALARY_CHANGED': return 'bg-purple-100 border-purple-200';
            case 'ROLE_CHANGED': return 'bg-rose-100 border-rose-200';
            default: return 'bg-slate-100 border-slate-200';
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 text-sm">Đang tải dữ liệu lịch sử...</div>;

    if (history.length === 0) return (
        <div className="p-12 text-center flex flex-col items-center">
            <Clock size={40} className="text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium text-sm">Chưa có bản ghi lịch sử nào</p>
        </div>
    );

    return (
        <div className="p-4">
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-4">
                {history.map((event, idx) => (
                    <div key={event.id} className="relative pl-6">
                        <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white ${getEventColor(event.eventType)}`}>
                            {getEventIcon(event.eventType)}
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-slate-800 text-sm">{event.description}</h4>
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                    {new Date(event.eventDate).toLocaleDateString('vi-VN')} {new Date(event.eventDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="text-sm text-slate-600 flex items-center gap-2 mt-2">
                                <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-100 line-through">
                                    {event.oldValue || 'Không có'}
                                </span>
                                <span className="text-slate-400">➔</span>
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-medium">
                                    {event.newValue || 'Không có'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
