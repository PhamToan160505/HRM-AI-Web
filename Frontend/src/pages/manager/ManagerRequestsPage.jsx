import React, { useState, useEffect } from 'react';
import { requestService } from '../../services/request.service';
import Button from '../../components/common/Button';
import { Clock, CheckCircle2, XCircle, FileText, Check, X, Eye, Search, Filter } from 'lucide-react';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

export default function ManagerRequestsPage() {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showForwardInput, setShowForwardInput] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

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
      setSelectedRequest(null);
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
      setRejectNote('');
      setShowRejectInput(false);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      toast.show('Lỗi', error.response?.data?.message || 'Có lỗi khi từ chối đơn', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleForward = async (id) => {
    try {
      setProcessingId(id);
      await requestService.forwardRequest(id, rejectNote); // reuse rejectNote state for note if needed
      toast.show('Thành công', 'Đã chuyển tiếp đơn lên Giám đốc', 'success');
      setRejectNote('');
      setShowForwardInput(false);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      toast.show('Lỗi', error.response?.data?.message || 'Có lỗi khi chuyển tiếp đơn', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 size={12} /> Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle size={12} /> Từ chối
          </span>
        );
      case 'FORWARDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
            <Clock size={12} /> Đã chuyển tiếp
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
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
          <p className="text-sm text-slate-500 mt-1">Duyệt yêu cầu nghỉ phép, làm thêm giờ của nhân viên cấp dưới</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên nhân viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả chức vụ</option>
            <option value="NHAN_VIEN">Nhân viên</option>
            <option value="TRUONG_PHONG">Trưởng phòng</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả loại đơn</option>
            <option value="NORMAL_LEAVE">Nghỉ phép thường</option>
            <option value="HALF_DAY_LEAVE">Nghỉ nửa ngày</option>
            <option value="SPECIAL_WFH_LEAVE">Làm việc từ xa (WFH)</option>
            <option value="UNPAID_LEAVE">Nghỉ không lương</option>
            <option value="OVERTIME">Làm thêm giờ</option>
          </select>
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
              ) : (() => {
                const filteredRequests = requests.filter(req => {
                  const matchesSearch = req.hoTen?.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesRole = filterRole === 'ALL' || req.role === filterRole;
                  const matchesType = filterType === 'ALL' || req.requestType === filterType;
                  return matchesSearch && matchesRole && matchesType;
                });

                if (filteredRequests.length === 0) {
                  return (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FileText size={24} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">Không tìm thấy đơn từ nào phù hợp</p>
                      </td>
                    </tr>
                  );
                }

                return filteredRequests.map((req) => (
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
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setShowRejectInput(false);
                          setShowForwardInput(false);
                          setRejectNote('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                      >
                        <Eye size={14} />
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chi tiết Đơn từ */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                Chi tiết Đơn từ
              </h3>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                  {selectedRequest.hoTen.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-base">{selectedRequest.hoTen}</p>
                  <p className="text-slate-500">Mã NV: {selectedRequest.maNhanVien}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-y-3 gap-x-4 border-b border-slate-100 pb-4">
                <div className="col-span-1 text-slate-500 font-medium">Loại đơn:</div>
                <div className="col-span-2 font-semibold text-slate-800">{getTypeLabel(selectedRequest.requestType)}</div>
                
                <div className="col-span-1 text-slate-500 font-medium">Trạng thái:</div>
                <div className="col-span-2">{getStatusBadge(selectedRequest.status)}</div>

                <div className="col-span-1 text-slate-500 font-medium">Thời gian:</div>
                <div className="col-span-2 text-slate-800">
                  {new Date(selectedRequest.startDate).toLocaleDateString('vi-VN')}
                  {selectedRequest.startDate !== selectedRequest.endDate && 
                    ` - ${new Date(selectedRequest.endDate).toLocaleDateString('vi-VN')}`
                  }
                </div>
              </div>

              <div>
                <div className="text-slate-500 font-medium mb-1">Lý do:</div>
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-slate-700 whitespace-pre-wrap min-h-[60px]">
                  {selectedRequest.reason}
                </div>
              </div>

              {selectedRequest.status !== 'PENDING' && selectedRequest.note && (
                <div>
                  <div className="text-slate-500 font-medium mb-1">Ghi chú duyệt:</div>
                  <div className={`p-3 rounded-lg border ${selectedRequest.status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'} whitespace-pre-wrap`}>
                    {selectedRequest.note}
                  </div>
                </div>
              )}

              {/* Input ghi chú khi từ chối / chuyển tiếp */}
              {(showRejectInput || showForwardInput) && selectedRequest.status === 'PENDING' && (
                <div className="pt-2 animate-fade-in">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {showRejectInput ? 'Lý do từ chối' : 'Ghi chú chuyển tiếp'} {showRejectInput && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${showRejectInput ? 'border-slate-300 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                    rows="2"
                    placeholder={showRejectInput ? 'Nhập lý do từ chối để nhân viên biết...' : 'Ghi chú thêm cho Giám đốc (không bắt buộc)...'}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Actions Footer */}
            {(selectedRequest.status === 'PENDING' || (selectedRequest.status === 'FORWARDED' && role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN')) && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                {showRejectInput ? (
                  <>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={processingId === selectedRequest.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingId === selectedRequest.id && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Xác nhận từ chối
                    </button>
                  </>
                ) : showForwardInput ? (
                  <>
                    <button
                      onClick={() => setShowForwardInput(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleForward(selectedRequest.id)}
                      disabled={processingId === selectedRequest.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingId === selectedRequest.id && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Xác nhận chuyển tiếp
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                    >
                      Từ chối
                    </button>
                    {role?.toUpperCase() === 'TRUONG_PHONG' && selectedRequest.status === 'PENDING' && (
                      <button
                        onClick={() => setShowForwardInput(true)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      >
                        Chuyển tiếp
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={processingId === selectedRequest.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingId === selectedRequest.id && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Duyệt đơn
                    </button>
                  </>
                )}
              </div>
            )}
            
            {selectedRequest.status !== 'PENDING' && !(selectedRequest.status === 'FORWARDED' && role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN') && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
