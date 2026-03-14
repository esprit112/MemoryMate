
import React, { useState, useEffect } from 'react';
import { UserProfile, Reminder, UserDocument, Medicine } from '../types';
import DocumentVault from './DocumentVault';
import { Users, FileText, ShieldCheck, HeartPulse, Loader2 } from 'lucide-react';
import { generateMedicalID } from '../services/geminiService';
import * as api from '../services/api';
import ReactMarkdown from 'react-markdown';

interface PersonalInfoViewProps {
  user: UserProfile;
  onRefreshReminders?: () => void;
}

const PersonalInfoView: React.FC<PersonalInfoViewProps> = React.memo(({ user, onRefreshReminders }) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'details' | 'medicalId'>('documents');
  const [medicalId, setMedicalId] = useState<string | null>(null);
  const [loadingMedicalId, setLoadingMedicalId] = useState(false);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  useEffect(() => {
    if (user.id) {
      loadData(user.id);
    }
  }, [user.id]);

  const loadData = async (uid: string) => {
    try {
      const docs = await api.fetchDocuments(uid);
      setDocuments(docs.filter(d => d.category === 'Medical' || d.category === 'Appointment' || d.category === 'Medicine'));
      const meds = await api.fetchMedicines(uid);
      setMedicines(meds);
    } catch (err) {
      console.error("Failed to load data for Medical ID", err);
    }
  };

  const handleGenerateMedicalId = async () => {
    setLoadingMedicalId(true);
    try {
      const result = await generateMedicalID(user, documents, medicines);
      setMedicalId(result);
    } catch (error) {
      console.error(error);
      setMedicalId("Failed to generate Medical ID. Please try again.");
    } finally {
      setLoadingMedicalId(false);
    }
  };

  const handleRefreshApp = () => {
    window.location.reload();
  };

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <div className="bg-indigo-600/90 backdrop-blur-md border border-indigo-500/30 text-white p-6 rounded-3xl shadow-lg mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Users className="w-8 h-8" />
          Personal Information
        </h1>
        <p className="opacity-90 text-lg">
          Identification, household letters, and general documents.
        </p>
      </div>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex glass-panel p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'documents' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" /> Documents
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'details' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> My Details
          </button>
          <button
            onClick={() => setActiveTab('medicalId')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'medicalId' 
                ? 'bg-white/20 dark:bg-slate-700/50 text-red-600 dark:text-red-400 shadow-sm backdrop-blur-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <HeartPulse className="w-4 h-4" /> Medical ID
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'documents' && (
          <section className="animate-slide-up">
            <DocumentVault 
              user={user} 
              onReminderCreated={onRefreshReminders || handleRefreshApp} 
              filter="personal"
            />
          </section>
        )}

        {activeTab === 'details' && (
          <section className="animate-slide-up space-y-4">
             <div className="glass-panel p-6 rounded-2xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Personal Details</h2>
                <div className="space-y-3">
                   <DetailRow label="Full Name" value={`${user.firstName || user.name} ${user.surname || ''}`} />
                   <DetailRow label="Date of Birth" value={user.dateOfBirth || 'Not set'} />
                   <DetailRow label="NHS Number" value={user.nhsNumber || 'Not set'} />
                   <DetailRow label="Address" value={user.address || 'Not set'} />
                </div>
             </div>

             <div className="glass-panel p-6 rounded-2xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Contact Information</h2>
                <div className="space-y-3">
                   <DetailRow label="Telephone" value={user.telephone || 'Not set'} />
                   <DetailRow label="Mobile" value={user.mobile || 'Not set'} />
                   <DetailRow label="Email" value={user.email || 'Not set'} />
                </div>
             </div>
          </section>
        )}

        {activeTab === 'medicalId' && (
          <section className="animate-slide-up space-y-4">
            <div className="glass-panel p-6 rounded-2xl shadow-lg border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/20 text-red-500 rounded-xl backdrop-blur-sm border border-red-500/30">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Digital Medical ID</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Generate an emergency card based on your vault data.</p>
                </div>
              </div>
              
              {!medicalId ? (
                <button 
                  onClick={handleGenerateMedicalId}
                  disabled={loadingMedicalId}
                  className="w-full py-3 bg-red-600/90 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 backdrop-blur-md border border-red-500/30 shadow-md"
                >
                  {loadingMedicalId ? <Loader2 className="w-5 h-5 animate-spin" /> : <HeartPulse className="w-5 h-5" />}
                  {loadingMedicalId ? 'Generating ID...' : 'Generate Medical ID'}
                </button>
              ) : (
                <div className="glass-input p-4 rounded-xl border border-white/10">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                    <ReactMarkdown>{medicalId}</ReactMarkdown>
                  </div>
                  <button 
                    onClick={handleGenerateMedicalId}
                    disabled={loadingMedicalId}
                    className="mt-4 text-sm text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1"
                  >
                    {loadingMedicalId ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartPulse className="w-4 h-4" />}
                    Regenerate Medical ID
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
});

const DetailRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">{label}</span>
    <span className="text-slate-900 dark:text-white font-bold">{value}</span>
  </div>
);

export default PersonalInfoView;
