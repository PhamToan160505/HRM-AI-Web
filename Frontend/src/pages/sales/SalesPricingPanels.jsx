import React from 'react';
import { DataTable, buttonClass } from './SalesComponents';
import { money, approvalLabels } from './salesUtils';

export function SalesPolicyPanel({ policy, ceo, open }) {
  if (!policy) return null;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Chính sách giá · phiên bản {policy.id}</h2>{ceo && <button className={buttonClass} onClick={() => open('policy', {
      version: policy.id, enabled: !!policy.enabled, standardMax: policy.standard_max, managerMax: policy.manager_max,
      directorMax: policy.director_max, managerDiscount: policy.manager_discount, directorDiscount: policy.director_discount,
      standardTerms: policy.standard_terms, ceoDelegateId: policy.ceo_delegate_id || '', changeReason: '',
    }, { title: 'Công bố chính sách giá' })}>Công bố phiên bản mới</button>}</div>
    <p className="text-sm text-slate-600">{policy.enabled ? 'Đang áp dụng cho báo giá mới.' : 'Chưa kích hoạt. CEO cần nhập hạn mức được công ty thông qua.'} Giá trị xét hạn mức là giá trị lớn nhất giữa giá niêm yết và giá chào trước/sau giảm.</p>
    <DataTable rows={[
      { id: 'standard', level: 'Gửi chuẩn trực tiếp', amount: policy.standard_max, discount: 0, condition: 'Đúng giá, gói, phạm vi và điều khoản chuẩn' },
      { id: 'manager', level: 'Trưởng phòng', amount: policy.manager_max, discount: policy.manager_discount, condition: 'Đủ cả hạn mức giá trị, chiết khấu và giá sàn' },
      { id: 'director', level: 'Giám đốc Kinh doanh', amount: policy.director_max, discount: policy.director_discount, condition: 'Đủ cả hạn mức giá trị, chiết khấu và giá sàn' },
    ]} columns={[{ key: 'level', label: 'Cấp xử lý' }, { key: 'amount', label: 'Giá trị tối đa', render: row => money(row.amount) }, { key: 'discount', label: 'Giảm tối đa', render: row => `${row.discount}%` }, { key: 'condition', label: 'Điều kiện' }]} />
    <p className="text-sm text-slate-700">CEO duyệt khi vượt hạn mức Giám đốc, dưới giá sàn, miễn phí, điều khoản khác chuẩn, độc quyền nền tảng hoặc ngoại lệ nguồn lực/chiến lược. Tùy chỉnh phạm vi hoặc công nghệ được Kỹ thuật thẩm định trước. Người lập không tự duyệt ngoại lệ.</p>
    <div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="mb-2 font-semibold">Điều khoản chuẩn</h3><p className="whitespace-pre-wrap text-sm">{policy.standard_terms || 'Chưa thiết lập điều khoản chuẩn.'}</p></div>
    <p className="text-sm text-slate-600">Lý do công bố · {policy.change_reason}{policy.ceo_delegate_id && ` · Đã ủy quyền duyệt cấp CEO cho người dùng #${policy.ceo_delegate_id}`}</p>
  </section>;
}

export function QuoteRoutingDetail({ detail }) {
  const quote = detail.quotation;
  let snapshot;
  try { snapshot = typeof quote.policy_snapshot === 'string' ? JSON.parse(quote.policy_snapshot) : quote.policy_snapshot; } catch { snapshot = null; }
  return <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
    <p className="font-semibold">Tuyến xử lý · {approvalLabels[quote.approval_level] || 'Chưa xác định'}</p>
    <p>{quote.routing_reasons || 'Bản nháp sẽ được kiểm tra khi trình hoặc gửi trực tiếp theo giá chuẩn.'}</p>
    {quote.approval_level === 'STANDARD' && <p>Hệ thống xác nhận đủ điều kiện theo chính sách; không có người tự phê duyệt.</p>}
    {quote.pricing_policy_id && <p>Áp dụng chính sách #{quote.pricing_policy_id}. Hạn mức tại thời điểm trình: chuẩn {money(snapshot?.standard_max)} · Trưởng phòng {money(snapshot?.manager_max)} / {snapshot?.manager_discount}% · Giám đốc {money(snapshot?.director_max)} / {snapshot?.director_discount}%.</p>}
    {quote.exception_note && <p className="whitespace-pre-wrap">Giải trình · {quote.exception_note}</p>}
    {detail.reviews?.map(review => <div key={review.id} className="space-y-1 border-t border-blue-200 pt-3">
      <p className="font-semibold">Kỹ thuật · {review.reviewer_name} · {review.approved ? 'Khả thi' : 'Trả về'} · {review.effort_days} ngày công</p>
      <p>{review.feasibility}</p><p>Tiến độ · {review.delivery_plan}</p><p>Nguồn lực · {review.resource_needs}</p>
      {review.requires_executive && <p>Cần CEO quyết định nguồn lực / chi phí.</p>}
    </div>)}
  </div>;
}
