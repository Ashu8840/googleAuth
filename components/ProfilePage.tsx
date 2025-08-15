import React, { useState } from 'react';
import { User } from '../types';

interface ProfilePageProps {
  user: User;
  onProfileUpdate: (user: User) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onProfileUpdate }) => {
  const [uniqueName, setUniqueName] = useState(user.uniqueName || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uniqueName.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(uniqueName)) {
        setError('Username can only contain letters, numbers, and underscores.');
        return;
    }
    setError('');
    onProfileUpdate({ ...user, uniqueName });
  };

  return (
    <div className="h-full flex items-center justify-center bg-gray-800 rounded-lg p-4 md:p-6 animate-fade-in">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-xl">
        {!user.uniqueName && (
            <div className="mb-6 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-center">
                <h2 className="font-bold text-lg text-white">Welcome to CS Prep!</h2>
                <p className="text-blue-200 text-sm mt-1">Please set your unique username to continue.</p>
            </div>
        )}
        <div className="flex flex-col items-center">
          <img src={user.picture} alt="Profile" className="w-24 h-24 rounded-full border-4 border-gray-700" />
          <h2 className="mt-4 text-2xl font-bold text-white">{user.name}</h2>
          <p className="text-gray-400">{user.email}</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="uniqueName" className="block text-sm font-medium text-gray-300">
              Unique Username
            </label>
            <input
              id="uniqueName"
              type="text"
              value={uniqueName}
              onChange={(e) => setUniqueName(e.target.value)}
              className="mt-1 block w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., code_master"
            />
             {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-500"
            disabled={uniqueName === user.uniqueName || uniqueName.length < 3}
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
