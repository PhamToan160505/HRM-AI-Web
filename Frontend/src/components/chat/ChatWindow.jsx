import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Users, X, MoreVertical, Trash2, EyeOff, ArrowDown } from 'lucide-react';
import { chatService } from '../../services/chat.service';
import { useAuth } from '../../context/AuthContext';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export default function ChatWindow({ group }) {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [showAiOptions, setShowAiOptions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [mentionFilter, setMentionFilter] = useState('');
    const [unreadTargetId, setUnreadTargetId] = useState(null);
    const messagesEndRef = useRef(null);
    const clientRef = useRef(null);
    const highlightRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const scrollToUnread = () => {
        if (unreadTargetId) {
            const el = document.getElementById(`message-${unreadTargetId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setUnreadTargetId(null);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [msgRes, memRes] = await Promise.all([
                    chatService.getGroupMessages(group.id, 0, 50),
                    chatService.getGroupMembers(group.id)
                ]);
                if (msgRes.success) {
                    const loadedMessages = msgRes.data.content.reverse();
                    setMessages(loadedMessages);
                    
                    if (group.latestMessageId && group.latestMessageId > (group.lastReadMessageId || 0)) {
                        chatService.markAsRead(group.id, group.latestMessageId).then(() => {
                            window.dispatchEvent(new Event('chatRead'));
                        }).catch(console.error);
                        
                        const firstUnread = loadedMessages.find(m => m.id > (group.lastReadMessageId || 0));
                        if (firstUnread) {
                            setUnreadTargetId(firstUnread.id);
                        }
                    }
                }
                if (memRes.success) {
                    setMembers(memRes.data);
                }
            } catch (error) {
                console.error('Error loading data', error);
            } finally {
                setLoading(false);
                setTimeout(scrollToBottom, 100);
            }
        };

        if (group) {
            loadInitialData();
            setSelectedTags([]);
        }

        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
            connectHeaders: {
                Authorization: `Bearer ${token}`
            },
            debug: (str) => {
                console.log('STOMP: ' + str);
            },
            onConnect: () => {
                console.log('STOMP Connected');
                client.subscribe(`/topic/group/${group.id}`, (msg) => {
                    const newMsg = JSON.parse(msg.body);
                    
                    if (newMsg.type === 'RECALL') {
                        setMessages(prev => {
                            if (newMsg.mode === 'SENDER') {
                                if (newMsg.senderId === user.userId) {
                                    return prev.filter(m => m.id !== newMsg.messageId);
                                }
                                return prev;
                            } else if (newMsg.mode === 'EVERYONE') {
                                return prev.map(m => 
                                    m.id === newMsg.messageId 
                                        ? { ...m, isRecalled: true, content: 'Tin nhắn đã bị thu hồi' } 
                                        : m
                                );
                            }
                            return prev;
                        });
                        return;
                    }
                    
                    // Lọc tin nhắn AI private không thuộc về user hiện tại
                    if (newMsg.privateUserId && newMsg.privateUserId !== -1 && newMsg.privateUserId !== user.userId) {
                        return; // Bỏ qua tin nhắn
                    }
                    
                    setMessages(prev => [...prev, newMsg]);
                    setTimeout(scrollToBottom, 100);
                    
                    // Mark as read automatically since the chat window is open
                    if (newMsg.id) {
                        chatService.markAsRead(group.id, newMsg.id).then(() => {
                            window.dispatchEvent(new Event('chatRead'));
                        }).catch(console.error);
                    }
                });
            },
            onStompError: (frame) => {
                console.error('Broker reported error: ' + frame.headers['message']);
                console.error('Additional details: ' + frame.body);
            },
            onWebSocketError: (evt) => {
                console.error('WebSocket Error: ', evt);
            }
        });

        client.activate();
        clientRef.current = client;

        return () => {
            if (clientRef.current) {
                clientRef.current.deactivate();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id, token, user.userId]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.recall-menu-container')) {
                setActiveMenuId(null);
            }
        };
        if (activeMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenuId]);

    const handleShowMembers = () => {
        setShowMembers(true);
    };

    const handleRecall = (messageId, mode) => {
        if (clientRef.current && clientRef.current.connected) {
            clientRef.current.publish({
                destination: '/app/chat.recallMessage',
                body: JSON.stringify({ messageId, mode })
            });
            setActiveMenuId(null);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        if (clientRef.current && clientRef.current.connected) {
            clientRef.current.publish({
                destination: '/app/chat.sendMessage',
                body: JSON.stringify({
                    groupId: group.id,
                    content: inputValue.trim(),
                    taggedUserIds: selectedTags
                })
            });
            setInputValue('');
            setSelectedTags([]);
            setShowAiOptions(false);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        
        const match = val.match(/(?:^|\s)@([^@]*)$/);
        if (match) {
            setMentionFilter(match[1].toLowerCase());
            setShowAiOptions(true);
            // Don't reset selectedIndex here if we want to keep it stable, but resetting is safer
            setSelectedIndex(0);
        } else {
            setShowAiOptions(false);
        }
    };

    const allMentions = [
        { id: 'ai-pv', name: 'AI-pv', label: 'Hỏi AI (Riêng tư)', role: 'AI Assistant', isAi: true },
        { id: 'ai-pl', name: 'AI-pl', label: 'Hỏi AI (Công khai)', role: 'AI Assistant', isAi: true },
        { id: 'all', name: 'All', label: 'Tất cả mọi người', role: 'Mọi người' },
        ...members.filter(m => m.userId !== user.userId).map(m => ({
            id: m.userId,
            name: m.hoTen,
            label: m.hoTen,
            role: m.role
        }))
    ];

    const filteredMentions = allMentions.filter(m => m.name.toLowerCase().includes(mentionFilter));

    const insertMention = (mention) => {
        const val = inputValue;
        const lastAtIndex = val.lastIndexOf('@');
        const beforeAt = val.substring(0, lastAtIndex);
        
        const newText = beforeAt + '@' + mention.name + ' ';
        setInputValue(newText);
        setShowAiOptions(false);
        
        if (mention.id === 'all') {
            setSelectedTags(prev => [...prev.filter(id => id !== -1), -1]);
        } else if (!mention.isAi) {
            if (!selectedTags.includes(mention.id)) {
                setSelectedTags(prev => [...prev, mention.id]);
            }
        }
        // Keep focus on input would be nice, but since this fires from click or enter, 
        // the input might already have focus or can be ignored.
    };

    const handleKeyDown = (e) => {
        if (showAiOptions && filteredMentions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredMentions.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredMentions[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowAiOptions(false);
            }
        }
    };

    const formatTime = (dateStr) => {
        try {
            const date = new Date(dateStr);
            const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const dateStrFormatted = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${timeStr} - ${dateStrFormatted}`;
        } catch {
            return '';
        }
    };

    const handleInputScroll = (e) => {
        if (highlightRef.current) {
            highlightRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const renderHighlightedInput = (text) => {
        if (!text) return null;
        
        // Match @AI-pv, @AI-pl, @All, and any member names from ALL available members
        const names = allMentions.map(m => m.name).filter(n => n);
        if (names.length === 0) return <span className="text-slate-800">{text}</span>;
        
        // Escape special characters in names for regex
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))\\b`, 'g');
        
        const parts = text.split(pattern);
        
        return parts.map((part, index) => {
            if (part === '@AI-pv') {
                return (
                    <span key={index} className="bg-orange-100 text-orange-700 rounded-sm">
                        {part}
                    </span>
                );
            }
            if (part === '@AI-pl') {
                return (
                    <span key={index} className="bg-emerald-100 text-emerald-700 rounded-sm">
                        {part}
                    </span>
                );
            }
            if (part === '@All' || part.startsWith('@')) {
                // Check if it's actually one of the tags
                const nameWithoutAt = part.substring(1);
                if (names.includes(nameWithoutAt)) {
                    return (
                        <span key={index} className="bg-blue-100 text-blue-700 rounded-sm font-medium">
                            {part}
                        </span>
                    );
                }
            }
            return <span key={index}>{part}</span>;
        });
    };

    const renderMessageContent = (content, isMe, isAi) => {
        if (!content) return null;
        
        // Match @AI-pv, @AI-pl, @All, and any member names from ALL available members
        const names = allMentions.map(m => m.name).filter(n => n);
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))\\b`, 'g');
        
        const parts = content.split(pattern);
        
        return parts.map((part, index) => {
            if (part === '@AI-pv') {
                return (
                    <span 
                        key={index} 
                        className={`font-semibold px-1.5 py-0.5 rounded mx-0.5 text-xs inline-block shadow-sm ${isMe ? 'bg-orange-400 text-orange-950' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}
                    >
                        {part}
                    </span>
                );
            }
            if (part === '@AI-pl') {
                return (
                    <span 
                        key={index} 
                        className={`font-semibold px-1.5 py-0.5 rounded mx-0.5 text-xs inline-block shadow-sm ${isMe ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
                    >
                        {part}
                    </span>
                );
            }
            if (part === '@All' || (part.startsWith('@') && names.includes(part.substring(1)))) {
                return (
                    <span 
                        key={index} 
                        className={`font-semibold px-1.5 py-0.5 rounded mx-0.5 text-xs inline-block shadow-sm ${isMe ? 'bg-white/20 text-white border border-white/30' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}
                    >
                        {part}
                    </span>
                );
            }
            
            if (isAi) {
                // Parse basic markdown **bold**
                const mdParts = part.split(/(\*\*.*?\*\*)/g);
                return (
                    <span key={index}>
                        {mdParts.map((md, i) => {
                            if (md.startsWith('**') && md.endsWith('**') && md.length >= 4) {
                                return <strong key={i} className="font-bold text-slate-900">{md.slice(2, -2)}</strong>;
                            }
                            return <span key={i}>{md}</span>;
                        })}
                    </span>
                );
            }
            
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0 border-r border-slate-200 relative">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between z-10">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500">
                            {group.type === 'EXECUTIVE' ? 'Ban giám đốc' : 'Nội bộ phòng ban'}
                        </p>
                        <span className="text-slate-300">•</span>
                        <button 
                            onClick={handleShowMembers}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium transition-colors"
                        >
                            <Users size={12} /> {group.memberCount || 0} thành viên
                        </button>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 relative">
                {unreadTargetId && (
                    <div className="sticky top-2 z-20 flex justify-center w-full pointer-events-none mb-4">
                        <button 
                            onClick={scrollToUnread}
                            className="pointer-events-auto px-4 py-2 bg-blue-100/90 backdrop-blur text-blue-700 hover:bg-blue-200 rounded-full shadow-md border border-blue-200 text-sm font-semibold flex items-center gap-2 transition-colors animate-bounce"
                        >
                            <ArrowDown size={16} /> Xem tin nhắn chưa đọc
                        </button>
                    </div>
                )}
                {loading ? (
                    <div className="text-center text-slate-500 my-4">Đang tải tin nhắn...</div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderId === user.userId;
                        return (
                            <div key={idx} id={`message-${msg.id}`} className={`flex flex-col group w-full ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`text-xs text-slate-500 mb-1 flex items-center gap-1 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {isMe ? 'Bạn' : (
                                        <span className="font-medium text-slate-700">
                                            {msg.senderName} 
                                            {msg.senderRole && <span className="font-normal text-slate-500"> ({msg.senderRole})</span>}
                                        </span>
                                    )}
                                    <span className="text-slate-400 font-light mx-1">{formatTime(msg.createdAt)}</span>
                                </div>
                                <div className={`flex items-center gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {isMe && !msg.isRecalled && !msg.isAi && (
                                        <div className="relative recall-menu-container opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button 
                                                onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)} 
                                                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenuId === msg.id && (
                                                <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                                                    <button onClick={() => handleRecall(msg.id, 'EVERYONE')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                                        <Trash2 size={16} /> Thu hồi với mọi người
                                                    </button>
                                                    <button onClick={() => handleRecall(msg.id, 'SENDER')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                                                        <EyeOff size={16} /> Thu hồi ở phía bạn
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {msg.isRecalled ? (
                                        <div className={`whitespace-nowrap px-4 py-2 shadow-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 italic text-sm ${isMe ? 'rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl' : 'rounded-tr-2xl rounded-tl-sm rounded-br-2xl rounded-bl-2xl'}`}>
                                            Tin nhắn đã bị thu hồi
                                        </div>
                                    ) : (
                                        <div className={`max-w-[75%] p-3 shadow-sm overflow-hidden break-words ${msg.isAi ? 'bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm' : isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white border border-slate-200 rounded-2xl rounded-tl-sm'}`}>
                                            {msg.isAi && (
                                                <div className="flex items-center gap-1 mb-1 text-indigo-600 text-xs font-bold">
                                                    <Bot size={14} /> AI Assistant
                                                    {msg.privateUserId === user.userId && (
                                                        <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-medium text-[10px] uppercase">
                                                            Riêng tư
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className={`whitespace-pre-wrap break-words leading-relaxed ${msg.isAi ? 'text-slate-700' : isMe ? 'text-blue-50' : 'text-slate-700'}`}>
                                                {renderMessageContent(msg.content, isMe && !msg.isAi, msg.isAi)}
                                            </div>
                                        </div>
                                    )}
                                    {!isMe && !msg.isRecalled && !msg.isAi && (
                                        <div className="relative">
                                            {/* For others' messages, no recall option based on user request */}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-200 z-10 relative">
                {showAiOptions && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full mb-2 left-4 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 min-w-[300px] max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 sticky top-0 z-10">
                            Đề xuất gắn thẻ
                        </div>
                        {filteredMentions.map((mention, idx) => (
                            <button 
                                key={mention.id}
                                    type="button"
                                    onClick={() => insertMention(mention)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`w-full text-left px-4 py-2 border-b border-slate-50 transition-colors flex flex-col gap-0.5 ${selectedIndex === idx ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        {mention.isAi ? (
                                            <Bot size={16} className={mention.id === 'ai-pv' ? 'text-orange-600' : 'text-emerald-600'} />
                                        ) : mention.id === 'all' ? (
                                            <Users size={16} className="text-blue-600" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                                                {mention.name.charAt(0)}
                                            </div>
                                        )}
                                        <span className={`font-medium ${mention.isAi ? (mention.id === 'ai-pv' ? 'text-orange-600' : 'text-emerald-600') : 'text-slate-800'}`} style={{ WebkitFontSmoothing: 'antialiased' }}>
                                            @{mention.name}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500 ml-7">
                                        {mention.isAi || mention.id === 'all' ? mention.label : `${mention.name} - ${mention.role}`}
                                    </span>
                                </button>
                            ))}
                    </div>
                )}
                
                <form onSubmit={handleSendMessage} className="flex gap-2 relative pr-16">
                    <div className="relative flex-1 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all flex items-center overflow-hidden">
                        {/* Highlight layer */}
                        <div 
                            ref={highlightRef}
                            className="absolute inset-0 px-4 py-3 text-sm text-slate-800 whitespace-pre overflow-hidden pointer-events-none"
                            style={{ fontFamily: 'inherit' }}
                            aria-hidden="true"
                        >
                            {renderHighlightedInput(inputValue)}
                        </div>
                        {/* Input layer */}
                        <input
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onScroll={handleInputScroll}
                            placeholder="Nhập tin nhắn... (Gõ @ để gọi AI)"
                            className={`w-full px-4 py-3 bg-transparent outline-none border-none text-sm relative z-10 ${inputValue ? 'text-transparent' : 'text-slate-800 placeholder:text-slate-400'}`}
                            style={{ caretColor: '#1e293b' }}
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm shrink-0"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>

            {/* Members Modal */}
            {showMembers && (
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-full">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-blue-600" />
                                Thành viên nhóm
                            </h3>
                            <button 
                                onClick={() => setShowMembers(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                            {loadingMembers ? (
                                <div className="text-center text-slate-500 my-8 text-sm">Đang tải danh sách...</div>
                            ) : (
                                <div className="space-y-1">
                                    {members.map((member) => (
                                        <div key={member.userId} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 border border-indigo-200">
                                                {member.avatarUrl ? (
                                                    <img src={member.avatarUrl} alt={member.hoTen} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    member.hoTen.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{member.hoTen}</p>
                                                <p className="text-xs text-slate-500 truncate">{member.role}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
