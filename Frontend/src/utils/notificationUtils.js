/**
 * Hàm hỗ trợ chuyển đổi đường dẫn từ thông báo (notification link) sang route chính xác theo Role của người dùng hiện tại.
 * Hỗ trợ giữ nguyên query string (?tab=..., &worklogId=..., &month=...) và tự suy luận tab/tháng đích cho thông báo cũ.
 *
 * @param {string} link - Đường dẫn gốc lưu trong thông báo (VD: /manager/requests hoặc /manager/tech-projects?tab=timesheet&worklogId=12)
 * @param {string} userRole - Role của người dùng hiện tại (VD: 'giam_doc_phong_ban', 'ceo', 'truong_phong', 'nhan_vien')
 * @param {string} [notificationType] - Mã loại thông báo (VD: 'TECH_WORKLOG_SUBMITTED') để tự suy luận tab nếu link cũ chưa có query
 * @param {string} [notificationContent] - Nội dung thông báo (dùng suy luận tháng YYYY-MM cho thông báo worklog cũ chưa có param month)
 * @returns {string|null} - Đường dẫn đã được xử lý phù hợp với route thật của người dùng
 */
export function resolveNotificationLink(link, userRole, notificationType = '', notificationContent = '') {
    if (!link) return null;

    const [rawPathAndQuery, hashPart = ''] = String(link).split('#');
    const [rawPath, rawQuery = ''] = rawPathAndQuery.split('?');

    const rolePrefixes = {
        admin: '/admin',
        ceo: '/ceo',
        giam_doc_phong_ban: '/director',
        truong_phong: '/manager',
        nhan_vien: '/employee'
    };

    const targetPrefix = rolePrefixes[userRole] || '/employee';

    // Loại bỏ prefix cũ nếu đường dẫn chứa prefix của bất kỳ role nào (khớp theo segment)
    let cleanPath = rawPath || '/';
    for (const prefix of Object.values(rolePrefixes)) {
        if (cleanPath === prefix || cleanPath.startsWith(prefix + '/')) {
            cleanPath = cleanPath.substring(prefix.length) || '/';
            break;
        }
    }

    if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
    }

    // Xử lý các đường dẫn đặc thù cho vai trò Nhân viên vs Quản lý (khớp với route trong App.jsx)
    if (userRole === 'nhan_vien') {
        if (cleanPath === '/my-requests') cleanPath = '/requests';
        if (cleanPath === '/my-attendance') cleanPath = '/attendance';
        if (cleanPath === '/tech-projects') cleanPath = '/my-projects';
    } else {
        if (cleanPath === '/my-projects') cleanPath = '/tech-projects';
    }

    // Bảo toàn query params & bổ sung tab/tháng mặc định nếu là thông báo Tech cũ chưa gắn query
    const searchParams = new URLSearchParams(rawQuery);
    const typeUpper = String(notificationType || '').toUpperCase();
    if (!searchParams.get('tab') && (cleanPath === '/tech-projects' || cleanPath === '/my-projects')) {
        if (
            typeUpper === 'TECH_WORKLOG_SUBMITTED' ||
            typeUpper === 'TECH_WORKLOG_APPROVED' ||
            typeUpper === 'TECH_WORKLOG_REJECTED'
        ) {
            searchParams.set('tab', 'timesheet');
        } else if (typeUpper === 'TECH_SKILL_SUBMITTED') {
            searchParams.set('tab', userRole === 'nhan_vien' ? 'profile' : 'skills');
        } else if (typeUpper === 'TECH_SKILL_VERIFIED') {
            searchParams.set('tab', 'profile');
        } else if (
            typeUpper === 'TECH_PROJECT_ASSIGNED' ||
            typeUpper === 'TECH_PROJECT_UPDATED' ||
            typeUpper === 'TECH_PROJECT_REMOVED'
        ) {
            searchParams.set('tab', 'projects');
        }
    }

    if (
        !searchParams.get('month') &&
        searchParams.get('tab') === 'timesheet' &&
        typeUpper.startsWith('TECH_WORKLOG') &&
        notificationContent
    ) {
        const dateMatch = String(notificationContent).match(/\b(\d{4}-\d{2})-\d{2}\b/);
        if (dateMatch) {
            searchParams.set('month', dateMatch[1]);
        }
    }

    const queryString = searchParams.toString();
    const hashString = hashPart ? `#${hashPart}` : '';
    return `${targetPrefix}${cleanPath}${queryString ? `?${queryString}` : ''}${hashString}`;
}

let liveNotifTokenCounter = 0;

/**
 * Tạo token điều hướng 1 lần chỉ tồn tại trong bộ nhớ JS hiện tại (RAM).
 * Khi bấm F5 / Refresh, bộ nhớ JS bị xóa nên sẽ KHÔNG kích hoạt tự động cuộn lại.
 */
export function createLiveNotificationNavToken() {
    liveNotifTokenCounter += 1;
    const token = `${Date.now()}-${liveNotifTokenCounter}`;
    if (typeof window !== 'undefined') {
        window.__hrmLiveNotifNavToken = token;
    }
    return token;
}

export function isMatchingLiveNotificationNavToken(token) {
    if (!token || typeof window === 'undefined') return false;
    return Boolean(
        window.__hrmLiveNotifNavToken &&
        String(window.__hrmLiveNotifNavToken) === String(token)
    );
}

export function clearLiveNotificationNavToken(token = null) {
    if (typeof window === 'undefined') return;
    if (!token || String(window.__hrmLiveNotifNavToken) === String(token)) {
        window.__hrmLiveNotifNavToken = null;
    }
}
