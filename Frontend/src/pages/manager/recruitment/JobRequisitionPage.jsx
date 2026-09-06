import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

const ForcePortal = ({ children }) => {
  const [mountNode, setMountNode] = useState(null);
  useEffect(() => {
    const node = document.createElement('div');
    node.className = 'force-portal-wrapper';
    document.body.appendChild(node);
    setMountNode(node);
    return () => {
      if (document.body.contains(node)) {
        document.body.removeChild(node);
      }
    };
  }, []);
  if (!mountNode) return null;
  return createPortal(children, mountNode);
};
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/Toast';
import api from '../../../services/api';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const ROLES_MAP = {
  NHAN_VIEN: 'Nhân viên',
  TRUONG_PHONG: 'Trưởng phòng',
  GIAM_DOC_PHONG_BAN: 'Giám đốc phòng ban',
  CEO: 'Tổng giám đốc',
  ADMIN: 'Quản trị viên'
};

const STATUS_MAP = {
  PENDING_CEO: { label: 'Chờ CEO duyệt', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Đã duyệt', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Từ chối', color: 'bg-red-100 text-red-800' },
  POSTED: { label: 'Đã tạo chiến dịch', color: 'bg-indigo-100 text-indigo-800' },
};

export default function JobRequisitionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  
  const [requisitions, setRequisitions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    (user?.role === 'ceo' || user?.role === 'admin') ? 'department_requests' : 'my_requests'
  );

  // Pagination & Filters
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const pageSize = 5;

  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal action (approve/reject)
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', reqId: null });
  const [actionReason, setActionReason] = useState('');

  // Fetch initial deps
  useEffect(() => {
    api.get('/api/departments').then(res => {
      if (res.data.success) setDepartments(res.data.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchRequisitions();
  }, [activeTab, page, filterDept, filterRole, filterStatus]);

  const fetchRequisitions = async () => {
    setIsLoading(true);
    try {
      let url = `/api/job-requisitions/paginated?page=${page}&size=${pageSize}`;
      
      if (activeTab === 'my_requests') {
        url += `&filterRequesterId=${user.userId}`;
      } else if (activeTab === 'ceo_approved') {
        // HR views ceo approved ones. The backend already handles showing APPROVED/POSTED for HR
        // We can optionally force it if needed, but backend takes care of it based on role.
      }
      
      if (filterDept) url += `&departmentId=${filterDept}`;
      if (filterRole) url += `&targetRole=${filterRole}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const res = await api.get(url);
      if (res.data.success) {
        // In some cases with CEO tab 'department_requests', they might see their own. 
        // We can optionally filter them out client-side if we strictly don't want them in that tab,
        // but backend pagination limits this ability. It's usually fine for CEO to see all.
        let data = res.data.data.content;
        
        // Minor client side filter just in case the CEO wants strict separation
        if (activeTab === 'department_requests' && (user.role === 'ceo' || user.role === 'admin') && !filterDept && !filterRole && !filterStatus) {
            // we can't reliably do client-side filter with backend pagination. So we just show all.
        }

        setRequisitions(data);
        setTotalPages(res.data.data.totalPages);
        setTotalElements(res.data.data.totalElements);
      }
    } catch (error) {
      show('Lỗi', 'Lỗi khi tải danh sách yêu cầu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    const { type, reqId } = actionModal;
    try {
      if (type === 'approve') {
        await api.post(`/api/job-requisitions/${reqId}/approve`);
        show('Thành công', 'Đã duyệt yêu cầu', 'success');
      } else {
        await api.post(`/api/job-requisitions/${reqId}/reject`, { reason: actionReason });
        show('Thành công', 'Đã từ chối yêu cầu', 'success');
      }
      setActionModal({ isOpen: false, type: '', reqId: null });
      setActionReason('');
      fetchRequisitions();
    } catch (error) {
      show('Lỗi', error.response?.data?.message || 'Lỗi khi thực hiện', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yêu cầu tuyển dụng</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các đề xuất và yêu cầu tuyển dụng nhân sự</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={filterDept}
                onChange={(e) => { setFilterDept(e.target.value); setPage(0); }}
                className="pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[160px]"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.tenPhong}</option>
                ))}
              </select>
            </div>
            
            <select
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(0); }}
              className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[140px]"
            >
              <option value="">Tất cả chức vụ</option>
              <option value="NHAN_VIEN">Nhân viên</option>
              <option value="TRUONG_PHONG">Trưởng phòng</option>
              <option value="GIAM_DOC_PHONG_BAN">Giám đốc</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[140px]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING_CEO">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="POSTED">Đã lên chiến dịch</option>
              <option value="REJECTED">Bị từ chối</option>
            </select>

          <button
            onClick={() => navigate('new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 ml-2"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo yêu cầu
          </button>
        </div>
      </div>

      {(user?.role === 'ceo' || user?.role === 'admin') && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => { setActiveTab('my_requests'); setPage(0); }}
              className={`${
                activeTab === 'my_requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Yêu cầu của cá nhân
            </button>
            <button
              onClick={() => { setActiveTab('department_requests'); setPage(0); }}
              className={`${
                activeTab === 'department_requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Yêu cầu của phòng ban
            </button>
          </nav>
        </div>
      )}

      {user?.tenPhong === 'Nhân sự' && (user?.role === 'truong_phong' || user?.role === 'giam_doc_phong_ban') && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => { setActiveTab('my_requests'); setPage(0); }}
              className={`${
                activeTab === 'my_requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Yêu cầu của cá nhân
            </button>
            <button
              onClick={() => { setActiveTab('ceo_approved'); setPage(0); }}
              className={`${
                activeTab === 'ceo_approved'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Yêu cầu từ Tổng Giám đốc
            </button>
          </nav>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
        <ul className="divide-y divide-gray-200">
          {isLoading ? (
            <li className="p-10 text-center text-gray-500 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></li>
          ) : requisitions.length === 0 ? (
             <li className="p-10 text-center text-gray-500">Chưa có yêu cầu nào</li>
          ) : (
             requisitions.map((req) => (
              <li key={req.id} className="hover:bg-slate-50 transition-colors">
                <div className="px-4 py-5 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="truncate pr-4">
                      <div className="flex text-sm">
                        <p className="font-bold text-blue-700 truncate text-base">{req.title}</p>
                        <p className="ml-2 flex-shrink-0 font-normal text-gray-500 flex items-center">
                          cho chức vụ <span className="font-semibold text-slate-700 ml-1">{ROLES_MAP[req.targetRole]}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-1">Người gửi:</span> {req.requesterName} - <span className="italic ml-1 text-slate-500">{req.requesterPosition}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-4">
                        <div className="flex items-center text-sm text-gray-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="font-semibold">SL: {req.soLuong}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 truncate max-w-md">
                          <span className="font-medium mr-1">Lý do:</span> {req.reason}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 items-end sm:items-center">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${STATUS_MAP[req.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_MAP[req.status]?.label || req.status}
                      </span>
                      <div className="flex gap-2">
                        {req.status === 'PENDING_CEO' && (user.role === 'ceo' || user.role === 'admin') && (
                          <>
                            <button
                              onClick={() => setActionModal({ isOpen: true, type: 'approve', reqId: req.id })}
                              className="text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => setActionModal({ isOpen: true, type: 'reject', reqId: req.id })}
                              className="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                        {req.status === 'APPROVED' && user?.role === 'truong_phong' && user?.tenPhong === 'Nhân sự' && (
                          <button
                            onClick={() => navigate('../campaigns/new', { state: { reqData: req } })}
                            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Tạo chiến dịch
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 border border-slate-200 rounded-lg shadow-sm">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Hiển thị từ <span className="font-medium">{page * pageSize + 1}</span> đến <span className="font-medium">{Math.min((page + 1) * pageSize, totalElements)}</span> trong số <span className="font-medium">{totalElements}</span> yêu cầu
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
        </div>
      )}

      {/* Modal Reject */}
      {actionModal.isOpen && actionModal.type === 'reject' && (
        <ForcePortal>
          <div className="fixed inset-0 z-[9999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setActionModal({ isOpen: false, type: '', reqId: null })}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Lý do từ chối
                      </h3>
                      <div className="mt-2">
                        <textarea
                          rows={4}
                          className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                          placeholder="Nhập lý do từ chối..."
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleAction}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Xác nhận từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionModal({ isOpen: false, type: '', reqId: null })}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ForcePortal>
      )}

      {/* Modal Approve */}
      {actionModal.isOpen && actionModal.type === 'approve' && (
        <ForcePortal>
          <div className="fixed inset-0 z-[9999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setActionModal({ isOpen: false, type: '', reqId: null })}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Xác nhận duyệt
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Bạn có chắc chắn muốn duyệt yêu cầu này? Sau khi duyệt, phòng nhân sự sẽ có thể tạo chiến dịch tuyển dụng.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleAction}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Xác nhận duyệt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionModal({ isOpen: false, type: '', reqId: null })}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ForcePortal>
      )}
    </div>
  );
}
