import React, { useState, useEffect } from 'react';
import { ActivityLog, UserProfile, TabView } from '../types';
import * as api from '../services/api';
import { Loader2, Plus, Edit2, Trash2, Bell, Download, Clock, RotateCcw, ExternalLink } from 'lucide-react';

interface ActivityFeedProps {
  user: UserProfile;
  onNavigate: (tab: TabView) => void;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ user, onNavigate }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [user.id]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchActivityLogs(user.id);
      setLogs(data);
    } catch (e) {
      console.error("Failed to load activity logs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const csvContent = [
      ['Date', 'Time', 'Action', 'Profile', 'Performed By', 'Description', 'Reference ID'].join(','),
      ...logs.map(log => {
        const d = new Date(log.timestamp);
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          log.action_type,
          `"${log.subject_profile}"`,
          `"${log.performed_by}"`,
          `"${log.description}"`,
          log.reference_id || ''
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_trail_${user.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleRestore = async (log: ActivityLog) => {
    if (!log.reference_id) return;
    
    setIsRestoring(log.id);
    try {
      const res = await api.restoreItem(log.id);
      alert(res.message);
      await loadLogs();
    } catch (error) {
      console.error("Failed to restore item:", error);
      alert("Failed to restore item.");
    } finally {
      setIsRestoring(null);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'ADD': return <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'EDIT': return <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'DELETE': return <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'NOTIFY': return <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default: return <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'ADD': return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200';
      case 'EDIT': return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200';
      case 'DELETE': return 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200';
      case 'NOTIFY': return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      default: return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    }
  };

  const filteredLogs = filterType === 'ALL' ? logs : logs.filter(l => l.action_type === filterType);

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey = date.toLocaleDateString();
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    }

    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(log);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  // Sort groups (Today, Yesterday, then by date descending)
  const sortedGroupKeys = Object.keys(groupedLogs).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 pb-24">
      <div className="glass-panel p-6 rounded-3xl shadow-lg border border-white/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Activity Audit Trail
          </h2>
          <p className="text-slate-700 dark:text-slate-200 font-medium mt-1">
            A secure timeline of all actions and changes.
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export for GP
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['ALL', 'ADD', 'EDIT', 'DELETE', 'NOTIFY'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${
              filterType === type 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'glass-panel text-slate-700 dark:text-slate-300 border-white/20 hover:bg-white/20'
            }`}
          >
            {type === 'ALL' ? 'All Activity' : type}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {sortedGroupKeys.map((dateLabel) => {
          const dayLogs = groupedLogs[dateLabel];
          // Sort logs within the day by timestamp descending
          const sortedDayLogs = [...dayLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return (
          <div key={dateLabel} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-16 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2 z-10">
              {dateLabel}
            </h3>
            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6">
              {sortedDayLogs.map((log) => (
                <div key={log.id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${getActionColor(log.action_type).split(' ')[0]}`} />
                  
                  <div className="glass-panel p-4 rounded-2xl border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 border ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                          {log.action_type}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                        By: {log.performed_by}
                      </div>
                    </div>
                    
                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      {log.description}
                    </p>
                    
                    {log.subject_profile && (
                      <div className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        Profile: {log.subject_profile}
                      </div>
                    )}
                    
                    {log.action_type === 'DELETE' && log.reference_id && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleRestore(log)}
                          disabled={isRestoring === log.id}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                        >
                          {isRestoring === log.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Undo Delete
                        </button>
                      </div>
                    )}
                    
                    {(log.action_type === 'ADD' || log.action_type === 'EDIT') && log.reference_id && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            if (log.description.toLowerCase().includes('document')) {
                              onNavigate(TabView.DOCUMENTS);
                            } else if (log.description.toLowerCase().includes('medicine')) {
                              onNavigate(TabView.HEALTHCARE);
                            } else if (log.description.toLowerCase().includes('reminder')) {
                              onNavigate(TabView.REMINDERS);
                            }
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
        
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 glass-panel rounded-3xl border border-white/20">
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No activity found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
