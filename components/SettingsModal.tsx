import React, { useState, useEffect } from 'react';
import { X, Server, Check, AlertTriangle, Download, Upload, CloudCog, Loader2, Database } from 'lucide-react';
import * as api from '../services/api';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  
  // Backup/Restore State
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('MEMORYMATE_API_URL');
    // Default to relative /api on the current origin if not set
    setApiUrl(stored || `${window.location.origin}/api`);
  }, []);

  const handleTestConnection = async () => {
    setStatus('checking');
    const success = await api.pingServer(apiUrl);
    setStatus(success ? 'connected' : 'error');
  };

  const handleSaveUrl = () => {
    localStorage.setItem('MEMORYMATE_API_URL', apiUrl);
    // Reload to apply changes immediately across the app
    window.location.reload();
  };

  const handleDownloadBackup = () => {
    api.downloadBackup();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("WARNING: Restoring a database will completely OVERWRITE all current data. This cannot be undone. Are you sure?")) {
      return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        await api.restoreBackup(base64Data);
        alert("Database restored successfully! The application will now reload.");
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert("Failed to restore database. Please check the file and try again.");
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
        
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 border-b border-white/20 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 drop-shadow-sm">
            <CloudCog className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            System Settings
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/30 dark:hover:bg-slate-700/50 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Server Connection Section */}
          <div className="glass-panel p-5 rounded-2xl border border-white/20 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 pointer-events-none" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2 relative z-10 drop-shadow-sm">
              <Server className="w-4 h-4" /> Backend Server
            </h3>
            <div className="space-y-3 relative z-10">
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 drop-shadow-sm">API URL</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={(e) => { setApiUrl(e.target.value); setStatus('idle'); }}
                  className="flex-1 p-3 border border-white/20 rounded-xl glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none font-mono text-sm shadow-inner"
                />
                <button 
                  onClick={handleTestConnection}
                  className="px-4 py-2 glass-panel text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-sm hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors border border-indigo-200/30 dark:border-indigo-700/30 shadow-sm"
                >
                  {status === 'checking' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ping'}
                </button>
              </div>

              {status === 'connected' && (
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-bold p-3 glass-panel border border-emerald-300/50 dark:border-emerald-700/50 rounded-xl shadow-sm">
                  <Check className="w-4 h-4" /> Connection Successful
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-bold p-3 glass-panel border border-red-300/50 dark:border-red-700/50 rounded-xl shadow-sm">
                  <AlertTriangle className="w-4 h-4" /> Connection Failed
                </div>
              )}

              <button 
                onClick={handleSaveUrl}
                disabled={status !== 'connected' && status !== 'idle'} 
                className="w-full py-3 bg-indigo-600/90 backdrop-blur-md text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 border border-indigo-400/30 active:scale-[0.98]"
              >
                Save & Reload
              </button>
            </div>
          </div>

          <div className="h-px bg-white/20 dark:bg-slate-700/50" />

          {/* Database Management Section */}
          <div className="glass-panel p-5 rounded-2xl border border-white/20 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-500/5 dark:bg-slate-500/10 pointer-events-none" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2 relative z-10 drop-shadow-sm">
              <Database className="w-4 h-4" /> Database Management
            </h3>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <button 
                onClick={handleDownloadBackup}
                className="flex flex-col items-center justify-center p-4 border border-white/20 glass-panel rounded-2xl hover:border-indigo-400/50 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-all group shadow-sm"
              >
                <Download className="w-8 h-8 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2 drop-shadow-sm" />
                <span className="font-bold text-slate-800 dark:text-slate-200 drop-shadow-sm">Backup</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Download .db file</span>
              </button>

              <label className={`flex flex-col items-center justify-center p-4 border border-white/20 glass-panel rounded-2xl hover:border-red-400/50 hover:bg-white/30 dark:hover:bg-slate-700/50 transition-all cursor-pointer group shadow-sm ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}>
                {isRestoring ? (
                   <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
                ) : (
                   <Upload className="w-8 h-8 text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 mb-2 drop-shadow-sm" />
                )}
                <span className="font-bold text-slate-800 dark:text-slate-200 drop-shadow-sm">Restore</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Overwrite DB</span>
                <input type="file" className="hidden" accept=".db,.sqlite" onChange={handleRestoreFile} disabled={isRestoring} />
              </label>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 text-center font-medium relative z-10">
              Restoring a database will overwrite all current users, reminders, and data.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;