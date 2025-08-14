import React, { useState } from 'react';
import { User } from '../types';
import Sidebar from '../components/Sidebar';
import CoreSubjectsPage from './CoreSubjectsPage';
import MockTestsPage from './MockTestsPage';
import GroupDiscussionPage from './GroupDiscussionPage';
import SchedulerPage from './SchedulerPage';
import InterviewRoomPage from './InterviewRoomPage';

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('Core Subjects');

  const renderActivePage = () => {
    switch (activePage) {
      case 'Core Subjects':
        return <CoreSubjectsPage />;
      case 'Mock Tests':
        return <MockTestsPage />;
      case 'Group Discussion':
        return <GroupDiscussionPage user={user} />;
      case '1-on-1 Interview':
        return <InterviewRoomPage user={user} />;
      case 'Scheduler':
        return <SchedulerPage />;
      default:
        return <CoreSubjectsPage />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-100">
      <Sidebar user={user} onLogout={onLogout} activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-grow p-4 lg:p-6 overflow-auto">
        {renderActivePage()}
      </main>
    </div>
  );
};

export default DashboardPage;