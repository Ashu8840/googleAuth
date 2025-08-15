import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import Sidebar from '../components/Sidebar';
import CoreSubjectsPage from './CoreSubjectsPage';
import MockTestsPage from './MockTestsPage';
import GroupDiscussionPage from './GroupDiscussionPage';
import SchedulerPage from './SchedulerPage';
import InterviewRoomPage from './InterviewRoomPage';
import ProfilePage from '../components/ProfilePage';
import CommunityPage from './CommunityPage';
import CallModal from '../components/CallModal';

declare const io: any;

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onProfileUpdate: (user: User) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout, onProfileUpdate }) => {
  const [activePage, setActivePage] = useState('Core Subjects');
  const socketRef = useRef<any>(null);
  
  const [callState, setCallState] = useState<{ status: 'idle' | 'outgoing' | 'incoming' | 'active', peerEmail?: string, peerInfo?: any }>({ status: 'idle' });

  useEffect(() => {
    if (user && !user.uniqueName) {
      setActivePage('Profile');
    }
  }, [user]);

  useEffect(() => {
    if (!user.uniqueName) return;

    const socket = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', user);
    });
    
    socket.on('incoming-call', ({ from, fromInfo }: { from: string, fromInfo: any }) => {
        setCallState({ status: 'incoming', peerEmail: from, peerInfo: fromInfo });
    });

    socket.on('call-accepted', ({ by }: { by: string }) => {
        if (callState.status === 'outgoing' && callState.peerEmail === by) {
            setCallState(prev => ({ ...prev, status: 'active' }));
        }
    });

    socket.on('call-declined', () => {
        setCallState({ status: 'idle' });
    });

    socket.on('call-ended', () => {
        setCallState({ status: 'idle' });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, callState.status]);

  const renderActivePage = () => {
    if (user && !user.uniqueName) {
      return <ProfilePage user={user} onProfileUpdate={onProfileUpdate} />;
    }
    
    const socket = socketRef.current;

    switch (activePage) {
      case 'Core Subjects':
        return <CoreSubjectsPage />;
      case 'Mock Tests':
        return <MockTestsPage />;
      case 'Group Discussion':
        return <GroupDiscussionPage user={user} socket={socket} />;
      case '1-on-1 Interview':
        return <InterviewRoomPage user={user} socket={socket} />;
      case 'Community':
        return <CommunityPage currentUser={user} socket={socket} setCallState={setCallState} />;
      case 'Scheduler':
        return <SchedulerPage />;
      case 'Profile':
        return <ProfilePage user={user} onProfileUpdate={onProfileUpdate} />;
      default:
        return <CoreSubjectsPage />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-900 text-gray-100">
      <Sidebar user={user} onLogout={onLogout} activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-grow p-2 md:p-4 lg:p-6 overflow-auto">
        {renderActivePage()}
      </main>
      {callState.status !== 'idle' && user.uniqueName && socketRef.current && (
          <CallModal 
            socket={socketRef.current}
            callState={callState}
            setCallState={setCallState}
            currentUser={user}
          />
      )}
    </div>
  );
};

export default DashboardPage;