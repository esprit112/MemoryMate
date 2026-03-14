import React from 'react';
import { Reminder } from '../types';
import { Trash2, CheckCircle, Circle, Volume2, Pill, Calendar, Clock, Repeat, Loader2, Edit2 } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import { playAudio } from '../utils/audioUtils';

interface ReminderListProps {
  reminders: Reminder[];
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  onEdit?: (reminder: Reminder) => void;
}

const ReminderList: React.FC<ReminderListProps> = React.memo(({ reminders, toggleReminder, deleteReminder, onEdit }) => {
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const handleReadAloud = async (reminder: Reminder) => {
    if (playingId) return; // Prevent overlapping
    setPlayingId(reminder.id);
    try {
      const dateObj = new Date(reminder.date);
      const dateStr = dateObj.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });

      const [hours, minutes] = reminder.time.split(':').map(Number);
      const timeDate = new Date();
      timeDate.setHours(hours, minutes);
      const timeStr = timeDate.toLocaleTimeString('en-GB', { 
        hour: 'numeric', 
        minute: minutes > 0 ? 'numeric' : undefined, 
        hour12: true 
      });

      let textToRead = `Reminder: ${reminder.title}. `;
      textToRead += `It is scheduled for ${timeStr} on ${dateStr}. `;
      
      if (reminder.recurrence && reminder.recurrence !== 'none') {
        textToRead += `This reminder repeats ${reminder.recurrence}. `;
      }
      
      if (reminder.notes) {
        textToRead += `Note: ${reminder.notes}`;
      }

      const audioData = await generateSpeech(textToRead);
      if (audioData) {
        await playAudio(audioData);
      }
    } catch (err) {
      console.error("Failed to speak", err);
    } finally {
      setPlayingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'medication': return <Pill className="w-6 h-6 text-pink-600 dark:text-pink-400" />;
      case 'appointment': return <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
      default: return <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  if (reminders.length === 0) {
    return (
      <div className="text-center py-16 px-4 glass-panel rounded-3xl shadow-lg border border-white/20 animate-fade-in">
        <div className="bg-white/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
          <Clock className="w-10 h-10 text-slate-400 dark:text-slate-300" />
        </div>
        <p className="text-xl text-slate-600 dark:text-slate-300 mb-2 font-medium">No reminders yet.</p>
        <p className="text-lg text-slate-500 dark:text-slate-400">Tap the <PlusIconInline /> button to create one.</p>
      </div>
    );
  }

  // Sort reminders: Incomplete first, then by date/time
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.completed === b.completed) {
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    }
    return a.completed ? 1 : -1;
  });

  return (
    <div className="space-y-4 pb-24">
      {sortedReminders.map((reminder) => (
        <div 
          key={reminder.id}
          className={`p-5 rounded-2xl shadow-lg border transition-all duration-300 animate-slide-up ${
            reminder.completed 
              ? 'glass-panel opacity-60 border-white/10' 
              : 'glass-panel border-white/20 hover:border-indigo-400/50 hover:shadow-xl'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            
            <button
              onClick={() => toggleReminder(reminder.id)}
              className="mt-1 p-2 -ml-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              aria-label={reminder.completed ? "Mark as incomplete" : "Mark as complete"}
            >
              {reminder.completed ? (
                <CheckCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              ) : (
                <Circle className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getIcon(reminder.type)}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {reminder.type}
                </span>
              </div>
              <h3 className={`text-xl md:text-2xl font-bold leading-tight mb-2 break-words ${reminder.completed ? 'text-slate-500 dark:text-slate-400 line-through decoration-2' : 'text-slate-900 dark:text-white'}`}>
                {reminder.title}
              </h3>
              <div className="flex flex-wrap gap-2 text-base md:text-lg text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5 glass-input px-3 py-1 rounded-lg border border-white/10">
                  <Clock className="w-4 h-4" /> {reminder.time}
                </span>
                <span className="flex items-center gap-1.5 glass-input px-3 py-1 rounded-lg border border-white/10">
                  <Calendar className="w-4 h-4" /> {reminder.date}
                </span>
                {reminder.recurrence && reminder.recurrence !== 'none' && (
                  <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30 backdrop-blur-sm">
                    <Repeat className="w-3.5 h-3.5" /> 
                    <span className="capitalize text-sm font-bold">{reminder.recurrence}</span>
                  </span>
                )}
              </div>
              {reminder.notes && (
                <p className="mt-3 text-base text-slate-700 dark:text-slate-200 italic bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 backdrop-blur-sm">
                  "{reminder.notes}"
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => handleReadAloud(reminder)}
                disabled={!!playingId}
                className={`p-3 rounded-xl transition-colors backdrop-blur-sm border ${
                  playingId === reminder.id 
                    ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50 ring-2 ring-indigo-400/50' 
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                }`}
                aria-label="Read aloud"
              >
                {playingId === reminder.id ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(reminder)}
                  className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 backdrop-blur-sm transition-colors"
                  aria-label="Edit reminder"
                >
                  <Edit2 className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={() => deleteReminder(reminder.id)}
                className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 backdrop-blur-sm transition-colors"
                aria-label="Delete reminder"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

const PlusIconInline = () => (
  <span className="inline-block bg-indigo-600 text-white rounded-full p-0.5 align-middle mx-1">
     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
  </span>
);

export default ReminderList;