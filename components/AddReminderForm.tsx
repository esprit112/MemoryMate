
import React, { useState } from 'react';
import { Reminder, UserProfile } from '../types';
import { X, Check } from 'lucide-react';
import { generateId } from '../utils/helpers';

interface AddReminderFormProps {
  user: UserProfile;
  onAdd: (reminder: Omit<Reminder, 'userId'>) => void;
  onCancel: () => void;
  initialData?: Reminder;
  isEditing?: boolean;
}

const AddReminderForm: React.FC<AddReminderFormProps> = ({ user, onAdd, onCancel, initialData, isEditing = false }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [time, setTime] = useState(initialData?.time || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<Reminder['type']>(initialData?.type || 'general');
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>(initialData?.recurrence || 'none');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !time || !date) return;

    const newReminder: Omit<Reminder, 'userId'> = {
      id: initialData?.id || generateId(),
      title,
      time,
      date,
      type,
      notes,
      recurrence,
      completed: initialData?.completed || false,
    };
    
    // Activity logging is handled in App.tsx where the API call is made
    onAdd(newReminder);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-panel rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out] border border-white/20">
        <div className="p-6 bg-indigo-600/80 backdrop-blur-md text-white flex justify-between items-center border-b border-white/10">
          <h2 className="text-2xl font-bold">{isEditing ? 'Edit Reminder' : 'New Reminder'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">What is it for?</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Take heart medication"
              className="w-full text-xl p-4 glass-input rounded-xl text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xl p-4 glass-input rounded-xl text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xl p-4 glass-input rounded-xl text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(['medication', 'appointment', 'health', 'general'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`p-3 rounded-xl border text-lg font-medium capitalize transition-all backdrop-blur-sm ${
                    type === t 
                      ? 'border-indigo-500/50 bg-indigo-500/30 text-indigo-200 ring-2 ring-indigo-400/50' 
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">Repeat</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  className={`p-2 rounded-xl border text-sm font-bold capitalize transition-all backdrop-blur-sm ${
                    recurrence === r 
                      ? 'border-indigo-500/50 bg-indigo-500/30 text-indigo-200 ring-2 ring-indigo-400/50' 
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  {r === 'none' ? 'Never' : r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details..."
              className="w-full text-xl p-4 glass-input rounded-xl text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 h-24 outline-none placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600/80 backdrop-blur-md text-white text-xl font-bold py-4 rounded-xl hover:bg-indigo-500/80 transition-colors flex items-center justify-center gap-2 border border-white/10 shadow-lg mt-4"
          >
            <Check className="w-6 h-6" /> Save Reminder
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddReminderForm;
