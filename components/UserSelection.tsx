
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { User, Plus, ChevronRight, Loader2, Settings, Sun, Moon } from 'lucide-react';
import * as api from '../services/api';
import SettingsModal from './SettingsModal';
import { generateId } from '../utils/helpers';

interface UserSelectionProps {
  onSelect: (user: UserProfile) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

const UserSelection: React.FC<UserSelectionProps> = ({ onSelect, isDarkMode = false, onToggleTheme }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.fetchUsers();
      // Sort users alphabetically by name
      const sortedUsers = data.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(sortedUsers);
    } catch (error) {
      console.error("Failed to load users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const colors = ['bg-red-200', 'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 'bg-purple-200', 'bg-pink-200'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: UserProfile = {
      id: generateId(),
      name: newName.trim(),
      avatarColor: randomColor,
      createdAt: new Date().toISOString()
    };

    try {
      await api.createUser(newUser);
      await loadUsers();
      setNewName('');
      setIsCreating(false);
      onSelect(newUser);
    } catch (error) {
      console.error("Failed to create user", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-200">
      
      {/* Top Right Controls */}
      <div className="fixed top-0 right-0 p-4 z-50 flex gap-2">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="glass-panel p-2 rounded-full shadow-sm text-amber-500 border border-white/20 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-6 h-6 drop-shadow-sm" /> : <Moon className="w-6 h-6 drop-shadow-sm" />}
          </button>
        )}
        <button 
          onClick={() => setShowSettings(true)}
          className="glass-panel p-2 rounded-full shadow-sm text-slate-700 dark:text-slate-300 border border-white/20 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors"
          title="System Settings"
        >
          <Settings className="w-6 h-6 drop-shadow-sm" />
        </button>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <div className="bg-indigo-600/90 backdrop-blur-md border border-indigo-400/30 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg transform -rotate-6">
            <User className="w-10 h-10 text-white drop-shadow-sm" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 drop-shadow-sm">Welcome</h1>
          <p className="text-xl text-slate-700 dark:text-slate-300 font-medium drop-shadow-sm">Who is using MemoryMate today?</p>
        </div>

        <div className="glass-panel rounded-3xl shadow-xl overflow-hidden border border-white/20">
          <div className="divide-y divide-white/10 dark:divide-slate-700/50">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelect(user)}
                  className="w-full p-6 flex items-center gap-4 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors text-left group"
                >
                  <div className={`w-14 h-14 ${user.avatarColor} rounded-full flex items-center justify-center text-xl font-bold text-slate-700 shadow-sm border border-white/50 group-hover:scale-105 transition-transform`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white drop-shadow-sm">{user.name}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Tap to sign in</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:translate-x-1 transition-transform" />
                </button>
              ))
            )}
            
            {!loading && users.length === 0 && !isCreating && (
              <div className="p-8 text-center text-slate-600 dark:text-slate-400 font-medium">
                No users found. Please create one.
              </div>
            )}
          </div>

          {isCreating ? (
            <div className="p-6 bg-indigo-50/50 dark:bg-slate-800/50 backdrop-blur-md border-t border-white/20">
              <form onSubmit={handleCreate}>
                <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-2 drop-shadow-sm">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full p-4 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none mb-4 text-lg shadow-inner placeholder-slate-500/70"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 p-3 rounded-xl glass-panel border border-white/20 font-bold text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-3 rounded-xl bg-indigo-600/90 backdrop-blur-md dark:bg-indigo-500/90 text-white font-bold shadow-md hover:bg-indigo-700 dark:hover:bg-indigo-400 border border-indigo-400/30 transition-colors active:scale-[0.98]"
                  >
                    Save User
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full p-6 glass-panel border-t border-white/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center gap-2 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Plus className="w-6 h-6 drop-shadow-sm" /> <span className="drop-shadow-sm">Create New Profile</span>
            </button>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default UserSelection;
