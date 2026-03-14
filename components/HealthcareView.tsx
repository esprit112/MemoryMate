

import React, { useState, useEffect } from 'react';
import { Reminder, Medicine, UserProfile } from '../types';
import ReminderList from './ReminderList';
import MedicineModal from './MedicineModal';
import DocumentVault from './DocumentVault';
import HealthInsightsTab from './HealthInsightsTab';
import { Pill, AlertCircle, Plus, Edit2, Trash2, BellRing, FileText, Check, Brain } from 'lucide-react';
import * as api from '../services/api';

interface HealthcareViewProps {
  user: UserProfile;
  reminders: Reminder[];
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  onRefreshReminders?: () => void; // Callback to refresh parent reminders
  onEditReminder?: (reminder: Reminder) => void;
}

const HealthcareView: React.FC<HealthcareViewProps> = React.memo(({ user, reminders, toggleReminder, deleteReminder, onEditReminder }) => {
  const [activeTab, setActiveTab] = useState<'medicines' | 'documents' | 'insights'>('medicines');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  
  useEffect(() => {
    if (user.id) {
        loadMedicines(user.id);
        loadDocuments(user.id);
    }
  }, [user.id]);

  const loadMedicines = async (uid: string) => {
    try {
      const data = await api.fetchMedicines(uid);
      setMedicines(data);
    } catch (err) {
      console.error("Failed to load medicines", err);
    }
  };

  const loadDocuments = async (uid: string) => {
    try {
      const data = await api.fetchDocuments(uid);
      setDocuments(data.filter(d => d.category === 'Medical' || d.category === 'Appointment' || d.category === 'Medicine'));
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  };

  const handleRefreshApp = () => {
    // Force a full reload to ensure reminders are updated in the main App state
    window.location.reload();
  };

  const handleSaveMedicine = async (med: Medicine, newReminders: Omit<Reminder, 'userId' | 'id'>[]) => {
    try {
      if (editingMed) {
        await api.updateMedicine(med);
        await api.createActivityLog({
          id: crypto.randomUUID(),
          userId: user.id,
          action_type: 'EDIT',
          subject_profile: user.name,
          performed_by: user.name,
          description: `Updated medicine: ${med.name}`,
          timestamp: new Date().toISOString(),
          reference_id: med.id
        });
      } else {
        await api.createMedicine(med);
        await api.createActivityLog({
          id: crypto.randomUUID(),
          userId: user.id,
          action_type: 'ADD',
          subject_profile: user.name,
          performed_by: user.name,
          description: `Added new medicine: ${med.name}`,
          timestamp: new Date().toISOString(),
          reference_id: med.id
        });
      }
      
      if (newReminders && newReminders.length > 0 && user.id) {
        for (const remData of newReminders) {
            const reminder: Reminder = {
              ...remData,
              id: crypto.randomUUID(),
              userId: user.id
            };
            await api.createReminder(reminder);
        }
        handleRefreshApp();
      } else {
        if (user.id) await loadMedicines(user.id);
      }

      setShowMedModal(false);
      setEditingMed(null);
    } catch (err) {
      console.error("Failed to save medicine", err);
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this medicine?")) {
      try {
        const medToDelete = medicines.find(m => m.id === id);
        await api.deleteMedicine(id);
        
        if (medToDelete && user.id) {
          await api.createActivityLog({
            id: crypto.randomUUID(),
            userId: user.id,
            action_type: 'DELETE',
            subject_profile: user.name,
            performed_by: user.name,
            description: `Deleted medicine: ${medToDelete.name}`,
            timestamp: new Date().toISOString(),
            reference_id: id,
            deleted_data: JSON.stringify(medToDelete)
          });
        }
        
        if (user.id) await loadMedicines(user.id);
      } catch (err) {
        console.error("Failed to delete medicine", err);
      }
    }
  };

  const openAddModal = () => {
    setEditingMed(null);
    setShowMedModal(true);
  };

  const openEditModal = (med: Medicine) => {
    setEditingMed(med);
    setShowMedModal(true);
  };

  const getSrc = (imgData: string) => {
    return imgData.startsWith('data:') ? imgData : `data:image/jpeg;base64,${imgData}`;
  };

  const healthReminders = reminders.filter(r => 
    ['medication', 'health', 'appointment'].includes(r.type)
  );

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <div className="bg-teal-600/90 backdrop-blur-md border border-teal-500/30 text-white p-6 rounded-3xl shadow-lg mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Pill className="w-8 h-8" />
          Healthcare
        </h1>
        <p className="opacity-90 text-lg">
          Your medication, appointments, and health notes.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Active Reminders Header (Always visible) */}
        <section>
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Active Health Reminders
             </h2>
          </div>
          
          {healthReminders.length > 0 ? (
            <ReminderList 
              reminders={healthReminders}
              toggleReminder={toggleReminder}
              deleteReminder={deleteReminder}
              onEdit={onEditReminder}
            />
          ) : (
            <div className="glass-panel p-6 rounded-2xl border-2 border-dashed border-white/20 text-center mb-6">
              <p className="text-slate-600 dark:text-slate-400">No healthcare reminders scheduled.</p>
            </div>
          )}
        </section>

        <hr className="border-white/10" />

        {/* Tabs */}
        <div className="flex glass-panel p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('medicines')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'medicines' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-teal-600 dark:text-teal-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Pill className="w-4 h-4" /> Medicines
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'documents' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" /> Documents & Letters
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'insights' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-purple-600 dark:text-purple-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Brain className="w-4 h-4" /> AI Insights
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'medicines' && (
          <section className="animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                My Medicines
              </h2>
              <button 
                onClick={openAddModal}
                className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1 hover:bg-teal-200 dark:hover:bg-teal-800/50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Medicine
              </button>
            </div>

            {medicines.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border-2 border-dashed border-white/20 text-center text-slate-600 dark:text-slate-400">
                <Pill className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No medicines added yet.</p>
                <button onClick={openAddModal} className="text-teal-600 dark:text-teal-400 font-bold mt-2">Add your first medicine</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {medicines.map(med => (
                  <div key={med.id} className="glass-panel p-4 rounded-2xl shadow-lg border border-white/20 flex flex-col gap-3">
                  <div className="flex gap-4">
                      {med.images && med.images.length > 0 ? (
                          <div className="relative">
                             <img 
                             src={getSrc(med.images[0])} 
                             alt={med.name}
                             className="w-20 h-20 rounded-xl object-cover bg-white/10 shrink-0 border border-white/20"
                             />
                             {med.images.length > 1 && (
                               <div className="absolute -top-2 -right-2 bg-teal-600/90 backdrop-blur-sm text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white/30">
                                 +{med.images.length - 1}
                               </div>
                             )}
                          </div>
                      ) : (
                          <div className="w-20 h-20 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                          <Pill className="w-8 h-8 text-teal-400" />
                          </div>
                      )}
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{med.name}</h3>
                          {med.strength && <p className="text-teal-600 dark:text-teal-400 font-medium text-sm">{med.strength}</p>}
                          <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 line-clamp-2">{med.directions}</p>
                          {med.lastIssuedDate && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-semibold">
                              Issued: {new Date(med.lastIssuedDate).toLocaleDateString()}
                            </p>
                          )}
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                      <button onClick={() => openEditModal(med)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/10 rounded-lg transition-colors">
                          <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteMedicine(med.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                      </button>
                  </div>
                  </div>
              ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'documents' && (
          <section className="animate-slide-up">
            <DocumentVault user={user} onReminderCreated={handleRefreshApp} filter="health" />
          </section>
        )}

        {activeTab === 'insights' && (
          <section className="animate-slide-up">
            <HealthInsightsTab user={user} documents={documents} medicines={medicines} />
          </section>
        )}

      </div>

      {showMedModal && (
        <MedicineModal
          userId={user.id}
          existingMedicine={editingMed}
          onSave={handleSaveMedicine}
          onCancel={() => setShowMedModal(false)}
        />
      )}
    </div>
  );
});

export default HealthcareView;
