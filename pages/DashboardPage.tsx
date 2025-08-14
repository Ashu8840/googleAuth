import React from 'react';
import { User } from '../types';
import Sidebar from '../components/Sidebar';
import CoreSubjectsPage from './CoreSubjectsPage';

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-100">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="flex-grow p-4">
        <CoreSubjectsPage />
      </div>
    </div>
  );
};

export default DashboardPage;
