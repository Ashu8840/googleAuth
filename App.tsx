import React, { useState, useCallback, useEffect } from 'react';
import { User } from './types';
import LoginPage from './components/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { GoogleOAuthProvider, CredentialResponse, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const GOOGLE_CLIENT_ID = '897315188971-3li7kqamqd7m8labetputc59pg56mm6s.apps.googleusercontent.com';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const handleLogout = useCallback(() => {
    googleLogout();
    setUser(null);
    localStorage.removeItem('loginTimestamp');
  }, []);

  useEffect(() => {
    const loginTimestamp = localStorage.getItem('loginTimestamp');
    if (loginTimestamp) {
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (Date.now() - parseInt(loginTimestamp, 10) > twentyFourHours) {
            handleLogout();
        }
    }
  }, [handleLogout]);

  const handleLoginSuccess = useCallback((credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        const decoded: { name: string; email: string; picture: string; } = jwtDecode(credentialResponse.credential);
        const savedProfile = localStorage.getItem(`profile_${decoded.email}`);
        const { uniqueName, bio } = savedProfile ? JSON.parse(savedProfile) : { uniqueName: undefined, bio: undefined };
        
        setUser({
          name: decoded.name,
          email: decoded.email,
          picture: decoded.picture,
          uniqueName: uniqueName,
          bio: bio,
        });
        localStorage.setItem('loginTimestamp', Date.now().toString());
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
  }, []);

  const handleLoginError = useCallback(() => {
    console.error('Login Failed');
  }, []);

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(prevUser => ({...prevUser, ...updatedUser}));
    localStorage.setItem(`profile_${updatedUser.email}`, JSON.stringify({ uniqueName: updatedUser.uniqueName, bio: updatedUser.bio }));
  };


  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-red-800 rounded-lg shadow-xl text-center">
          <h2 className="text-2xl font-bold">Configuration Error</h2>
          <p className="mt-4">
            The Google Client ID is missing. Please make sure it's configured correctly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {user ? (
          <DashboardPage user={user} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
        ) : (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
             <LoginPage onLoginSuccess={handleLoginSuccess} onLoginError={handleLoginError} />
          </div>
        )}
    </GoogleOAuthProvider>
  );
};

export default App;