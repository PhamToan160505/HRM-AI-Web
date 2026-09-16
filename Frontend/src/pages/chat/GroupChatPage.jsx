import React, { useState, useEffect } from 'react';
import { chatService } from '../../services/chat.service';
import ChatWindow from '../../components/chat/ChatWindow';
import { Users, MessageSquare } from 'lucide-react';

export default function GroupChatPage() {
    const [groups, setGroups] = useState([]);
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await chatService.getMyGroups();
                if (res.success) {
                    setGroups(res.data);
                    setActiveGroupId(prev => {
                        if (!prev && res.data.length > 0) return res.data[0].id;
                        return prev;
                    });
                }
            } catch (error) {
                console.error('Error fetching chat groups', error);
            } finally {
                setLoading(false);
            }
        };
        fetchGroups();

        window.addEventListener('chatRead', fetchGroups);
        return () => window.removeEventListener('chatRead', fetchGroups);
    }, []);

    const activeGroup = groups.find(g => g.id === activeGroupId);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Đang tải danh sách nhóm...</div>;
    }

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-white">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare size={20} className="text-blue-600" />
                        Thảo luận nhóm
                    </h2>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {groups.map(group => {
                        const isUnread = group.latestMessageId && group.latestMessageId > 0 && (group.lastReadMessageId == null || group.lastReadMessageId < group.latestMessageId);
                        return (
                        <div 
                            key={group.id}
                            onClick={() => {
                                setActiveGroupId(group.id);
                                // Optimistically mark as read
                                setGroups(prev => prev.map(g => g.id === group.id ? { ...g, lastReadMessageId: Math.max(g.lastReadMessageId || 0, g.latestMessageId || 0) } : g));
                            }}
                            className={`p-4 border-b border-slate-100 cursor-pointer transition-colors flex items-center gap-3 relative ${activeGroupId === group.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-100 border-l-4 border-l-transparent'}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm border border-blue-50 relative">
                                <Users size={20} />
                                {isUnread && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-semibold flex items-center justify-between ${activeGroupId === group.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {group.name}
                                </h3>
                                <p className={`text-xs line-clamp-1 ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                    {group.type === 'EXECUTIVE' ? 'Nhóm Ban giám đốc' : 'Nhóm Phòng ban'}
                                </p>
                            </div>
                        </div>
                    )})}
                    {groups.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            Bạn chưa tham gia nhóm chat nào.
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 relative">
                {activeGroup ? (
                    <ChatWindow group={activeGroup} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageSquare size={64} className="mb-4 opacity-20" />
                        <p>Chọn một nhóm để bắt đầu thảo luận</p>
                    </div>
                )}
            </div>
        </div>
    );
}