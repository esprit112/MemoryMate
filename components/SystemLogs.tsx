import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, X, Terminal, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import * as api from '../services/api';

interface SystemLog {
  id: string;
  profileId: string;
  eventType: string;
  message: string;
  status: string;
  technicalDetails: string;
  timestamp: string;
}

interface SystemLogsProps {
  profileId: string;
  onClose: () => void;
}

const SystemLogs: React.FC<SystemLogsProps> = ({ profileId, onClose }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(`${api.getApiBase()}/logs/${profileId}`, {
          headers: await api.getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error("Failed to fetch logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [profileId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'ERROR': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'PENDING': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'ERROR': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm pt-20">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0D1117] border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#161B22]">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-5 h-5" />
            <h2 className="text-sm font-semibold tracking-wider uppercase">System Event Logs</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <span className="animate-pulse">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No system events recorded yet.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-[#161B22] border border-slate-800 rounded-lg p-3 text-sm">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="text-slate-400 text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${getStatusColor(log.status)}`}>
                      {log.eventType}
                    </span>
                  </div>
                </div>
                
                <div className="text-slate-300 mb-2 pl-6">
                  {log.message}
                </div>
                
                {log.technicalDetails && (
                  <div className="ml-6 mt-2 p-2 bg-[#0D1117] rounded border border-slate-800 text-xs text-slate-500 overflow-x-auto whitespace-pre-wrap">
                    {log.technicalDetails}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SystemLogs;
