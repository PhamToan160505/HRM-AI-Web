import api from './api';

export const chatService = {
    getMyGroups: async () => {
        const response = await api.get('/api/chat/groups');
        return response.data;
    },
    
    getGroupMessages: async (groupId, page = 0, size = 50) => {
        const response = await api.get(`/api/chat/groups/${groupId}/messages`, {
            params: { page, size }
        });
        return response.data;
    },
    
    getGroupMembers: async (groupId) => {
        const response = await api.get(`/api/chat/groups/${groupId}/members`);
        return response.data;
    },
    
    markAsRead: async (groupId, messageId) => {
        const response = await api.post(`/api/chat/groups/${groupId}/read`, { messageId });
        return response.data;
    }
};

