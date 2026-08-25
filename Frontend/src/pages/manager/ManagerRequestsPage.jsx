import React, { useState, useEffect } from 'react';
import { requestService } from '../../services/request.service';
import Button from '../../components/common/Button';
import { Clock, CheckCircle2, XCircle, FileText, Check, X } from 'lucide-react';
import { useToast } from '../../components/common/Toast';

export default function ManagerRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const toast = useToast();

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await requestService.getRequestsForManager();
      setRequests(data);
    } catch (error) {
      toast.show('Lỗi', 'Lỗi khi tải danh sách đơn từ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      setProcessingId(id);
      await requestService.approveRequest(id, 'Đồng ý duyệt');
      toast.show('Thành công', 'Đã duyệt đơn thành công', 'success');
      loadRequests();
    } catch (error) {
      toast.show('Lỗi', error.response?.data?.message || 'Có lỗi khi duyệt đơn', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!rejectNote) {
      toast.show('Lỗi', 'Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    try {
      setProcessingId(id);
      await requestService.rejectRequest(id, rejectNote);
      toast.show('Thành công', 'Đã từ chối đơn', 'success');
      setRejectingId(null);
      setRejectNote('');
      loadRequests();
    } catch (error) {
      toast.show('Lỗi', error.response?.data?.message || 'Có lỗi khi từ chối đơn', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={12} /> Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600">
            <XCircle size={12} /> Từ chối
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
            <Clock size={12} /> Chờ duyệt
          </span>
        );
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'NORMAL_LEAVE': return 'Nghỉ phép thường';
      case 'HALF_DAY_LEAVE': return 'Nghỉ nửa ngày';
      case 'SPECIAL_WFH_LEAVE': return 'Làm việc từ xa (WFH)';
      case 'UNPAID_LEAVE': return 'Nghỉ không lương';
      case 'OVERTIME': return 'Làm thêm giờ';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Đơn từ</h1>
          <p className="text-sm text-slate-500 mt-1">Duyệt yêu cầu nghỉ phép, làm thêm giờ của nhân viên</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Loại đơn</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Lý do</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">Không có đơn từ nào</p>
                    <p className="text-sm mt-1">Chưa có nhân viên nào gửi yêu cầu</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                          {req.hoTen.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{req.hoTen}</p>
                          <p className="text-xs text-slate-500">{req.maNhanVien}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {getTypeLabel(req.requestType)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <p>{new Date(req.startDate).toLocaleDateString('vi-VN')}</p>
                      {req.startDate !== req.endDate && <p className="text-xs text-slate-400">đến {new Date(req.endDate).toLocaleDateString('vi-VN')}</p>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'PENDING' ? (
                        rejectingId === req.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="text"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Lý do từ chối..."
                              className="px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:border-rose-500 w-32"
                              autoFocus
                            />
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={processingId === req.id}
                              className="p-1.5 text-white bg-rose-500 hover:bg-rose-600 rounded-md transition-colors disabled:opacity-50"
                              title="Xác nhận từ chối"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => { setRejectingId(null); setRejectNote(''); }}
                              className="p-1.5 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              title="Hủy"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={processingId === req.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => setRejectingId(req.id)}
                              disabled={processingId === req.id}
                              className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-400 italic">Đã xử lý</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
