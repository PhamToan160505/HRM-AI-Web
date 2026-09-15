import React, { useState, useEffect } from 'react';
import { Bot, Calendar, Sparkles, RefreshCcw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Button from '../../components/common/Button';
import ReactMarkdown from 'react-markdown';

export default function AiReviewTab({ employeeId, createdAt }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const toast = useToast();

    const createdDate = createdAt ? new Date(createdAt) : new Date(2024, 0, 1);
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth() + 1;

    useEffect(() => {
        if (employeeId) {
            fetchReviews();
        }
    }, [employeeId]);

    const fetchReviews = async () => {
        try {
            const res = await api.get(`/api/employees/${employeeId}/performance-reviews`);
            if (res.data.success) {
                setReviews(res.data.data);
            }
        } catch (error) {
            toast.error('Không thể tải danh sách đánh giá');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReview = async () => {
        setGenerating(true);
        try {
            const res = await api.post(`/api/employees/${employeeId}/performance-reviews/generate`, {
                thang: selectedMonth,
                nam: selectedYear
            });
            if (res.data.success) {
                toast.success('Tạo đánh giá thành công');
                fetchReviews();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo đánh giá');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Bot size={18} className="text-blue-600" /> AI Đánh giá Hiệu suất
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">AI phân tích dữ liệu chấm công thực tế để viết nhận xét.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                        className="text-sm border-slate-300 rounded-md py-1.5"
                    >
                        {[...Array(12)].map((_, i) => {
                            const m = i + 1;
                            const disabled = selectedYear < createdYear || (selectedYear === createdYear && m < createdMonth);
                            return (
                                <option key={m} value={m} disabled={disabled}>Tháng {m}</option>
                            );
                        })}
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="text-sm border-slate-300 rounded-md py-1.5"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y} disabled={y < createdYear}>Năm {y}</option>
                        ))}
                    </select>
                    <Button onClick={handleGenerateReview} disabled={generating} className="flex items-center gap-1.5 py-1.5 px-3">
                        {generating ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                        {generating ? 'Đang tạo...' : 'Tạo mới'}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-slate-500 text-sm">Đang tải dữ liệu...</div>
            ) : reviews.length === 0 ? (
                <div className="p-12 text-center bg-white border border-slate-100 rounded-xl flex flex-col items-center">
                    <Bot size={40} className="text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium text-sm">Chưa có báo cáo nào được tạo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map(review => (
                        <div key={review.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                    <Calendar size={14} className="text-blue-600" /> Tháng {review.thang} / {review.nam}
                                </span>
                                <span className="text-xs text-slate-500">
                                    Tạo lúc: {new Date(review.generatedAt).toLocaleString('vi-VN')}
                                </span>
                            </div>
                            <div className="p-4 prose prose-sm max-w-none prose-blue">
                                <ReactMarkdown>{review.aiEvaluation}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
