import React, { createContext, useState, useEffect, useContext } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { notificationService } from '../services/notification.service';
import { useAuth } from './AuthContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentNotification, setUrgentNotification] = useState(null);

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
      markAsRead(urgentNotification.id);
      setUrgentNotification(null);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        urgentNotification,
        markAsRead,
        closeUrgentModal,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
