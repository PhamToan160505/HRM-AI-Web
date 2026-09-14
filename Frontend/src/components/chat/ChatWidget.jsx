import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { default as api, apiAi } from '../../services/api';

const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const SUGGESTIONS = [
    "Phòng tôi có bao nhiêu người?",
    "Báo cáo lương tháng này đã duyệt chưa?",
    "Chức năng chính của hệ thống là gì?",
    "Quy trình duyệt yêu cầu tuyển dụng?"
  ];

  // Lấy lịch sử chat khi mở widget
  useEffect(() => {
    if (isOpen && messages.length === 0 && user) {
      fetchHistory();
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/chat/history');
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi khi lấy lịch sử chat', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputValue,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await apiAi.post('/api/chat/ask', { message: userMessage.content });
      if (res.data.success) {
        const botMessage = {
          role: 'model',
          content: res.data.data,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (err) {
      const errorMessage = {
        role: 'model',
        content: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau!',
        createdAt: new Date().toISOString(),
        isError: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (text) => {
    setInputValue(text);
    // Tự động submit sau khi set state một chút để đảm bảo input nhận giá trị
    setTimeout(() => {
      const formEvent = new Event('submit', { cancelable: true, bubbles: true });
      document.getElementById('chat-form').dispatchEvent(formEvent);
    }, 50);
  };

  if (!user) return null; // Chỉ hiển thị khi đã đăng nhập

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Cửa sổ Chat */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mb-4 transition-all duration-300 ease-in-out h-[500px] max-h-[80vh]">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">HRM AI Assistant</h3>
                <p className="text-xs text-blue-100 opacity-90">Sẵn sàng hỗ trợ bạn</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-slate-400 text-sm mt-10">
                <Bot size={40} className="mx-auto mb-2 opacity-50" />
                <p>Xin chào {user.hoTen}!</p>
                <p>Tôi có thể giúp gì cho bạn hôm nay?</p>
              </div>
            )}
            
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-slate-200' : 'bg-blue-100 text-blue-600'}`}>
                      {isUser ? <User size={14} className="text-slate-500" /> : <Bot size={14} />}
                    </div>
                    <div 
                      className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                        isUser 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : msg.isError 
                            ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-sm'
                            : 'bg-white border border-slate-100 text-slate-700 rounded-bl-sm'
                      }`}
                    >
                      {isUser ? (
                        msg.content
                      ) : (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex flex-row items-end gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-slate-100 flex flex-col">
            {/* Suggestions */}
            {messages.length === 0 && !isLoading && (
              <div className="flex gap-2 overflow-x-auto p-2 scrollbar-hide border-b border-slate-50">
                {SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sug)}
                    className="whitespace-nowrap px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full text-xs transition-colors border border-blue-100"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
            
            <div className="p-3">
              <form id="chat-form" onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn..."
                  className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bong bóng nổi (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 group relative"
        >
          <MessageSquare size={26} className="group-hover:animate-pulse" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
      )}
    </div>
  );
};

export default ChatWidget;
