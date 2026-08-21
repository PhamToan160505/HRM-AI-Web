import React, { useContext } from 'react';
import { NotificationContext } from '../../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale/vi';

const NotificationPanel = ({ onClose }) => {
  const { notifications, markAsRead, openNotification } = useContext(NotificationContext);

  return (
    <div className="flex flex-col h-96">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Thông báo</h3>
        {/* Có thể thêm nút "Đánh dấu tất cả đã đọc" ở đây */}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>Không có thông báo nào</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <li 
                key={notif.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.daDoc ? 'bg-blue-50/50' : ''}`}
                onClick={() => {
                  openNotification(notif);
                }}
              >
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-sm ${!notif.daDoc ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
                        {notif.tieuDe}
                      </p>
                      {notif.mucDo === 'khan' && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 shrink-0">
                          Khẩn cấp
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {notif.noiDung}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: vi })}
                    </p>
                  </div>
                  {!notif.daDoc && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
