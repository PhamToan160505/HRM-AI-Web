import React, { createContext, useState, useEffect, useContext } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { notificationService } from '../services/notification.service';
import { useAuth } from './AuthContext';
import { useToast } from '../components/common/Toast';

export const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentNotification, setUrgentNotification] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getNotifications();
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n) => !n.daDoc).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('hrm_token');
    
    if (user && token) {
      // 1. Lấy thông báo cũ
      fetchNotifications();

      // 2. Mở kết nối WebSocket
      connectSocket(token, (newNotif) => {
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
        
        if (newNotif.mucDo === 'khan') {
          setUrgentNotification(newNotif);
        }
      });
    }

    return () => {
      disconnectSocket();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, daDoc: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const closeUrgentModal = () => {
    if (urgentNotification) {
      if (!urgentNotification.isLocal) {
        markAsRead(urgentNotification.id);
      }
      setUrgentNotification(null);
    }
  };

  const openNotification = (notif) => {
    if (!notif.daDoc) markAsRead(notif.id);
    setSelectedNotification(notif);
  };

  const closeNotification = () => {
    setSelectedNotification(null);
  };

  const toast = useToast();

  const showNotification = (title, message, type = 'info') => {
    // We only trigger the big urgent modal for actual system-level urgent messages (websocket)
    // Local feedback should use the toast notification system.
    if (type === 'error' && !toast) {
       // fallback if toast isn't available
       setUrgentNotification({ tieuDe: title, noiDung: message, type, id: Date.now(), mucDo: 'khan', isLocal: true });
    } else if (toast) {
       toast.show(title, message, type);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        urgentNotification,
        selectedNotification,
        markAsRead,
        closeUrgentModal,
        openNotification,
        closeNotification,
        showNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
