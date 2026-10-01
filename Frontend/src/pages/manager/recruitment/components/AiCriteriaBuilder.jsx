import React from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';

const emptyCriterion = (index) => ({
  id: `C${index + 1}`,
  name: '',
  type: 'NICE',
  weight: '',
  synonymsText: '',
  evidenceExpected: ''
});

export default function AiCriteriaBuilder({
  criteria,
  onChange,
  onSuggest,
  suggesting,
  confirmed,
  onConfirmedChange,
  error
}) {
  const totalWeight = criteria.reduce((total, item) => total + (Number(item.weight) || 0), 0);

  const updateCriterion = (index, field, value) => {
    onChange(criteria.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addCriterion = () => {
    if (criteria.length < 8) onChange([...criteria, emptyCriterion(criteria.length)]);
  };

  const removeCriterion = (index) => {
    onChange(criteria
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item, itemIndex) => ({ ...item, id: `C${itemIndex + 1}` })));
  };

  return (
    <section className="space-y-4 border-t border-slate-100 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={19} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Bộ tiêu chí AI sàng lọc CV</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            AI đề xuất từ JD; người tuyển dụng phải kiểm tra và xác nhận. Tiêu chí chỉ hỗ trợ xếp hạng, không tự loại ứng viên.
          </p>
        </div>
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={16} className={suggesting ? 'animate-pulse' : ''} />
          {suggesting ? 'AI đang tạo...' : 'AI đề xuất tiêu chí'}
        </button>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
        <strong>MUST</strong> là yêu cầu bắt buộc cần được kiểm tra kỹ; <strong>NICE</strong> là lợi thế. Mỗi tiêu chí cần nêu rõ loại bằng chứng có thể tìm thấy trong CV.
      </div>

      {criteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Chưa có tiêu chí đánh giá</p>
          <p className="mt-1 text-xs text-slate-500">Nhập JD rồi để AI đề xuất, hoặc thêm tiêu chí thủ công.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {criteria.map((criterion, index) => (
            <div key={`${criterion.id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tên tiêu chí *</label>
                  <input
                    value={criterion.name}
                    onChange={(event) => updateCriterion(index, 'name', event.target.value)}
                    placeholder="VD: Kinh nghiệm Spring Boot"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Mức độ *</label>
                  <select
                    value={criterion.type}
                    onChange={(event) => updateCriterion(index, 'type', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="MUST">MUST - Bắt buộc</option>
                    <option value="NICE">NICE - Lợi thế</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Trọng số *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={criterion.weight}
                      onChange={(event) => updateCriterion(index, 'weight', event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="flex items-end md:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    aria-label={`Xóa tiêu chí ${index + 1}`}
                    className="flex h-[42px] w-full items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="md:col-span-5">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Từ khóa tương đương</label>
                  <input
                    value={criterion.synonymsText || ''}
                    onChange={(event) => updateCriterion(index, 'synonymsText', event.target.value)}
                    placeholder="Java Spring, Spring Framework (ngăn cách bằng dấu phẩy)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="md:col-span-7">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bằng chứng mong đợi trong CV *</label>
                  <input
                    value={criterion.evidenceExpected}
                    onChange={(event) => updateCriterion(index, 'evidenceExpected', event.target.value)}
                    placeholder="VD: Dự án đã làm, thời gian, vai trò và kết quả cụ thể"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addCriterion}
          disabled={criteria.length >= 8}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} /> {criteria.length >= 8 ? 'Đã đạt tối đa 8 tiêu chí' : 'Thêm tiêu chí thủ công'}
        </button>
        <div className={`text-sm font-semibold ${totalWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
          Tổng trọng số: {totalWeight}/100%
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-700">
          Tôi đã kiểm tra tiêu chí, trọng số và loại bằng chứng; bộ tiêu chí không chứa tuổi, giới tính hoặc thông tin nhạy cảm.
        </span>
      </label>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
    </section>
  );
}
