import api from './api';

export const notificationService = {
  getNotifications: async () => {
    const response = await api.get('/api/notifications');
    return response.data; // { success, data, message }
  },

  markAsRead: async (id) => {
    const response = await api.patch(`/api/notifications/${id}/read`);
    return response.data;
  },

  // Test WebSocket only (Dev)
  testSendNotification: async () => {
    const response = await api.post('/api/notifications/test-send');
    return response.data;
  }
};
