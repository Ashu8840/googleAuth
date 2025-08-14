import React, { useState, useCallback } from 'react';
import { User } from './types';
import LoginPage from './components/LoginPage';
import ProfilePage from './components/ProfilePage';
import { GoogleOAuthProvider, CredentialResponse, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// This is the Google Client ID for the application.
// IMPORTANT: In a production environment, it is strongly recommended to store this
// sensitive information in environment variables rather than hardcoding it directly
// in the source code. This is done here for simplicity of demonstration.
const GOOGLE_CLIENT_ID = '897315188971-3li7kqamqd7m8labetputc59pg56mm6s.apps.googleusercontent.com';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const handleLoginSuccess = useCallback((credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        const decoded: { name: string; email: string; picture: string; } = jwtDecode(credentialResponse.credential);
        setUser({
          name: decoded.name,
          email: decoded.email,
          picture: decoded.picture,
        });
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
  }, []);

  const handleLoginError = useCallback(() => {
    console.error('Login Failed');
    // Optionally, you can set an error state here to show a message to the user
  }, []);

  const handleLogout = useCallback(() => {
    googleLogout();
    setUser(null);
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-red-800 rounded-lg shadow-xl text-center">
          <h2 className="text-2xl font-bold">Configuration Error</h2>
          <p className="mt-4">
            The Google Client ID is missing. Please make sure the <code>GOOGLE_CLIENT_ID</code> environment variable is set.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        {user ? (
          <ProfilePage user={user} onLogout={handleLogout} />
        ) : (
          <LoginPage onLoginSuccess={handleLoginSuccess} onLoginError={handleLoginError} />
        )}
      </div>
    </GoogleOAuthProvider>
  );
};

export default App;