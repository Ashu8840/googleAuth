import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface LoginPageProps {
  onLoginSuccess: (credentialResponse: CredentialResponse) => void;
  onLoginError: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onLoginError }) => {
  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden bg-gray-800 rounded-lg shadow-xl animate-fade-in-down">
      <div className="p-8">
        <h2 className="text-3xl font-bold text-center text-white">Welcome Back</h2>
        <p className="mt-2 text-center text-gray-400">
          Your all-in-one CS interview prep platform.
          <br />
          Core concepts, mock tests, GD practice & more.
        </p>
        
        <div className="mt-8 flex justify-center">
          <GoogleLogin
            onSuccess={onLoginSuccess}
            onError={onLoginError}
            theme="filled_black"
            text="signin_with"
            shape="rectangular"
            logo_alignment="left"
          />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;