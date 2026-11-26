export const labels = {
  NEW: 'Mới tiếp nhận', QUALIFIED: 'Đã xác định nhu cầu', PROPOSAL: 'Đề xuất giải pháp',
  NEGOTIATION: 'Đàm phán', WON: 'Chốt thành công', LOST: 'Chốt thất bại',
  DRAFT: 'Bản nháp', PENDING_TECHNICAL: 'Chờ Phòng Công nghệ thẩm định', PENDING_APPROVAL: 'Chờ duyệt', RETURNED: 'Cần bổ sung',
  APPROVED: 'Đã duyệt', SENT: 'Đã gửi khách hàng', ACCEPTED: 'Đã chấp thuận',
  PENDING_REVIEW: 'Chờ rà soát hợp đồng', READY_TO_SIGN: 'Sẵn sàng ký', SIGNED_PENDING_CONFIRMATION: 'Chờ đối chiếu bản ký', SIGNED_RETURNED: 'Cần bổ sung bản ký', CONFIRMED: 'Đã xác nhận bản ký', CANCELLED: 'Đã hủy nháp', SUPERSEDED: 'Đã được thay thế',
  DECLINED: 'Đã từ chối', PENDING: 'Chờ tiếp nhận',
};

export const money = value => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(Number(value || 0));

export function dateText(value) {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function departmentKind(name = '') {
  const value = (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  if (['kinh doanh', 'phong kinh doanh'].includes(value)) return 'SALES';
  if ([
    'tai chinh - ke toan', 'phong tai chinh - ke toan',
    'tai chinh ke toan', 'phong tai chinh ke toan',
    'cong nghe', 'phong cong nghe',
    'ke toan', 'phong ke toan',
    'ky thuat', 'phong ky thuat',
  ].includes(value)) return 'RECEIVER';
  return 'OTHER';
}

export function roleBase(role) {
  return { ceo: '/ceo', giam_doc_phong_ban: '/director', truong_phong: '/manager', nhan_vien: '/employee' }[role] || '/login';
}

export const approvalLabels = { STANDARD: 'Đủ điều kiện gửi chuẩn', MANAGER: 'Trưởng phòng', DIRECTOR: 'Giám đốc Kinh doanh', CEO: 'CEO / người được ủy quyền' };
