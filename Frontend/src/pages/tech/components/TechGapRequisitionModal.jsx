import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Plus, X, Loader2, Trash2, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

const LEVELS = ['FRESHER', 'JUNIOR', 'MIDDLE', 'SENIOR', 'EXPERT'];

const parseDigits = (val) => String(val || '').replace(/\D/g, '').slice(0, 12);

const formatVndDots = (digits) => {
  if (!digits) return '';
  const num = Number(digits);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toLocaleString('vi-VN');
};

const composeBudgetString = (minDigits, maxDigits) => {
  const minFmt = formatVndDots(minDigits);
  const maxFmt = formatVndDots(maxDigits);
  if (minFmt && maxFmt) return `${minFmt} VNĐ - ${maxFmt} VNĐ`;
  if (minFmt) return `Từ ${minFmt} VNĐ`;
  if (maxFmt) return `Đến ${maxFmt} VNĐ`;
  return null;
};

/**
 * Modal 1 chạm cho Trưởng phòng / Giám đốc Công nghệ gửi Yêu cầu Tuyển dụng (JobRequisition)
 * sang Phòng Nhân sự từ bối cảnh thiếu hụt kỹ năng / quá tải Bench / thiếu người dự án.
 */
export default function TechGapRequisitionModal({
  isOpen,
  onClose,
  project = null,
  projects = [],
  availableSkills = [],
  initialSkills = [],
  initialReason = '',
  onSuccess,
}) {
  const toast = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [capBac, setCapBac] = useState('Senior');
  const [soLuong, setSoLuong] = useState(1);
  const [urgencyLevel, setUrgencyLevel] = useState('HIGH');
  const [hinhThucLamViec, setHinhThucLamViec] = useState('Toàn thời gian');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [pickSkillId, setPickSkillId] = useState('');
  const [pickMinLevel, setPickMinLevel] = useState('SENIOR');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedProjectId(project?.id ? String(project.id) : '');
    const defaultTitle = project
      ? `Kỹ sư Phần mềm cho dự án ${project.projectCode}`
      : initialSkills.length > 0
        ? `Kỹ sư ${initialSkills[0].skillName}`
        : 'Kỹ sư Phần mềm Fullstack / Backend';
    setTitle(defaultTitle);
    setCapBac(initialSkills[0]?.minLevel === 'EXPERT' ? 'Expert' : 'Senior');
    setSoLuong(1);
    setUrgencyLevel(project ? 'HIGH' : 'NORMAL');
    setBudgetMin('');
    setBudgetMax('');
    setReason(
      initialReason ||
        (project
          ? `Dự án ${project.projectCode} (${project.projectName}) đang thiếu nhân lực kỹ thuật đúng chuyên môn để đảm bảo tiến độ Milestone.`
          : 'Thiếu hụt nhân sự nội bộ trên Ma trận Năng lực & Ghế chờ Bench đạt ngưỡng tải cao.')
    );
    setDescription(
      project
        ? `Tham gia trực tiếp phát triển dự án ${project.projectCode} - ${project.projectName}, đảm bảo chất lượng mã nguồn theo chuẩn DoD và phối hợp chặt chẽ cùng Tech Lead.`
        : 'Tham gia phát triển các hệ thống phần mềm trọng điểm của Phòng Công nghệ, thiết kế kiến trúc sạch và tối ưu hiệu năng.'
    );
    setSelectedSkills(
      (initialSkills || []).map((s) => ({
        skillId: s.skillId || s.id,
        skillName: s.skillName,
        minLevel: s.minLevel || 'SENIOR',
      }))
    );
  }, [isOpen, project, initialSkills, initialReason]);

  if (!isOpen) return null;

  const handleAddSkill = () => {
    if (!pickSkillId) return;
    const found = availableSkills.find((s) => String(s.id) === String(pickSkillId));
    if (!found) return;
    if (selectedSkills.some((s) => String(s.skillId) === String(found.id))) return;
    setSelectedSkills((prev) => [
      ...prev,
      { skillId: found.id, skillName: found.skillName, minLevel: pickMinLevel },
    ]);
    setPickSkillId('');
  };

  const budgetRangeInvalid =
    Boolean(budgetMin) && Boolean(budgetMax) && Number(budgetMax) < Number(budgetMin);
  const composedBudgetPreview = composeBudgetString(budgetMin, budgetMax);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập tiêu đề vị trí và lý do tuyển dụng', 'warning');
      return;
    }
    if (budgetRangeInvalid) {
      toast?.show(
        'Ngân sách chưa hợp lệ',
        'Mức ngân sách "Đến khoảng" phải lớn hơn hoặc bằng mức "Từ khoảng"',
        'warning'
      );
      return;
    }

    try {
      setSubmitting(true);
      const effectiveProjectId = project?.id || (selectedProjectId ? Number(selectedProjectId) : null);
      const payload = {
        techProjectId: effectiveProjectId,
        title: title.trim(),
        targetRole: 'NHAN_VIEN',
        soLuong: Number(soLuong) || 1,
        capBac,
        hinhThucLamViec,
        budget: composedBudgetPreview,
        urgencyLevel,
        reason: reason.trim(),
        description: description.trim(),
        requiredSkills: selectedSkills,
      };
      const res = await api.post('/api/tech-hr/requisitions/from-gap', payload, {
        headers: { 'Idempotency-Key': `tech-gap-${Date.now()}` },
      });
      toast?.show(
        'Đã gửi sang Phòng Nhân sự',
        `Yêu cầu tuyển dụng "${title.trim()}" đã được khởi tạo và chuyển vào luồng duyệt tuyển dụng HR`,
        'success'
      );
      onSuccess?.(res.data?.data);
      onClose?.();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể gửi yêu cầu tuyển dụng', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Briefcase size={17} />
              <span>Đề xuất Tuyển dụng từ Thiếu hụt Kỹ thuật → Phòng Nhân sự</span>
            </h3>
            <p className="text-xs text-blue-200/85 mt-0.5">
              {project
                ? `Liên kết trực tiếp với dự án ${project.projectCode} — ${project.projectName}`
                : 'Tự động đính kèm chuẩn kỹ năng từ Ma trận Năng lực sang luồng Tuyển dụng HR'}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Chức danh / Vị trí cần tuyển *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Senior Java Spring Boot Engineer"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {!project && projects.length > 0 && (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Dự án liên kết (tùy chọn — giúp HR &amp; Tech theo dõi tiến độ tuyển theo dự án)
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Không gắn dự án cụ thể (Bổ sung nguồn lực chung) --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.projectName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Cấp bậc mục tiêu *</label>
              <select
                value={capBac}
                onChange={(e) => setCapBac(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
              >
                <option value="Fresher">Fresher</option>
                <option value="Junior">Junior</option>
                <option value="Middle">Middle</option>
                <option value="Senior">Senior</option>
                <option value="Expert / Tech Lead">Expert / Tech Lead</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Hình thức làm việc</label>
              <select
                value={hinhThucLamViec}
                onChange={(e) => setHinhThucLamViec(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
              >
                <option value="Toàn thời gian">Toàn thời gian (Onsite)</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Số lượng *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={soLuong}
                onChange={(e) => setSoLuong(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 tabular"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Mức độ gấp</label>
              <select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white font-semibold"
              >
                <option value="NORMAL">Bình thường</option>
                <option value="HIGH">Cao (Gấp)</option>
                <option value="CRITICAL">Khẩn cấp (Ảnh hưởng Milestone)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-bold text-slate-700">
                  Ngân sách dự kiến (VNĐ — tùy chọn)
                </label>
                {composedBudgetPreview && !budgetRangeInvalid && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full tabular">
                    {composedBudgetPreview}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
                <div className="sm:col-span-5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                    Từ khoảng
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatVndDots(budgetMin)}
                    onChange={(e) => setBudgetMin(parseDigits(e.target.value))}
                    placeholder="25.000.000"
                    className={`w-full pl-[74px] pr-11 py-2 text-xs text-right font-semibold tabular border rounded-xl outline-none transition ${
                      budgetRangeInvalid
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/40'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 pointer-events-none">
                    VNĐ
                  </span>
                </div>

                <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-slate-400 font-bold text-xs">
                  —
                </div>

                <div className="sm:col-span-5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                    Đến khoảng
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatVndDots(budgetMax)}
                    onChange={(e) => setBudgetMax(parseDigits(e.target.value))}
                    placeholder="35.000.000"
                    className={`w-full pl-[82px] pr-11 py-2 text-xs text-right font-semibold tabular border rounded-xl outline-none transition ${
                      budgetRangeInvalid
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/40'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 pointer-events-none">
                    VNĐ
                  </span>
                </div>
              </div>
              {budgetRangeInvalid && (
                <p className="text-[11px] font-semibold text-rose-600">
                  Mức ngân sách &quot;Đến khoảng&quot; phải lớn hơn hoặc bằng mức &quot;Từ khoảng&quot;.
                </p>
              )}
            </div>
          </div>

          {/* Tech Skills selector */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0F2557] flex items-center gap-1.5">
                <Sparkles size={13} className="text-blue-600" />
                <span>Bộ Kỹ năng Kỹ thuật chuẩn hóa gửi HR ({selectedSkills.length})</span>
              </span>
            </div>

            {availableSkills.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={pickSkillId}
                  onChange={(e) => setPickSkillId(e.target.value)}
                  className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn kỹ năng từ danh mục Tech --</option>
                  {availableSkills.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.skillName} ({sk.category})
                    </option>
                  ))}
                </select>
                <select
                  value={pickMinLevel}
                  onChange={(e) => setPickMinLevel(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      Tối thiểu: {lv}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Thêm</span>
                </button>
              </div>
            )}

            {selectedSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedSkills.map((sk, idx) => (
                  <span
                    key={`${sk.skillId}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-xs font-semibold text-blue-900"
                  >
                    <span>
                      {sk.skillName} • <strong>{sk.minLevel}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSkills((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Chưa chọn kỹ năng cụ thể. Nên đính kèm kỹ năng để HR sàng lọc CV AI chính xác hơn.
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Lý do tuyển dụng (từ dữ liệu tải dự án / Bench) *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Mô tả công việc (JD tóm tắt gửi HR) *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.()}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            <span>{submitting ? 'Đang gửi sang HR...' : 'Gửi Yêu cầu Tuyển dụng sang HR'}</span>
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
