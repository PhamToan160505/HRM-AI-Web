import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { useAuth } from '../../../context/AuthContext';

export default function HolidayPage() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newNgayLe, setNewNgayLe] = useState('');
    const [newTenNgayLe, setNewTenNgayLe] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();
    const { user } = useAuth();

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/holidays');
            if (response.data?.success) {
                setHolidays(response.data.data || []);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách ngày lễ.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newNgayLe || !newTenNgayLe) {
            toast.show("Cảnh báo", "Vui lòng nhập đủ thông tin", "warning");
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post('/api/holidays', {
                ngayLe: newNgayLe,
                tenNgayLe: newTenNgayLe
            });
            if (res.data?.success) {
                toast.show("Thành công", "Đã thêm ngày lễ", "success");
                setNewNgayLe('');
                setNewTenNgayLe('');
                fetchHolidays();
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể thêm ngày lễ", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc muốn xóa ngày lễ này?")) return;
        try {
            const res = await api.delete(`/api/holidays/${id}`);
            if (res.data?.success) {
                toast.show("Thành công", "Đã xóa ngày lễ", "success");
                fetchHolidays();
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể xóa", "error");
        }
    };

    if (user?.role !== 'GIAM_DOC') {
        return <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Cấu hình ngày lễ</h1>
                <p className="text-sm text-slate-500 mt-1">Quản lý lịch nghỉ lễ để tính công chuẩn</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 md:col-span-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Thêm ngày lễ</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input
                            label="Tên ngày lễ"
                            value={newTenNgayLe}
                            onChange={(e) => setNewTenNgayLe(e.target.value)}
                            placeholder="Vd: Giỗ tổ Hùng Vương"
                        />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Ngày nghỉ
                            </label>
                            <input
                                type="date"
                                value={newNgayLe}
                                onChange={(e) => setNewNgayLe(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <Button type="submit" loading={submitting} className="w-full">
                            Thêm mới
                        </Button>
                    </form>
                </Card>

                <Card className="md:col-span-2">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                        <h2 className="text-lg font-bold text-gray-800">Danh sách ngày lễ đã thiết lập</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Ngày lễ</th>
                                    <th className="px-6 py-4 font-semibold">Tên ngày lễ</th>
                                    <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : holidays.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">Chưa có ngày lễ nào</td>
                                    </tr>
                                ) : (
                                    holidays.map((h) => (
                                        <tr key={h.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-blue-600 flex items-center gap-2">
                                                <Calendar size={16} />
                                                {new Date(h.ngayLe).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-4">{h.tenNgayLe}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(h.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
