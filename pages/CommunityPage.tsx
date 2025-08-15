import React, { useState, useEffect } from 'react';
import { User, MockUser, ChatMessage } from '../types';
import ChatDrawer from '../components/ChatDrawer';

// Mock user data since we don't have a user database
const mockUsers: MockUser[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com', picture: `https://api.dicebear.com/8.x/adventurer/svg?seed=alice`, uniqueName: 'algo_queen', bio: 'Data Structures & Algorithms enthusiast.' },
    { id: 2, name: 'Bob', email: 'bob@example.com', picture: `https://api.dicebear.com/8.x/adventurer/svg?seed=bob`, uniqueName: 'binary_bob', bio: 'System design and scalability expert.' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', picture: `https://api.dicebear.com/8.x/adventurer/svg?seed=charlie`, uniqueName: 'crypto_charlie', bio: 'Loves networking and security.' },
    { id: 4, name: 'Diana', email: 'diana@example.com', picture: `https://api.dicebear.com/8.x/adventurer/svg?seed=diana`, uniqueName: 'db_diva', bio: 'SQL and NoSQL are my jam.' },
    { id: 5, name: 'Eve', email: 'eve@example.com', picture: `https://api.dicebear.com/8.x/adventurer/svg?seed=eve`, uniqueName: 'error_eve', bio: 'Master of debugging and OS concepts.' },
];

interface CommunityPageProps {
  currentUser: User;
  socket: any;
  setCallState: React.Dispatch<React.SetStateAction<any>>;
}

const CommunityPage: React.FC<CommunityPageProps> = ({ currentUser, socket, setCallState }) => {
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [following, setFollowing] = useState<string[]>(() => JSON.parse(localStorage.getItem('following') || '[]'));
    
    const [chatTarget, setChatTarget] = useState<MockUser | null>(null);
    const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});

    useEffect(() => {
        if (!socket) return;
        
        const handleOnlineUsers = (users: string[]) => setOnlineUsers(users);
        const handlePrivateMessage = (message: ChatMessage) => {
            const chatPartner = message.from === currentUser.email ? message.to : message.from;
            setMessages(prev => ({
                ...prev,
                [chatPartner]: [...(prev[chatPartner] || []), message]
            }));
            // If not already chatting with this user, open the chat
            if (!chatTarget || chatTarget.email !== message.from) {
                const sender = mockUsers.find(u => u.email === message.from);
                if (sender) setChatTarget(sender);
            }
        };

        socket.on('online-users', handleOnlineUsers);
        socket.on('private-message', handlePrivateMessage);
        socket.emit('register', currentUser); // Re-register on page view if needed

        return () => {
            socket.off('online-users', handleOnlineUsers);
            socket.off('private-message', handlePrivateMessage);
        };
    }, [socket, currentUser, chatTarget]);

    const toggleFollow = (email: string) => {
        const newFollowing = following.includes(email)
            ? following.filter(e => e !== email)
            : [...following, email];
        setFollowing(newFollowing);
        localStorage.setItem('following', JSON.stringify(newFollowing));
    };
    
    const handleInitiateCall = (targetUser: MockUser) => {
        setCallState({
            status: 'outgoing',
            peerEmail: targetUser.email,
            peerInfo: { name: targetUser.name, picture: targetUser.picture, uniqueName: targetUser.uniqueName }
        });
        socket.emit('initiate-call', { to: targetUser.email });
    };

    return (
        <div className="h-full bg-gray-800 rounded-lg p-6 animate-fade-in relative overflow-hidden">
            <h1 className="text-3xl font-bold text-white">Community</h1>
            <p className="mt-2 text-gray-400">Connect with other students preparing for interviews.</p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-[calc(100%-80px)] pb-4">
                {mockUsers.filter(u => u.email !== currentUser.email).map(user => {
                    const isOnline = onlineUsers.includes(user.email);
                    const isFollowing = following.includes(user.email);
                    return (
                        <div key={user.id} className="bg-gray-900 rounded-lg p-4 flex flex-col items-center text-center shadow-lg transition-transform hover:scale-105">
                            <div className="relative">
                                <img src={user.picture} alt={user.name} className="w-24 h-24 rounded-full border-4 border-gray-700" />
                                {isOnline && <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" title="Online"></div>}
                            </div>
                            <h3 className="mt-3 text-lg font-bold text-white">{user.uniqueName}</h3>
                            <p className="text-sm text-gray-400">{user.name}</p>
                            <p className="mt-2 text-xs text-gray-500 flex-grow">{user.bio}</p>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center w-full">
                                <button onClick={() => toggleFollow(user.email)} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${isFollowing ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                                <button onClick={() => setChatTarget(user)} disabled={!isOnline} className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                                    Message
                                </button>
                                <button onClick={() => handleInitiateCall(user)} disabled={!isOnline} className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                                    Call
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <ChatDrawer 
                targetUser={chatTarget} 
                currentUser={currentUser}
                socket={socket}
                messages={messages[chatTarget?.email || ''] || []}
                onClose={() => setChatTarget(null)} 
            />
        </div>
    );
};

export default CommunityPage;
