// components/AIChatbot.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, X, Send, Minimize2, Maximize2, Bot } from 'lucide-react';
import { getAIResponse } from '@/lib/chatbotResponses';

type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
};

// Quick questions untuk membantu user
const quickQuestions = [
  'Apa saja fiturnya?',
  'Cara pakai aplikasi?',
  'Bagaimana cara pinjam?',
  'Lupa password?',
  'Kode admin?',
];

export default function AIChatbot() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Halo ${userData?.nama || 'Bos'}! 👋\n\nSaya AI asisten GUJALA 23. Saya siap membantu Anda ${
        userData?.role === 'pengelola' 
          ? 'mengelola aplikasi ini. Saya bisa membantu tentang anggota, pinjaman, arisan, cash, laporan, dan fitur lainnya!' 
          : 'menjawab pertanyaan tentang simpanan, pinjaman, arisan, dan cara menggunakan aplikasi ini!'
      }\n\nAda yang bisa saya bantu?`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userRole = userData?.role || 'anggota';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulasi delay untuk efek mengetik
    setTimeout(() => {
      const response = getAIResponse(messageText, userRole as 'anggota' | 'pengelola');
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Tombol Chat - MODIFIKASI: posisi lebih aman di HP */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group active:scale-95"
        >
          <Bot size={20} className="sm:size-24 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full animate-pulse"></span>
        </button>
      )}

      {/* Panel Chat - MODIFIKASI: responsive width dan height untuk HP */}
      {isOpen && (
        <div
          className={`fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 ${
            isMinimized 
              ? 'w-[calc(100%-32px)] sm:w-80 h-14' 
              : 'w-[calc(100%-32px)] sm:w-[400px] h-[70vh] sm:h-[600px] max-h-[80vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={14} className="sm:size-16" />
              </div>
              <div>
                <h3 className="font-semibold text-xs sm:text-sm">AI Asisten GUJALA 23</h3>
                <p className="text-[10px] sm:text-xs opacity-75">
                  {userRole === 'pengelola' ? 'Mode Pengelola' : 'Mode Anggota'} • Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition"
              >
                {isMinimized ? <Maximize2 size={14} className="sm:size-16" /> : <Minimize2 size={14} className="sm:size-16" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition"
              >
                <X size={14} className="sm:size-16" />
              </button>
            </div>
          </div>

          {/* Body Chat - MODIFIKASI: tidak ada perubahan signifikan, scroll tetap berfungsi */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                        msg.isUser
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-bl-md shadow-sm border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          msg.isUser ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions - MODIFIKASI: lebih rapi di HP */}
              {messages.length <= 2 && (
                <div className="px-2 sm:px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 shrink-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-2">Pertanyaan cepat:</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {quickQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q)}
                        className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-gray-700 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600 transition active:bg-blue-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area - MODIFIKASI: padding lebih kecil di HP */}
              <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ketik pertanyaanmu..."
                    className="flex-1 px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-xs sm:text-sm"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="px-2.5 sm:px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition disabled:opacity-50 active:scale-95"
                  >
                    <Send size={16} className="sm:size-18" />
                  </button>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-2 text-center">
                  💡 Tips: Tanya tentang fitur, cara pakai, atau info lainnya
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}