import React, { useState, useEffect } from 'react';
import { Banknote, Download } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatCurrencyVND } from '../../../utils/currency';

export default function PayrollViewPage() {
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        fetchMyPayrolls();
    }, []);

    const fetchMyPayrolls = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/payroll/me');
            if (response.data?.success) {
                setPayrolls(response.data.data || []);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách lương.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Phiếu lương của tôi</h1>
                    <p className="text-sm text-slate-500 mt-1">Lịch sử nhận lương các tháng</p>
                </div>
            </div>

            <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">Danh sách phiếu lương đã duyệt</h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Tháng/Năm</th>
                                <th className="px-6 py-4 font-semibold">Lương cơ bản</th>
                                <th className="px-6 py-4 font-semibold">Công chuẩn/Thực tế</th>
                                <th className="px-6 py-4 font-semibold">Lương gộp</th>
                                <th className="px-6 py-4 font-semibold text-red-600">BHXH (8%)</th>
                                <th className="px-6 py-4 font-semibold text-red-600">BHYT (1.5%)</th>
                                <th className="px-6 py-4 font-semibold text-red-600">BHTN (1%)</th>
                                <th className="px-6 py-4 font-semibold">TN tính thuế</th>
                                <th className="px-6 py-4 font-semibold text-red-600">Thuế TNCN</th>
                                <th className="px-6 py-4 font-semibold text-right text-blue-600 font-bold">Thực nhận</th>
                                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Đang tải...</td>
                                </tr>
                            ) : payrolls.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Chưa có phiếu lương nào</td>
                                </tr>
                            ) : (
                                payrolls.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-gray-800">Tháng {p.month}/{p.year}</td>
                                        <td className="px-6 py-4 tabular-nums">{formatCurrencyVND(p.baseSalary)}</td>
                                        <td className="px-6 py-4 font-mono text-center">{p.standardDays} / {p.actualDays}</td>
                                        <td className="px-6 py-4 tabular-nums font-semibold">{formatCurrencyVND(p.grossSalary)}</td>
                                        <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhxhAmount)}</td>
                                        <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhytAmount)}</td>
                                        <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhtnAmount)}</td>
                                        <td className="px-6 py-4 tabular-nums">{formatCurrencyVND(p.thuNhapTinhThue)}</td>
                                        <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.thuTncn)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-blue-600 tabular-nums">{formatCurrencyVND(p.netSalary)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="outline" className="flex items-center gap-2 ml-auto text-xs py-1.5">
                                                <Download size={14} /> Tải PDF
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
