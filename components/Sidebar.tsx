import React from 'react';
import { User } from '../types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

const NavLink: React.FC<{
  icon: JSX.Element;
  label: string;
  active?: boolean;
  disabled?: boolean;
}> = ({ icon, label, active, disabled }) => (
  <li>
    <a
      href="#"
      className={`flex items-center p-2 text-base font-normal rounded-lg transition-all duration-200
        ${
          active
            ? 'bg-gray-700 text-white'
            : disabled
            ? 'text-gray-500 cursor-not-allowed'
            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }
      `}
      onClick={(e) => (disabled || (!active && label !== 'Core Subjects')) && e.preventDefault()}
      aria-disabled={disabled}
    >
      {icon}
      <span className="ml-3">{label}</span>
      {disabled && <span className="inline-flex items-center justify-center px-2 ml-auto text-xs font-medium text-gray-500 bg-gray-700 rounded-full">Soon</span>}
    </a>
  </li>
);

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  return (
    <aside className="w-64 flex-shrink-0" aria-label="Sidebar">
      <div className="flex flex-col h-full overflow-y-auto bg-gray-800 p-4">
        <div className="flex items-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 12l4.179 2.25M6.429 16.5L2.25 12l4.179-2.25m11.142 0l4.179 2.25-4.179 2.25m0 4.5l5.571-3-5.571-3.001" />
            </svg>
          <span className="self-center text-xl font-semibold whitespace-nowrap text-white">CS Prep</span>
        </div>
        <ul className="space-y-2 flex-grow">
          <NavLink
            label="Core Subjects"
            active
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            }
          />
          <NavLink
            label="Mock Tests"
            disabled
            icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            }
          />
          <NavLink
            label="Group Discussion"
            disabled
            icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            }
          />
           <NavLink
            label="Scheduler"
            disabled
            icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
          />
        </ul>
        <div className="mt-auto pt-4 border-t border-gray-700">
           <div className="flex items-center">
             <img className="h-10 w-10 rounded-full object-cover" src={user.picture} alt="User" />
             <div className="ml-3">
               <p className="text-sm font-semibold text-white">{user.name}</p>
               <p className="text-xs text-gray-400">{user.email}</p>
             </div>
             <button onClick={onLogout} title="Logout" className="ml-auto text-gray-400 hover:text-white transition-colors duration-200">
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
             </button>
           </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
