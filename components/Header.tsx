import React from 'react';
import { UserButton } from "@clerk/react";
import { Sun, Moon, Settings, UserCog, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  currentUser: UserProfile;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onShowSettings: () => void;
  onShowProfile: () => void;
  onSwitchUser: () => void;
}

const Header: React.FC<HeaderProps> = ({
  currentUser,
  isDarkMode,
  onToggleTheme,
  onShowSettings,
  onShowProfile,
  onSwitchUser
}) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-slate-900/80 border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400 font-bold">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <span className="font-semibold text-slate-100 hidden sm:inline-block">
          {currentUser.name}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="mr-2">
          <UserButton />
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-full text-amber-500 hover:bg-white/10 transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button 
          onClick={onShowSettings}
          className="p-2 rounded-full text-slate-300 hover:bg-white/10 transition-colors"
          title="System Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button 
          onClick={onShowProfile}
          className="p-2 rounded-full text-indigo-400 hover:bg-white/10 transition-colors"
          title="Edit Profile"
        >
          <UserCog className="w-5 h-5" />
        </button>
        <button 
          onClick={onSwitchUser}
          className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
          title="Switch User"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;
