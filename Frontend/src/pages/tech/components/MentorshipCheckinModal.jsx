import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Plus,
  Star,
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { formatDateVN } from '../techHelpers';

function getTodayLocalStr() {
  return new Date().toLocaleDateString('en-CA');
}

function getDefaultCheckinDate(program) {
  const today = getTodayLocalStr();
  if (program?.startDate && today < program.startDate) return program.startDate;
  if (program?.endDate && today > program.endDate) return program.endDate;
  return today;
}

/**
 * Modal Nhật ký & Ghi nhận Buổi Check-in Định kỳ 1-1.
 * Dùng chung cho cả Mentor/Mentee (MyTechProjectsPage) và Quản lý (TechMentorshipPanel).
 */
export default function MentorshipCheckinModal({
  program,
  onClose,
  onCheckinAdded,
  initialOpenAddForm = false,
  isReadOnly = false,
  toast,
}) {
  const { user } = useAuth();
  const currentUid = user?.userId ?? user?.id;
  const isManagement = ['truong_phong', 'giam_doc_phong_ban', 'admin'].includes(user?.role);

  const [checkins, setCheckins] = useState([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [isAddingCheckin, setIsAddingCheckin] = useState(
    Boolean(initialOpenAddForm && !isReadOnly && program?.status === 'ACTIVE')
  );
  const [editingCheckin, setEditingCheckin] = useState(null);
  const [deletingCheckin, setDeletingCheckin] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const [checkinDate, setCheckinDate] = useState(() => getDefaultCheckinDate(program));
  const [topicsCovered, setTopicsCovered] = useState('');
  const [progressRating, setProgressRating] = useState('4');
  const [mentorFeedback, setMentorFeedback] = useState('');
  const [menteeNotes, setMenteeNotes] = useState('');
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  const resetFormFields = useCallback(() => {
    setCheckinDate(getDefaultCheckinDate(program));
    setTopicsCovered('');
    setProgressRating('4');
    setMentorFeedback('');
    setMenteeNotes('');
    setEditingCheckin(null);
  }, [program]);

  const openNewForm = () => {
    resetFormFields();
    setIsAddingCheckin(true);
  };

  const openEditForm = (chk) => {
    setEditingCheckin(chk);
    setCheckinDate(chk.checkinDate || getDefaultCheckinDate(program));
    setTopicsCovered(chk.topicsCovered || '');
    setProgressRating(String(chk.progressRating || 4));
    setMentorFeedback(chk.mentorFeedback || '');
    setMenteeNotes(chk.menteeNotes || '');
    setIsAddingCheckin(true);
  };

  const closeForm = () => {
    setIsAddingCheckin(false);
    resetFormFields();
  };

  const checkinDateError = useMemo(() => {
    if (!checkinDate) return 'Vui lòng chọn ngày check-in!';
    if (program?.startDate && checkinDate < program.startDate) {
      return `Ngày check-in không được trước ngày bắt đầu chương trình (${formatDateVN(program.startDate)})!`;
    }
    if (program?.endDate && checkinDate > program.endDate) {
      return `Ngày check-in không được vượt quá ngày kết thúc chương trình (${formatDateVN(program.endDate)})!`;
    }
    return '';
  }, [checkinDate, program?.startDate, program?.endDate]);

  const fetchCheckins = useCallback(async () => {
    if (!program?.id) return;
    try {
      setLoadingCheckins(true);
      const res = await api.get(`/api/tech/mentorship/programs/${program.id}/checkins`);
      if (res.data?.data) {
        setCheckins(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải nhật ký check-in', 'error');
    } finally {
      setLoadingCheckins(false);
    }
  }, [program?.id, toast]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  const handleSubmitCheckin = async (e) => {
    e.preventDefault();
    if (checkinDateError) {
      toast?.show('Ngày check-in không hợp lệ', checkinDateError, 'warning');
      return;
    }
    if (!topicsCovered.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập nội dung thảo luận / kiến thức ôn tập', 'warning');
      return;
    }

    try {
      setSubmittingCheckin(true);
      const payload = {
        checkinDate,
        topicsCovered: topicsCovered.trim(),
        progressRating: Number(progressRating),
        mentorFeedback: mentorFeedback.trim() || null,
        menteeNotes: menteeNotes.trim() || null,
      };
      if (editingCheckin) {
        const res = await api.put(`/api/tech/mentorship/checkins/${editingCheckin.id}`, payload);
        if (res.data?.data) {
          setCheckins((prev) =>
            prev
              .map((item) => (item.id === editingCheckin.id ? res.data.data : item))
              .sort((a, b) => (b.checkinDate || '').localeCompare(a.checkinDate || ''))
          );
          toast?.show('Thành công', 'Đã cập nhật buổi Check-in 1-1 thành công', 'success');
          closeForm();
          onCheckinAdded?.(res.data.data);
        }
      } else {
        const res = await api.post(`/api/tech/mentorship/programs/${program.id}/checkins`, payload);
        if (res.data?.data) {
          setCheckins((prev) => [res.data.data, ...prev]);
          toast?.show('Thành công', 'Đã ghi nhận buổi Check-in 1-1 thành công', 'success');
          closeForm();
          onCheckinAdded?.(res.data.data);
        }
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể lưu buổi check-in', 'error');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const handleDeleteCheckin = async () => {
    if (!deletingCheckin) return;
    try {
      setSubmittingDelete(true);
      await api.delete(`/api/tech/mentorship/checkins/${deletingCheckin.id}`);
      setCheckins((prev) => prev.filter((item) => item.id !== deletingCheckin.id));
      if (editingCheckin?.id === deletingCheckin.id) {
        closeForm();
      }
      toast?.show('Đã xóa', 'Đã xóa buổi check-in khỏi lịch sử', 'success');
      setDeletingCheckin(null);
      onCheckinAdded?.();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa buổi check-in', 'error');
    } finally {
      setSubmittingDelete(false);
    }
  };

  if (!program) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150"
      >
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
              <MessageSquare size={16} className="shrink-0" />
              <span className="truncate">Nhật ký Check-in 1-1: {program.programTitle}</span>
            </h3>
            <p className="text-xs text-blue-200/85 truncate mt-0.5">
              Mentor: <strong>{program.mentorName}</strong> • Mentee: <strong>{program.menteeName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/75 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {!isReadOnly && !isAddingCheckin && program.status === 'ACTIVE' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openNewForm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F2557] text-white hover:bg-blue-900 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Ghi nhận Check-in 1-1</span>
              </button>
            </div>
          )}

          {/* Form Ghi nhận / Chỉnh sửa Check-in */}
          {isAddingCheckin && (
            <form
              onSubmit={handleSubmitCheckin}
              className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-900">
                  {editingCheckin
                    ? `Chỉnh sửa Buổi Check-in (${formatDateVN(editingCheckin.checkinDate)})`
                    : 'Ghi nhận Buổi Check-in Định kỳ 1-1'}
                </h4>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Ngày check-in *
                  </label>
                  <input
                    type="date"
                    required
                    min={program.startDate || undefined}
                    max={program.endDate || undefined}
                    value={checkinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg outline-none ${
                      checkinDateError
                        ? 'border-red-400 bg-red-50/40 focus:border-red-500 text-red-700'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {program.startDate && program.endDate && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Trong khung chương trình: <strong>{formatDateVN(program.startDate)}</strong> →{' '}
                      <strong>{formatDateVN(program.endDate)}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Đánh giá Mức độ tiến bộ (1 - 5 sao) *
                  </label>
                  <select
                    value={progressRating}
                    onChange={(e) => setProgressRating(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (5 sao - Xuất sắc / Vượt tiến độ)</option>
                    <option value="4">⭐⭐⭐⭐ (4 sao - Tốt, đúng kế hoạch)</option>
                    <option value="3">⭐⭐⭐ (3 sao - Trung bình, đạt yêu cầu)</option>
                    <option value="2">⭐⭐ (2 sao - Chậm tiến độ)</option>
                    <option value="1">⭐ (1 sao - Rất chậm, cần hỗ trợ gấp)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nội dung thảo luận / Kiến thức ôn tập *
                </label>
                <textarea
                  rows={2}
                  required
                  value={topicsCovered}
                  onChange={(e) => setTopicsCovered(e.target.value)}
                  placeholder="VD: Review mô hình phân tầng Clean Architecture, giải quyết bài toán giao tiếp bất đồng bộ qua Kafka..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nhiệm vụ / Bài tập phiên tới &amp; Nhận xét Mentor
                </label>
                <textarea
                  rows={2}
                  value={mentorFeedback}
                  onChange={(e) => setMentorFeedback(e.target.value)}
                  placeholder="VD: Tự cài đặt 1 Consumer lắng nghe event và viết integration test..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Ghi chú thêm của Mentee (tùy chọn)
                </label>
                <input
                  type="text"
                  value={menteeNotes}
                  onChange={(e) => setMenteeNotes(e.target.value)}
                  placeholder="Câu hỏi hoặc khó khăn cần Mentor giải đáp thêm ở buổi sau..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              {checkinDateError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{checkinDateError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Đóng form
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckin || Boolean(checkinDateError)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingCheckin && <Loader2 size={13} className="animate-spin" />}
                  <span>
                    {submittingCheckin
                      ? 'Đang lưu...'
                      : editingCheckin
                        ? 'Lưu thay đổi'
                        : 'Lưu buổi Check-in'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Danh sách Lịch sử Check-in */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700">
                Lịch sử các buổi đã trao đổi ({checkins.length})
              </h4>
            </div>

            {loadingCheckins ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Đang tải lịch sử check-in...</span>
              </div>
            ) : checkins.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Chưa có buổi check-in nào được ghi nhận cho chương trình này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {checkins.map((chk) => {
                  const canModify =
                    !isReadOnly &&
                    program.status === 'ACTIVE' &&
                    (isManagement ||
                      String(chk.loggedBy) === String(currentUid) ||
                      String(program.mentorId) === String(currentUid));

                  return (
                    <div
                      key={chk.id}
                      className={`p-4 border rounded-xl space-y-2 text-xs transition ${
                        editingCheckin?.id === chk.id
                          ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            Ngày {formatDateVN(chk.checkinDate)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{chk.progressRating} / 5</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 tabular">
                            Ghi nhận bởi <strong>{chk.loggedByName || 'Kỹ sư'}</strong>
                          </span>
                          {canModify && (
                            <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
                              <button
                                type="button"
                                onClick={() => openEditForm(chk)}
                                title="Sửa buổi check-in này"
                                className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingCheckin(chk)}
                                title="Xóa buổi check-in này"
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold text-slate-800 leading-relaxed">{chk.topicsCovered}</p>
                        {chk.mentorFeedback && (
                          <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-100 text-[11px] text-blue-950 leading-relaxed">
                            <strong>Nhiệm vụ &amp; Nhận xét Mentor:</strong> {chk.mentorFeedback}
                          </div>
                        )}
                        {chk.menteeNotes && (
                          <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                            <strong>Ghi chú Mentee:</strong> {chk.menteeNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Modal Xác nhận Xóa buổi Check-in (z-[10000]) */}
      {deletingCheckin &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-slate-900/65 backdrop-blur-xs p-4 flex items-center justify-center"
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-in zoom-in-95 duration-150"
            >
              <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>Xác nhận Xóa Buổi Check-in 1-1</span>
                </h4>
                <button
                  type="button"
                  disabled={submittingDelete}
                  onClick={() => setDeletingCheckin(null)}
                  className="p-1 text-red-100 hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-2.5 text-xs text-slate-700">
                <p>
                  Bạn có chắc chắn muốn xóa buổi check-in ngày{' '}
                  <strong className="text-slate-900">{formatDateVN(deletingCheckin.checkinDate)}</strong>?
                </p>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 line-clamp-2">
                  {deletingCheckin.topicsCovered}
                </div>
                <p className="text-[11px] text-red-600 font-medium">
                  Điểm đánh giá trung bình và tổng số buổi check-in của chương trình sẽ được tính toán lại tự động.
                </p>
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submittingDelete}
                  onClick={() => setDeletingCheckin(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={submittingDelete}
                  onClick={handleDeleteCheckin}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingDelete && <Loader2 size={12} className="animate-spin" />}
                  <span>{submittingDelete ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>,
    document.body
  );
}
