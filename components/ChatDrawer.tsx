import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';

interface ChatDrawerProps {
  targetUser: User | null;
  currentUser: User;
  socket: any;
  messages: ChatMessage[];
  onClose: () => void;
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ targetUser, currentUser, socket, messages, onClose }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && targetUser) {
      const message: ChatMessage = {
          from: currentUser.email,
          to: targetUser.email,
          message: input,
          timestamp: Date.now(),
          fromUniqueName: currentUser.uniqueName
      };
      socket.emit('private-message', message);
      // The message will be added to state via the socket echo
      setInput('');
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-gray-800 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col z-50
        ${targetUser ? 'translate-x-0' : 'translate-x-full'}
        w-full sm:w-96 border-l-2 border-gray-700`}
    >
      {targetUser && (
        <>
          <div className="p-4 bg-gray-900 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <img src={targetUser.picture} alt={targetUser.name} className="w-10 h-10 rounded-full" />
              <div className="ml-3">
                <h3 className="font-bold text-white">{targetUser.uniqueName}</h3>
                <p className="text-xs text-green-400">Online</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
          </div>

          <div className="flex-grow p-4 overflow-y-auto bg-gray-800">
            {messages.map((msg, index) => (
              <div key={index} className={`flex mb-3 ${msg.from === currentUser.email ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 max-w-xs lg:max-w-sm ${msg.from === currentUser.email ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                  {msg.from !== currentUser.email && <p className="text-xs font-bold text-blue-300">{msg.fromUniqueName}</p>}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs text-right opacity-70 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-4 bg-gray-900 flex-shrink-0">
            <div className="flex items-center bg-gray-700 rounded-full px-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-transparent p-3 text-white focus:outline-none"
              />
              <button type="submit" className="text-blue-400 hover:text-blue-300 p-2 disabled:text-gray-600" disabled={!input.trim()}>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="http://www.w3.org/2000/svg" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatDrawer;