import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface ProfilePageProps {
  user: User;
  onProfileUpdate: (user: User) => void;
  socket: any;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onProfileUpdate, socket }) => {
  const [uniqueName, setUniqueName] = useState(user.uniqueName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!socket) return;
    
    const handleSuccess = (updatedUser: User) => {
        onProfileUpdate(updatedUser);
        setSuccess('Profile updated successfully!');
        setError('');
        setTimeout(() => setSuccess(''), 3000);
    }

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
        setSuccess('');
    }

    socket.on('profile-update-success', handleSuccess);
    socket.on('profile-update-error', handleError);

    return () => {
        socket.off('profile-update-success', handleSuccess);
        socket.off('profile-update-error', handleError);
    }

  }, [socket, onProfileUpdate]);

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
    setSuccess('');
    socket.emit('update-profile', { email: user.email, uniqueName, bio });
  };

  const isChanged = uniqueName !== (user.uniqueName || '') || bio !== (user.bio || '');

  return (
    <div className="h-full flex items-center justify-center bg-gray-800 rounded-lg p-4 md:p-6 animate-fade-in">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-xl">
        {!user.uniqueName && (
            <div className="mb-6 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-center">
                <h2 className="font-bold text-lg text-white">Welcome to CS Prep!</h2>
                <p className="text-blue-200 text-sm mt-1">Please set your unique username and bio to continue.</p>
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
          </div>
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-300">
                Bio / Description
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 block w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Tech enthusiast, focusing on system design."
              rows={3}
              maxLength={100}
            />
          </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {success && <p className="mt-2 text-sm text-green-400">{success}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            disabled={!isChanged || uniqueName.length < 3}
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;