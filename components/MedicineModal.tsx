
import React, { useState } from 'react';
import { Medicine, Reminder } from '../types';
import { X, Check, Camera, Trash2, Sparkles, Loader2, ZoomIn, Bell, Clock, Timer, Calendar } from 'lucide-react';
import { analyzeMedicinePackaging } from '../services/geminiService';
import { generateId, compressImage } from '../utils/helpers';

interface MedicineModalProps {
  userId: string;
  existingMedicine?: Medicine | null;
  onSave: (medicine: Medicine, newReminders: Omit<Reminder, 'userId' | 'id'>[]) => void;
  onCancel: () => void;
}

const MedicineModal: React.FC<MedicineModalProps> = ({ userId, existingMedicine, onSave, onCancel }) => {
  const [name, setName] = useState(existingMedicine?.name || '');
  const [strength, setStrength] = useState(existingMedicine?.strength || '');
  const [directions, setDirections] = useState(existingMedicine?.directions || '');
  const [images, setImages] = useState<string[]>(existingMedicine?.images || []);
  const [lastIssuedDate, setLastIssuedDate] = useState(existingMedicine?.lastIssuedDate || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reminder State (Take Medicine)
  const [addReminder, setAddReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderRecurrence, setReminderRecurrence] = useState<string>('daily');
  const [intervalHours, setIntervalHours] = useState('4');

  // Reminder State (Repeat Prescription)
  const [addPrescriptionReminder, setAddPrescriptionReminder] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (images.length >= 3) {
        alert("Maximum of 3 images allowed.");
        return;
      }

      setIsAnalyzing(true);
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          // Compress locally
          const compressed = await compressImage(base64String, 800, 0.7);
          const base64Data = compressed.split(',')[1];
          
          setImages(prev => [...prev, compressed]); // Store with prefix for preview

          try {
            const result = await analyzeMedicinePackaging(base64Data, file.type);
            if (result) {
              if (result.name && !name) setName(result.name);
              if (result.strength && !strength) setStrength(result.strength);
              if (result.directions && !directions) setDirections(result.directions);
            }
          } catch (error) {
            console.error("AI Analysis failed", error);
          }
        } catch (err) {
          console.error("Image processing error", err);
        } finally {
          setIsAnalyzing(false);
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const medicine: Medicine = {
      id: existingMedicine ? existingMedicine.id : generateId(),
      userId,
      name,
      strength,
      directions,
      images,
      createdAt: existingMedicine ? existingMedicine.createdAt : new Date().toISOString(),
      lastIssuedDate: lastIssuedDate || undefined
    };

    const newReminders: Omit<Reminder, 'userId' | 'id'>[] = [];

    // 1. "Take Medicine" Reminder
    if (addReminder) {
      const finalRecurrence = reminderRecurrence === 'interval' 
        ? `every ${intervalHours} hours` 
        : reminderRecurrence;

      newReminders.push({
        title: `Take ${name} ${strength ? `(${strength})` : ''}`,
        time: reminderTime,
        date: new Date().toISOString().split('T')[0], // Start from today
        type: 'medication',
        completed: false,
        recurrence: finalRecurrence,
        notes: directions
      });
    }

    // 2. "Re-order Prescription" Reminder
    if (addPrescriptionReminder && lastIssuedDate) {
      // Calculate start date: For the modal, we assume the user wants the reminder cycle to start based on the last issued date.
      // If lastIssuedDate is today, reminder next month.
      // Typically we set the reminder date to now, and recurrence monthly. 
      // But if lastIssuedDate is in the past, we should probably set the next occurrence.
      // For simplicity, we create a recurring reminder starting from lastIssuedDate (or today if that's in past, but logic handles passed dates).
      // Ideally, the reminder system handles "next due" based on start date + recurrence.
      
      newReminders.push({
        title: `Order repeat prescription: ${name}`,
        time: '10:00', // Default morning time
        date: lastIssuedDate, // Start counting from the issue date
        type: 'medication',
        completed: false,
        recurrence: 'monthly',
        notes: 'Contact pharmacy or doctor to re-order.'
      });
    }

    onSave(medicine, newReminders);
  };

  const getSrc = (imgData: string) => {
    return imgData.startsWith('data:') ? imgData : `data:image/jpeg;base64,${imgData}`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      
      {/* Full Screen Image Preview Overlay */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={previewImage} 
            alt="Full size preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
        </div>
      )}

      <div className="glass-panel rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] border border-white/20">
        <div className="p-6 bg-teal-600/90 backdrop-blur-md text-white flex justify-between items-center shrink-0 border-b border-teal-400/30">
          <h2 className="text-2xl font-bold drop-shadow-sm">{existingMedicine ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Images Section */}
          <div>
            <label className="block text-lg font-medium text-slate-700 dark:text-slate-300 mb-3">Medicine Photos (Max 3)</label>
            <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide">
              {images.map((imgData, idx) => (
                <div 
                  key={idx} 
                  className="relative flex-shrink-0 w-40 h-40 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 hover:border-teal-500 hover:shadow-lg transition-all duration-300 snap-center group cursor-pointer bg-slate-50 dark:bg-slate-900"
                  onClick={() => setPreviewImage(getSrc(imgData))}
                >
                  <img 
                    src={getSrc(imgData)} 
                    alt={`Medicine ${idx + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  
                  {isAnalyzing && idx === images.length - 1 && (
                      <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-pulse">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-xs font-bold uppercase tracking-wider">Scanning</span>
                      </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                    className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 shadow-sm transition-transform hover:scale-110 z-10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  
                  <div className="absolute inset-0 bg-teal-900/0 group-hover:bg-teal-900/10 transition-colors duration-300 pointer-events-none" />
                </div>
              ))}
              
              {images.length < 3 && (
                <label className={`flex-shrink-0 w-40 h-40 rounded-xl border-2 border-dashed border-teal-300/50 dark:border-teal-700/50 glass-panel flex flex-col items-center justify-center cursor-pointer hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors snap-center shadow-sm ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isAnalyzing ? (
                    <Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-teal-600 dark:text-teal-400 mb-1 drop-shadow-sm" />
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-300 drop-shadow-sm">Add Photo</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isAnalyzing} />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drop-shadow-sm">Medicine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Atorvastatin"
              className="w-full text-xl p-4 border border-white/20 rounded-xl glass-input text-slate-900 dark:text-white focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20 transition-all shadow-inner placeholder-slate-500/70 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drop-shadow-sm">Strength / Dosage</label>
            <input
              type="text"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              placeholder="e.g., 20mg"
              className="w-full text-xl p-4 border border-white/20 rounded-xl glass-input text-slate-900 dark:text-white focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20 transition-all shadow-inner placeholder-slate-500/70 outline-none"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drop-shadow-sm">Directions for Use</label>
            <textarea
              value={directions}
              onChange={(e) => setDirections(e.target.value)}
              placeholder="e.g., Take one tablet daily with water after breakfast"
              className="w-full text-xl p-4 border border-white/20 rounded-xl glass-input text-slate-900 dark:text-white focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20 h-24 transition-all shadow-inner placeholder-slate-500/70 outline-none resize-none"
            />
          </div>

          {/* Repeat Prescription Section */}
          <div className="glass-panel p-5 rounded-2xl border border-indigo-200/30 dark:border-indigo-800/30 shadow-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 pointer-events-none" />
             <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2 relative z-10 drop-shadow-sm">
                <Calendar className="w-5 h-5" /> Repeat Prescription
             </h3>
             <div className="space-y-4 relative z-10">
               <div>
                  <label className="block text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-1 drop-shadow-sm">
                    Date Last Issued
                  </label>
                  <input 
                    type="date"
                    value={lastIssuedDate}
                    onChange={(e) => setLastIssuedDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
                  />
               </div>
               
               <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${addPrescriptionReminder ? 'glass-panel border border-indigo-300/50 dark:border-indigo-700/50 shadow-sm' : 'hover:bg-white/30 dark:hover:bg-slate-700/50'}`}>
                  <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${addPrescriptionReminder ? 'bg-indigo-600/90 border-indigo-400/50' : 'glass-panel border-white/30'}`}>
                    {addPrescriptionReminder && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={addPrescriptionReminder} 
                    onChange={(e) => setAddPrescriptionReminder(e.target.checked)} 
                    className="hidden" 
                    disabled={!lastIssuedDate}
                  />
                  <div className={!lastIssuedDate ? 'opacity-50' : ''}>
                    <span className="block font-bold text-indigo-900 dark:text-indigo-200 text-sm drop-shadow-sm">Set monthly reminder to re-order?</span>
                    <span className="block text-xs text-indigo-800 dark:text-indigo-300 mt-0.5 font-medium">
                      Creates a recurring reminder starting from the date above.
                    </span>
                  </div>
               </label>
             </div>
          </div>

          {/* New Reminder Section (Only if New) */}
          {!existingMedicine && (
            <div className={`p-4 rounded-xl border transition-all shadow-sm relative overflow-hidden ${addReminder ? 'glass-panel border-teal-300/50 dark:border-teal-700/50' : 'glass-panel border-white/20'}`}>
              {addReminder && <div className="absolute inset-0 bg-teal-500/5 dark:bg-teal-500/10 pointer-events-none" />}
              <div className="flex items-center justify-between mb-2 relative z-10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${addReminder ? 'bg-teal-600/90 border-teal-400/50' : 'glass-panel border-white/30'}`}>
                    {addReminder && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <input type="checkbox" checked={addReminder} onChange={(e) => setAddReminder(e.target.checked)} className="hidden" />
                  <span className={`text-lg font-bold drop-shadow-sm ${addReminder ? 'text-teal-900 dark:text-teal-200' : 'text-slate-700 dark:text-slate-300'}`}>
                    Remind me to take this
                  </span>
                </label>
                <Bell className={`w-6 h-6 drop-shadow-sm ${addReminder ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
              </div>

              {addReminder && (
                <div className="mt-4 space-y-4 animate-slide-up relative z-10">
                  <div>
                    <label className="block text-sm font-bold text-teal-800 dark:text-teal-300 mb-1 drop-shadow-sm">When does it start?</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3.5 w-5 h-5 text-teal-500 dark:text-teal-400" />
                      <input 
                        type="time" 
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="w-full pl-10 p-3 rounded-xl glass-input border border-white/20 focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20 outline-none text-slate-900 dark:text-white shadow-inner"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-teal-800 dark:text-teal-300 mb-1 drop-shadow-sm">How often?</label>
                    <div className="flex flex-wrap gap-2">
                      {['daily', 'weekly', 'monthly'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReminderRecurrence(r)}
                          className={`flex-1 min-w-[80px] py-2 px-1 rounded-lg text-sm font-bold capitalize border transition-all shadow-sm ${
                            reminderRecurrence === r
                              ? 'bg-teal-600/90 backdrop-blur-md text-white border-teal-400/50'
                              : 'glass-panel text-teal-700 dark:text-teal-300 border-white/20 hover:bg-white/30 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setReminderRecurrence('interval')}
                        className={`flex-1 min-w-[100px] py-2 px-1 rounded-lg text-sm font-bold capitalize border transition-all shadow-sm ${
                          reminderRecurrence === 'interval'
                            ? 'bg-teal-600/90 backdrop-blur-md text-white border-teal-400/50'
                            : 'glass-panel text-teal-700 dark:text-teal-300 border-white/20 hover:bg-white/30 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        Every X Hours
                      </button>
                    </div>

                    {reminderRecurrence === 'interval' && (
                       <div className="mt-3 glass-panel p-3 rounded-xl border border-teal-200/30 dark:border-teal-800/30 flex items-center justify-center gap-3 animate-fade-in shadow-sm">
                          <Timer className="w-5 h-5 text-teal-600 dark:text-teal-400 drop-shadow-sm" />
                          <span className="text-teal-900 dark:text-teal-200 font-bold drop-shadow-sm">Every</span>
                          <input 
                            type="number" 
                            min="1" 
                            max="48"
                            value={intervalHours}
                            onChange={(e) => setIntervalHours(e.target.value)}
                            className="w-20 p-2 border border-white/20 rounded-lg text-center font-bold text-lg glass-input text-slate-900 dark:text-white focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20 outline-none shadow-inner"
                          />
                          <span className="text-teal-900 dark:text-teal-200 font-bold drop-shadow-sm">hours</span>
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isAnalyzing}
            className="w-full bg-teal-600/90 backdrop-blur-md dark:bg-teal-500/90 text-white text-xl font-bold py-4 rounded-xl hover:bg-teal-700 dark:hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shrink-0 border border-teal-400/30 shadow-lg active:scale-[0.98]"
          >
            {isAnalyzing ? <Loader2 className="animate-spin w-6 h-6" /> : <Check className="w-6 h-6" />}
            {existingMedicine ? 'Update Medicine' : 'Save Medicine'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MedicineModal;
