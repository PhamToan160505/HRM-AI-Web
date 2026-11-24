import React, { useState, useEffect } from 'react';
import { Award, Download } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrencyVND } from '../../../utils/currency';
import { formatMonthVN } from '../../tech/techHelpers';

export default function PayrollViewPage() {
    const { user } = useAuth();
    const [payrolls, setPayrolls] = useState([]);
    const [certReimbs, setCertReimbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const isTechDept = Boolean(
        user?.tenPhong && (
            user.tenPhong.toLowerCase().includes('công nghệ') ||
            user.tenPhong.toLowerCase().includes('kỹ thuật')
        )
    );

    useEffect(() => {
        fetchMyPayrolls();
    }, [isTechDept]);

    const fetchMyPayrolls = async () => {
        try {
            setLoading(true);
            const [payRes, certRes] = await Promise.all([
                api.get('/api/payroll/me'),
                isTechDept
                    ? api.get('/api/tech-finance/cert-reimbursements').catch(() => ({ data: { data: [] } }))
                    : Promise.resolve({ data: { data: [] } }),
            ]);
            if (payRes.data?.success) {
                setPayrolls(payRes.data.data || []);
            }
            const myPayrollCerts = (certRes.data?.data || []).filter(
                (c) =>
                    c.payoutMethod === 'NEXT_PAYROLL' &&
                    (c.status === 'FINANCE_APPROVED' || c.status === 'DISBURSED') &&
                    String(c.employeeId) === String(user?.userId)
            );
            setCertReimbs(myPayrollCerts);
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách lương.", "error");
        } finally {
            setLoading(false);
        }
    };

    const showCertCol = isTechDept || payrolls.some((p) => Number(p.certReimbursementAmount || 0) > 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Phiếu lương của tôi</h1>
                    <p className="text-sm text-slate-500 mt-1">Lịch sử nhận lương các tháng</p>
                </div>
            </div>

            {certReimbs.length > 0 && (
                <Card>
                    <div className="px-6 py-4 border-b border-indigo-100 flex items-center justify-between bg-indigo-50/70 rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <Award size={18} className="text-indigo-700" />
                            <h2 className="text-sm font-bold text-indigo-950">
                                Hoàn ứng Chứng chỉ Quốc tế gộp kỳ lương (miễn thuế TNCN)
                            </h2>
                        </div>
                        <span className="text-xs font-semibold text-indigo-700">
                            {certReimbs.length} khoản
                        </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {certReimbs.map((c) => {
                            const amount = Number(c.approvedAmountVnd ?? c.requestedAmountVnd ?? 0);
                            return (
                                <div key={c.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-900">{c.certificateName}</span>
                                            {c.payoutPayrollMonth && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    Gộp kỳ lương {formatMonthVN(c.payoutPayrollMonth)}
                                                </span>
                                            )}
                                            <span
                                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                                    c.status === 'DISBURSED'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}
                                            >
                                                {c.status === 'DISBURSED' ? 'Đã chi trả' : 'Đã duyệt chi — Chờ thanh toán'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {c.issuingOrganization}
                                            {c.paymentReference ? ` · Mã chứng từ: ${c.paymentReference}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right tabular-nums">
                                        <span className="text-base font-extrabold text-indigo-700">
                                            +{formatCurrencyVND(amount)}
                                        </span>
                                        <span className="block text-[11px] text-slate-400">Miễn thuế TNCN &amp; BHXH</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">Danh sách phiếu lương đã chi trả</h2>
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
                                {showCertCol && (
                                    <th className="px-6 py-4 font-semibold text-right text-indigo-700">
                                        Hoàn ứng chứng chỉ (miễn thuế)
                                    </th>
                                )}
                                <th className="px-6 py-4 font-semibold text-right text-blue-600 font-bold">Thực nhận</th>
                                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={showCertCol ? 12 : 11} className="px-6 py-8 text-center text-gray-500">Đang tải...</td>
                                </tr>
                            ) : payrolls.length === 0 ? (
                                <tr>
                                    <td colSpan={showCertCol ? 12 : 11} className="px-6 py-8 text-center text-gray-500">Chưa có phiếu lương nào</td>
                                </tr>
                            ) : (
                                payrolls.map((p) => {
                                    const certAmount = Number(p.certReimbursementAmount || 0);
                                    const totalPayout = Number(p.totalPayoutAmount ?? (Number(p.netSalary || 0) + certAmount));
                                    return (
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
                                            {showCertCol && (
                                                <td className="px-6 py-4 text-right tabular-nums">
                                                    {certAmount > 0 ? (
                                                        <div>
                                                            <div className="font-semibold text-indigo-700">+{formatCurrencyVND(certAmount)}</div>
                                                            {p.certReimbursementSummary && (
                                                                <div className="text-[11px] text-slate-400 max-w-[200px] truncate ml-auto" title={p.certReimbursementSummary}>
                                                                    {p.certReimbursementSummary}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-right tabular-nums">
                                                <div className="font-bold text-blue-600">{formatCurrencyVND(p.netSalary)}</div>
                                                {certAmount > 0 && (
                                                    <div className="text-[11px] font-semibold text-emerald-700">
                                                        Tổng nhận: {formatCurrencyVND(totalPayout)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="outline" className="flex items-center gap-2 ml-auto text-xs py-1.5">
                                                    <Download size={14} /> Tải PDF
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
