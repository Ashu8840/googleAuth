
import React from 'react';
import { User } from '../types';

interface ProfilePageProps {
  user: User;
  onLogout: () => void;
}

const ProfileDetail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-gray-400">{label}</dt>
    <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 break-words">{value}</dd>
  </div>
);


const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout }) => {
  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl animate-fade-in-up">
      <div className="flex flex-col items-center space-y-4">
        <img
          className="w-24 h-24 rounded-full ring-4 ring-gray-600 object-cover"
          src={user.picture}
          alt="User profile"
        />
        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
      </div>

      <div className="border-t border-gray-700">
        <dl className="divide-y divide-gray-700">
          <ProfileDetail label="Full Name" value={user.name} />
          <ProfileDetail label="Email address" value={user.email} />
          <ProfileDetail label="User ID" value={`user_${user.email.split('@')[0]}`} />
           <ProfileDetail label="Account Status" value="Verified" />
        </dl>
      </div>

      <button
        onClick={onLogout}
        className="w-full px-4 py-3 text-sm font-medium text-white transition-colors duration-300 transform bg-red-600 rounded-md hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
      >
        Logout
      </button>
    </div>
  );
};

export default ProfilePage;
