import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Download, AlertCircle, CheckCircle, Filter, Users, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

export default function ManagerAttendancePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [records, setRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [approvingRecord, setApprovingRecord] = useState(null);
    const [viewingRecord, setViewingRecord] = useState(null);
    const [loaiNghiPhep, setLoaiNghiPhep] = useState('NORMAL_LEAVE');
    
    // Pagination & Filters
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'ALL');
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 5;
    
    const toast = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user?.role?.toUpperCase() === 'CEO') {
            fetchDepartments();
        }
    }, [user]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchAttendance();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [page, searchTerm, selectedRole, selectedDepartment]);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/api/attendance/departments/stats');
            if (res.data?.success) {
                setDepartments(res.data.data || []);
            }
        } catch (error) {
            console.error("Error fetching departments stats:", error);
        }
    };

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            let url = `/api/attendance/department/paginated?page=${page}&size=${pageSize}`;
            if (searchTerm) url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
            if (selectedRole) url += `&targetRole=${selectedRole}`;
            if (selectedDepartment) url += `&departmentId=${selectedDepartment.id}`;
            
            const response = await api.get(url);
            if (response.data?.success) {
                setRecords(response.data.data.content || []);
                setTotalPages(response.data.data.totalPages);
                setTotalElements(response.data.data.totalElements);
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể tải danh sách chấm công.", "error");
            console.error("Error fetching department attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 'PRESENT': return 'bg-green-100 text-green-700';
            case 'LATE': return 'bg-amber-100 text-amber-700';
            case 'ABSENT': return 'bg-red-100 text-red-700';
            case 'EXCUSED': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status) => {
        switch(status) {
            case 'PRESENT': return 'Đúng giờ';
            case 'LATE': return 'Đi muộn';
            case 'ABSENT': return 'Vắng mặt';
            case 'EXCUSED': return 'Nghỉ phép';
            case 'UNPAID_LEAVE': return 'Nghỉ không lương';
            case 'HALF_DAY_LEAVE': return 'Nghỉ nửa ngày';
            default: return status || 'Chưa rõ';
        }
    };

    const handleApproveException = async (id, status) => {
        try {
            let requestBody = { status };
            if (status === 'APPROVED') {
                requestBody.loaiNghiPhep = loaiNghiPhep;
            }
            
            const response = await api.patch(`/api/attendance/${id}/approve-exception`, requestBody);
            if (response.data?.success) {
                toast.show("Thành công", status === 'APPROVED' ? "Đã duyệt ngoại lệ" : "Đã từ chối ngoại lệ", "success");
                setApprovingRecord(null);
                fetchAttendance();
            }
        } catch (error) {
            toast.show("Lỗi", "Không thể xử lý ngoại lệ.", "error");
            console.error("Error approving exception:", error);
        }
    };

    const filteredRecords = records.filter(record => {
        const matchStatus = filterStatus === 'ALL' || 
                          (filterStatus === 'LATE' && record.status === 'LATE') ||
                          (filterStatus === 'ABSENT' && record.status === 'ABSENT') ||
                          (filterStatus === 'EXCEPTION' && (record.status === 'LATE' || record.status === 'ABSENT') && !record.isException);
        
        return matchStatus;
    });

    const handleExportReport = async () => {
        try {
            toast.show("Thông báo", "Đang xuất báo cáo...", "info");
            
            let url = `/api/attendance/department/paginated?page=0&size=10000`;
            if (selectedDepartment) url += `&departmentId=${selectedDepartment.id}`;
            if (selectedRole) url += `&targetRole=${selectedRole}`;
            if (filterStatus && filterStatus !== 'ALL') url += `&status=${filterStatus}`;
            
            const response = await api.get(url);
            if (response.data?.success) {
                const data = response.data.data.content || [];
                if (data.length === 0) {
                    toast.show("Cảnh báo", "Không có dữ liệu để xuất", "warning");
                    return;
                }
                
                let csvContent = "\uFEFF"; // BOM cho UTF-8 Excel
                csvContent += "Nhân viên,Phòng ban,Chức vụ,Giờ vào,Giờ ra,Trạng thái\n";
                
                data.forEach(record => {
                    const ten = `"${record.hoTen || ''}"`;
                    const phong = `"${record.departmentName || selectedDepartment?.tenPhong || 'Chưa cập nhật'}"`;
                    const chucVu = `"${record.chucVu || 'Chưa cập nhật'}"`;
                    const gioVao = record.timeIn ? record.timeIn.substring(0, 5) : "--:--";
                    const gioRa = record.timeOut ? record.timeOut.substring(0, 5) : "Chưa check-out";
                    const trangThai = `"${getStatusText(record.status)}"`;
                    
                    csvContent += `${ten},${phong},${chucVu},${gioVao},${gioRa},${trangThai}\n`;
                });
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const dateStr = new Date().toISOString().split('T')[0];
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `Bao_Cao_Cham_Cong_${dateStr}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error("Lỗi xuất báo cáo:", error);
            toast.show("Lỗi", "Không thể xuất báo cáo", "error");
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header & Department Selection */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {user?.role?.toUpperCase() === 'CEO' && selectedDepartment && (
                        <button 
                            onClick={() => { setSelectedDepartment(null); setPage(0); }}
                            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardCheck className="text-blue-600" />
                            {selectedDepartment ? `Chấm công: ${selectedDepartment.tenPhong}` : 'Quản lý Chấm công'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Duyệt và theo dõi giờ làm việc của nhân sự</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex items-center gap-2 bg-white" onClick={handleExportReport}>
                        <Download size={16} />
                        Xuất báo cáo
                    </Button>
                </div>
            </div>

            {/* Khung chọn phòng ban (Chỉ dành cho CEO khi chưa chọn phòng nào) */}
            {user?.role?.toUpperCase() === 'CEO' && !selectedDepartment ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    {departments.map((dept) => (
                        <div 
                            key={dept.departmentId || dept.id}
                            onClick={() => { setSelectedDepartment({ id: dept.departmentId, tenPhong: dept.departmentName }); setPage(0); }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{dept.departmentName || dept.tenPhong}</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-4">
                                <div className="bg-gray-50 rounded p-2 text-center">
                                    <div className="text-gray-500 text-xs">Tổng nhân viên</div>
                                    <div className="font-semibold text-gray-800">{dept.totalEmployees}</div>
                                </div>
                                <div className="bg-green-50 rounded p-2 text-center">
                                    <div className="text-green-600 text-xs">Đúng giờ</div>
                                    <div className="font-semibold text-green-700">{dept.presentCount}</div>
                                </div>
                                <div className="bg-amber-50 rounded p-2 text-center">
                                    <div className="text-amber-600 text-xs">Trễ giờ</div>
                                    <div className="font-semibold text-amber-700">{dept.lateCount}</div>
                                </div>
                                <div className="bg-red-50 rounded p-2 text-center">
                                    <div className="text-red-600 text-xs">Vắng mặt</div>
                                    <div className="font-semibold text-red-700">{dept.absentCount}</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t pt-3">
                                <span className="text-gray-500">Bấm để xem chi tiết chấm công</span>
                                <ArrowLeft className="text-gray-300 group-hover:text-blue-600 transform rotate-180 transition-colors" size={16} />
                            </div>
                        </div>
                    ))}
                    {departments.length === 0 && (
                        <div className="col-span-3 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                            Không có phòng ban nào.
                        </div>
                    )}
                </div>
            ) : (
                <Card>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="font-semibold text-gray-800 text-lg">Danh sách chấm công hôm nay</h2>
                            
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Tìm nhân viên..." 
                                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                                    />
                                </div>
                                <select 
                                    className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={selectedRole}
                                    onChange={e => { setSelectedRole(e.target.value); setPage(0); }}
                                >
                                    <option value="">Tất cả chức vụ</option>
                                    <option value="NHAN_VIEN">Nhân viên</option>
                                    <option value="TRUONG_PHONG">Trưởng phòng</option>
                                    {user?.role?.toUpperCase() === 'CEO' && (
                                        <option value="GIAM_DOC_PHONG_BAN">Giám đốc phòng ban</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-500 text-xs font-semibold uppercase">
                                        <th className="pb-4 pl-4 font-medium">Nhân viên</th>
                                        <th className="pb-4 font-medium">Giờ vào (Check-in)</th>
                                        <th className="pb-4 font-medium">Giờ ra (Check-out)</th>
                                        <th className="pb-4 font-medium">TT Check-in</th>
                                        <th className="pb-4 font-medium">TT Check-out</th>
                                        <th className="pb-4 pr-4 font-medium text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-gray-500">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-gray-500">
                                                Không có dữ liệu chấm công nào phù hợp.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record, index) => (
                                            <tr key={index} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 pl-4">
                                                    <div>
                                                        <div className="font-semibold text-gray-800">{record.hoTen}</div>
                                                        <div className="text-xs text-gray-400 mt-0.5">{record.chucVu || 'Chưa cập nhật chức danh'}</div>
                                                    </div>
                                                </td>
                                                <td className="py-4 font-medium text-gray-700">
                                                    {record.timeIn ? record.timeIn.substring(0, 5) : '--:--'}
                                                </td>
                                                <td className="py-4 font-medium text-gray-700">
                                                    {record.timeOut ? record.timeOut.substring(0, 5) : <span className="text-gray-400 font-normal italic">Chưa check-out</span>}
                                                </td>
                                                <td className="py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusStyle(record.status)}`}>
                                                        {getStatusText(record.status)}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    {record.timeOut ? (
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                                                            Hoàn thành
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-xs">Chưa check-out</span>
                                                    )}
                                                </td>
                                                <td className="py-4 pr-4 text-right">
                                                    <button 
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                                                        onClick={() => setViewingRecord(record)}
                                                    >
                                                        Xem chi tiết
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination */}
                        {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-between bg-white px-6 py-4 border-t border-gray-100 mt-4">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Hiển thị từ <span className="font-medium">{page * pageSize + 1}</span> đến <span className="font-medium">{Math.min((page + 1) * pageSize, totalElements)}</span> trong số <span className="font-medium">{totalElements}</span> bản ghi
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                        
                                        {[...Array(totalPages)].map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setPage(i)}
                                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                                                    ${page === i 
                                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={page === totalPages - 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Next</span>
                                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Viewing / Approving Modals are omitted here for brevity (if needed I will add them back, but let's keep them!) */}
            {/* Oh wait, I MUST NOT omit the Modals. I will append the modals. */}
            
            {viewingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg">Chi tiết chấm công</h3>
                            <button onClick={() => setViewingRecord(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-6 space-y-4 text-sm text-gray-700">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Nhân viên:</span>
                                <span className="font-medium text-gray-900">{viewingRecord.hoTen}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Chức vụ:</span>
                                <span>{viewingRecord.chucVu || 'Chưa cập nhật'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Trạng thái:</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(viewingRecord.status)}`}>
                                    {getStatusText(viewingRecord.status)}
                                </span>
                            </div>
                            
                            {(viewingRecord.status === 'LATE' || viewingRecord.status === 'ABSENT') && !viewingRecord.isException && (
                                <div className="pt-4 flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setViewingRecord(null)}>Đóng</Button>
                                    <Button variant="primary" onClick={() => {
                                        setApprovingRecord(viewingRecord);
                                        setViewingRecord(null);
                                    }}>Duyệt ngoại lệ</Button>
                                </div>
                            )}
                            {(!viewingRecord.status || viewingRecord.status === 'PRESENT' || viewingRecord.status === 'EXCUSED' || viewingRecord.isException) && (
                                <div className="pt-4 flex justify-end">
                                    <Button variant="primary" onClick={() => setViewingRecord(null)}>Đóng</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {approvingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg">Duyệt ngoại lệ</h3>
                            <button onClick={() => setApprovingRecord(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="p-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                <h4 className="font-medium text-amber-800 text-sm mb-1">Thông tin vi phạm</h4>
                                <p className="text-sm text-amber-700">
                                    Nhân viên: <span className="font-medium">{approvingRecord.hoTen}</span><br/>
                                    Lỗi: <span className="font-medium">{getStatusText(approvingRecord.status)}</span>
                                </p>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Loại nghỉ phép (nếu duyệt)</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={loaiNghiPhep}
                                    onChange={(e) => setLoaiNghiPhep(e.target.value)}
                                >
                                    <option value="NORMAL_LEAVE">Nghỉ phép năm (có lương)</option>
                                    <option value="UNPAID_LEAVE">Nghỉ không lương</option>
                                    <option value="HALF_DAY_LEAVE">Nghỉ nửa ngày</option>
                                </select>
                            </div>

                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                Bằng việc duyệt ngoại lệ này, hệ thống sẽ bỏ qua lỗi vi phạm và cập nhật loại nghỉ phép đã chọn (nếu có).
                            </p>
                            
                            <div className="flex gap-3 justify-end">
                                <Button variant="outline" onClick={() => setApprovingRecord(null)}>Hủy</Button>
                                <button 
                                    onClick={() => handleApproveException(approvingRecord.recordId, 'REJECTED')}
                                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Từ chối ngoại lệ
                                </button>
                                <Button variant="primary" onClick={() => handleApproveException(approvingRecord.recordId, 'APPROVED')}>
                                    Đồng ý duyệt
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
