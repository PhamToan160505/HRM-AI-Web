import api from './api';

export const requestService = {
  createRequest: async (data) => {
    const response = await api.post('/api/requests', data);
    return response.data;
  },
  getMyRequests: async () => {
    const response = await api.get('/api/requests/me');
    return response.data;
  },
  getRequestsForManager: async () => {
    const response = await api.get('/api/requests/management');
    return response.data;
  },
  approveRequest: async (id, note = '') => {
    const response = await api.post(`/api/requests/${id}/approve`, { note });
    return response.data;
  },
  rejectRequest: async (id, note = '') => {
    const response = await api.post(`/api/requests/${id}/reject`, { note });
    return response.data;
  },
  getLeaveQuota: async () => {
    const response = await api.get('/api/requests/leave-quota');
    return response.data;
  },
  getMonthlySummary: async () => {
    const response = await api.get('/api/requests/monthly-summary');
    return response.data;
  }
};
