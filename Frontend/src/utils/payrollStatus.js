/** Trạng thái kỳ lương phòng ban (luồng do phòng Tài chính - Kế toán điều phối). */
export const BATCH_STATUS = {
    OPEN: { label: 'Chưa chốt công', className: 'bg-slate-100 text-slate-600' },
    ATTENDANCE_REOPENED: { label: 'Đã mở lại công', className: 'bg-slate-100 text-slate-600' },
    ATTENDANCE_CLOSED: { label: 'Đã chốt công — chờ kế toán', className: 'bg-sky-100 text-sky-700' },
    DRAFT: { label: 'Kế toán đã tính — nháp', className: 'bg-amber-100 text-amber-700' },
    PENDING_DIRECTOR: { label: 'Chờ GĐ phòng xác nhận', className: 'bg-amber-100 text-amber-700' },
    PENDING_CHIEF_ACCOUNTANT: { label: 'Chờ kế toán trưởng', className: 'bg-amber-100 text-amber-700' },
    PENDING_CEO: { label: 'Chờ CEO chốt', className: 'bg-violet-100 text-violet-700' },
    APPROVED_BY_CEO: { label: 'CEO đã chốt — chờ chi', className: 'bg-emerald-100 text-emerald-700' },
    PAID: { label: 'Đã chi trả', className: 'bg-emerald-600 text-white' },
    REJECTED: { label: 'Bị từ chối', className: 'bg-rose-100 text-rose-700' },
};

export const REJECT_STAGE_LABEL = {
    DIRECTOR: 'Giám đốc phòng ban',
    CHIEF_ACCOUNTANT: 'Kế toán trưởng',
    CEO: 'Tổng Giám đốc',
};
