/**
 * Hàm hỗ trợ chuyển đổi đường dẫn từ thông báo (notification link) sang route chính xác theo Role của người dùng hiện tại.
 *
 * @param {string} link - Đường dẫn gốc lưu trong thông báo (VD: /manager/requests)
 * @param {string} userRole - Role của người dùng hiện tại (VD: 'giam_doc_phong_ban', 'ceo', 'truong_phong', 'nhan_vien')
 * @returns {string} - Đường dẫn đã được xử lý phù hợp với route thật của người dùng
 */
export function resolveNotificationLink(link, userRole) {
    if (!link) return null;

    const rolePrefixes = {
        admin: '/admin',
        ceo: '/ceo',
        giam_doc_phong_ban: '/director',
        truong_phong: '/manager',
        nhan_vien: '/employee'
    };

    const targetPrefix = rolePrefixes[userRole] || '/employee';

    // Loại bỏ prefix cũ nếu đường dẫn chứa prefix của bất kỳ role nào
    let cleanPath = link;
    for (const prefix of Object.values(rolePrefixes)) {
        if (cleanPath.startsWith(prefix)) {
            cleanPath = cleanPath.substring(prefix.length);
            break;
        }
    }

    if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
    }

    // Xử lý các đường dẫn đặc thù cho vai trò Nhân viên vs Quản lý
    if (userRole === 'nhan_vien') {
        if (cleanPath === '/requests') cleanPath = '/my-requests';
        if (cleanPath === '/attendance') cleanPath = '/my-attendance';
    } else {
        if (cleanPath === '/my-requests') cleanPath = '/requests';
        if (cleanPath === '/my-attendance') cleanPath = '/attendance';
    }

    return targetPrefix + cleanPath;
}
