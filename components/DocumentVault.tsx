
import React, { useState, useEffect } from 'react';
import { SupportCardSuggestion, UserProfile, UserDocument, Reminder } from '../types';
import { FileText, Upload, Trash2, Bot, Loader2, Image as ImageIcon, Eye, X, CalendarPlus, Check, Building2, User, Phone, MapPin, Mail, Sparkles, HeartPulse, Calendar, IdCard, Pill, Home, Car, RotateCcw } from 'lucide-react';
import { analyzeDocument, DocumentAnalysisResult } from '../services/geminiService';
import { generateId, compressImage } from '../utils/helpers';
import * as api from '../services/api';

interface DocumentVaultProps {
  user: UserProfile;
  onReminderCreated?: () => void;
  filter?: 'health' | 'personal' | 'all';
}

const CATEGORY_ICONS: Record<string, any> = {
  'Medical': HeartPulse,
  'Appointment': Calendar,
  'Identification': IdCard,
  'Medicine': Pill,
  'General': FileText,
  'Household': Home,
  'Vehicle': Car
};

const HEALTH_CATEGORIES = ['Medical', 'Appointment', 'Medicine'];
const PERSONAL_CATEGORIES = ['Identification', 'General', 'Household', 'Vehicle'];

const DocumentVault: React.FC<DocumentVaultProps> = React.memo(({ user, onReminderCreated, filter = 'all' }) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<UserDocument | null>(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [docFile, setDocFile] = useState<{data: string, mime: string, name: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    organization: '',
    department: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    appointmentDate: '',
    appointmentTime: '',
    location: '',
    summary: '',
    healthInsights: '',
    supportCardSuggestion: null as SupportCardSuggestion | null
  });

  useEffect(() => {
    loadDocs();
  }, [user.id]);

  const loadDocs = async () => {
    try {
      let docs = await api.fetchDocuments(user.id);
      
      // Filter based on prop
      if (filter === 'health') {
        docs = docs.filter(d => HEALTH_CATEGORIES.includes(d.category || ''));
      } else if (filter === 'personal') {
        docs = docs.filter(d => PERSONAL_CATEGORIES.includes(d.category || '') || !d.category || d.category === 'General');
      }
      
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load docs", e);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset Form
    setDocFile(null);
    setFormData({
      name: file.name,
      category: '',
      organization: '',
      department: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      appointmentDate: '',
      appointmentTime: '',
      location: '',
      summary: '',
      healthInsights: '',
      supportCardSuggestion: null
    });

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        let finalBase64 = base64String.split(',')[1];
        
        // Compress if image
        if (file.type.startsWith('image/')) {
            const compressed = await compressImage(base64String, 1200, 0.8);
            finalBase64 = compressed.split(',')[1];
        }

        setDocFile({
            data: finalBase64,
            mime: file.type,
            name: file.name
        });

        // Trigger AI Analysis
        try {
            const analysis = await analyzeDocument(finalBase64, file.type);
            if (analysis) {
                setFormData(prev => ({
                    ...prev,
                    summary: analysis.summary || '',
                    category: analysis.category || '',
                    organization: analysis.organization || '',
                    department: analysis.department || '',
                    contactName: analysis.contactName || '',
                    contactPhone: analysis.contactPhone || '',
                    contactEmail: analysis.contactEmail || '',
                    appointmentDate: analysis.appointmentDate || '',
                    appointmentTime: analysis.appointmentTime || '',
                    location: analysis.location || '',
                    healthInsights: analysis.healthInsights || '',
                    supportCardSuggestion: analysis.supportCardSuggestion || null
                }));
            }
        } catch (aiError) {
            console.error("AI Auto-fill failed", aiError);
        }

      } catch (err) {
        console.error(err);
        alert("Failed to process file.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;

    setLoading(true);
    try {
        const newDoc: UserDocument = {
            id: generateId(),
            userId: user.id,
            mimeType: docFile.mime,
            type: docFile.mime.includes('pdf') ? 'pdf' : 'image',
            data: docFile.data,
            createdAt: new Date().toISOString(),
            ...formData
        };

        await api.createDocument(newDoc);
        
        // Log Activity
        await api.createActivityLog({
          id: generateId(),
          userId: user.id,
          action_type: 'ADD',
          subject_profile: user.name,
          performed_by: user.name,
          description: `Added new document: ${newDoc.name}`,
          timestamp: new Date().toISOString(),
          reference_id: newDoc.id
        });
        if (formData.appointmentDate && formData.appointmentTime) {
            if (window.confirm(`Found appointment for ${formData.appointmentDate} at ${formData.appointmentTime}. Create a reminder?`)) {
                const reminder: Reminder = {
                    id: generateId(),
                    userId: user.id,
                    title: `Appt: ${formData.organization || formData.name}`,
                    date: formData.appointmentDate,
                    time: formData.appointmentTime,
                    type: 'appointment',
                    completed: false,
                    recurrence: 'none',
                    notes: `Location: ${formData.location}. Contact: ${formData.contactName}`
                };
                await api.createReminder(reminder);
                
                // Log Activity
                await api.createActivityLog({
                  id: generateId(),
                  userId: user.id,
                  action_type: 'ADD',
                  subject_profile: user.name,
                  performed_by: 'Jarvis AI',
                  description: `Auto-created reminder for appointment: ${formData.organization || formData.name}`,
                  timestamp: new Date().toISOString(),
                  reference_id: reminder.id
                });

                if (onReminderCreated) onReminderCreated();
            }
        }

        if (formData.supportCardSuggestion) {
            if (window.confirm(formData.supportCardSuggestion.message)) {
                await api.createSupportCard({
                    id: generateId(),
                    userId: user.id,
                    condition: formData.supportCardSuggestion.detected_condition,
                    nhsUrl: formData.supportCardSuggestion.nhs_url,
                    charityUrl: formData.supportCardSuggestion.charity_url,
                    category: formData.supportCardSuggestion.category
                });
                
                // Log Activity
                await api.createActivityLog({
                  id: generateId(),
                  userId: user.id,
                  action_type: 'ADD',
                  subject_profile: user.name,
                  performed_by: user.name,
                  description: `Added Support Card for ${formData.supportCardSuggestion.detected_condition}`,
                  timestamp: new Date().toISOString()
                });

                alert(`Added ${formData.supportCardSuggestion.detected_condition} to your Help & Info section.`);
            }
        }

        setShowModal(false);
        setDocFile(null);
        await loadDocs();
    } catch (err) {
        console.error(err);
        alert("Failed to save document.");
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (doc: UserDocument) => {
    if (window.confirm("Delete this document?")) {
      // Store the document data before deleting for potential undo
      const docDataToStore = JSON.stringify(doc);
      
      await api.deleteDocument(doc.id);
      
      // Log Activity with the document data stored in the description for prototype undo
      await api.createActivityLog({
        id: generateId(),
        userId: user.id,
        action_type: 'DELETE',
        subject_profile: user.name,
        performed_by: user.name,
        description: `Deleted document: ${doc.name}`,
        timestamp: new Date().toISOString(),
        reference_id: doc.id,
        deleted_data: docDataToStore
      });

      await loadDocs();
    }
  };

  // Helper for inputs
  const InputField = ({ label, name, type = "text", icon: Icon }: any) => (
    <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />}
            <input 
                type={type}
                name={name}
                value={(formData as any)[name]}
                onChange={(e) => setFormData(prev => ({ ...prev, [name]: e.target.value }))}
                className={`w-full p-2.5 rounded-xl glass-input text-slate-200 focus:border-indigo-500 outline-none ${Icon ? 'pl-9' : ''}`}
            />
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[60] bg-slate-900/95 flex flex-col p-4 animate-fade-in">
          <div className="flex justify-between items-center text-white mb-4">
            <h2 className="text-xl font-bold truncate pr-4">{viewingDoc.name}</h2>
            <button 
              onClick={() => setViewingDoc(null)}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center relative">
             {viewingDoc.type === 'pdf' ? (
                <iframe 
                  src={`data:application/pdf;base64,${viewingDoc.data}`} 
                  className="w-full h-full"
                  title="PDF Viewer"
                />
             ) : (
                <img 
                  src={`data:${viewingDoc.mimeType};base64,${viewingDoc.data}`} 
                  alt={viewingDoc.name}
                  className="max-w-full max-h-full object-contain"
                />
             )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass-panel rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in border border-white/20">
                <div className="p-6 bg-indigo-600/80 backdrop-blur-md text-white flex justify-between items-center shrink-0 rounded-t-3xl border-b border-white/10">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Upload className="w-6 h-6" /> Upload Document
                    </h2>
                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
                    
                    {/* File Input */}
                    <div className="border-2 border-dashed border-white/30 rounded-xl p-4 text-center glass-input">
                        {!docFile ? (
                            <label className="cursor-pointer block">
                                <FileText className="w-10 h-10 mx-auto text-indigo-400 mb-2" />
                                <span className="font-bold text-indigo-400">Tap to select file</span>
                                <p className="text-xs text-slate-400">PDF or Images</p>
                                <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleFileSelect} />
                            </label>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Check className="w-5 h-5 text-green-400" />
                                    <span className="font-bold text-sm text-slate-200 truncate max-w-[200px]">{docFile.name}</span>
                                </div>
                                <button type="button" onClick={() => { setDocFile(null); }} className="text-red-400 text-sm font-bold hover:text-red-300">Change</button>
                            </div>
                        )}
                    </div>

                    {isAnalyzing && (
                        <div className="bg-indigo-500/20 p-3 rounded-lg flex items-center gap-3 animate-pulse border border-indigo-500/30 backdrop-blur-sm">
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                            <span className="text-sm font-bold text-indigo-200">Jarvis is reading the document to auto-fill details...</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.supportCardSuggestion && (
                            <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/40 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50">
                                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2">
                                    {formData.supportCardSuggestion.message}
                                </p>
                                <p className="text-xs text-indigo-600 dark:text-indigo-300">
                                    (This will be added when you save the document)
                                </p>
                            </div>
                        )}
                        <InputField label="File Name" name="name" icon={FileText} />
                        <InputField label="Type / Category" name="category" icon={Bot} />
                        
                        <InputField label="Organization" name="organization" icon={Building2} />
                        <InputField label="Department" name="department" icon={Building2} />
                        
                        <InputField label="Contact Name" name="contactName" icon={User} />
                        <InputField label="Contact Number" name="contactPhone" icon={Phone} type="tel" />
                        
                        <div className="md:col-span-2">
                            <InputField label="Contact Email" name="contactEmail" icon={Mail} type="email" />
                        </div>

                        <div className="md:col-span-2 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 backdrop-blur-sm">
                             <h4 className="font-bold text-indigo-300 mb-3 flex items-center gap-2">
                                <CalendarPlus className="w-5 h-5" /> Appointment Details
                             </h4>
                             <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-300 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={formData.appointmentDate}
                                        onChange={(e) => setFormData(prev => ({...prev, appointmentDate: e.target.value}))}
                                        className="w-full p-2 rounded-lg glass-input text-slate-200 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-300 mb-1">Time</label>
                                    <input 
                                        type="time" 
                                        value={formData.appointmentTime}
                                        onChange={(e) => setFormData(prev => ({...prev, appointmentTime: e.target.value}))}
                                        className="w-full p-2 rounded-lg glass-input text-slate-200 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                             </div>
                             <InputField label="Location / Address" name="location" icon={MapPin} />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-300 mb-1">Summary / Notes</label>
                            <textarea 
                                rows={3}
                                value={formData.summary}
                                onChange={(e) => setFormData(prev => ({...prev, summary: e.target.value}))}
                                className="w-full p-3 rounded-xl glass-input text-slate-200 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !docFile}
                        className="w-full bg-indigo-600/80 backdrop-blur-md text-white text-xl font-bold py-4 rounded-xl hover:bg-indigo-500/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-4 border border-white/10 shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <Check className="w-6 h-6" />}
                        Save Document
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* List Header */}
      <div className="flex justify-between items-center mb-4">
         <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Saved Letters
         </h2>
         <button 
           onClick={() => setShowModal(true)}
           className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1 hover:bg-indigo-500/30 backdrop-blur-sm transition-colors"
         >
           <Upload className="w-4 h-4" /> Upload Letter
         </button>
      </div>

      <div className="space-y-4">
        {documents.map((doc) => {
          const CategoryIcon = CATEGORY_ICONS[doc.category || 'General'] || FileText;
          const isPending = doc.status === 'pending_analysis';

          return (
            <div key={doc.id} className={`glass-panel rounded-2xl p-4 shadow-lg border border-white/20 animate-slide-up relative overflow-hidden ${isPending ? 'opacity-60 grayscale' : ''}`}>
              
              {/* Category Icon Badge */}
              {!isPending && (
                <div className="absolute top-0 left-0 p-1.5 bg-indigo-500/80 backdrop-blur-md text-white rounded-br-xl shadow-sm z-10 border-b border-r border-white/10">
                  <CategoryIcon className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="flex gap-4">
                {/* Thumbnail / Icon */}
                <div 
                  onClick={() => !isPending && setViewingDoc(doc)}
                  className={`w-20 h-24 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer border border-white/10 ${doc.type === 'pdf' ? 'bg-red-500/10' : 'bg-white/5'}`}
                >
                  {doc.type === 'pdf' ? (
                    <div className="text-center">
                      <FileText className="w-8 h-8 text-red-400 mx-auto mb-1" />
                      <span className="text-[10px] font-bold text-red-500 uppercase">PDF</span>
                    </div>
                  ) : (
                    <img 
                      src={`data:${doc.mimeType};base64,${doc.data}`} 
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate pr-2 text-base">{doc.name}</h3>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          {doc.category && <span className="glass-input px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-white/10">{doc.category}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {isPending && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse mr-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
                        </div>
                      )}
                      <button 
                        onClick={() => setViewingDoc(doc)}
                        disabled={isPending}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-30"
                        title="View File"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Display */}
                  <div className="mt-2 space-y-1.5">
                      {doc.organization && (
                          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {doc.organization}
                          </p>
                      )}
                      
                      {doc.appointmentDate && (
                          <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 backdrop-blur-sm">
                              <CalendarPlus className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-[10px] font-medium text-indigo-800 dark:text-indigo-300">
                                  {doc.appointmentDate} @ {doc.appointmentTime}
                              </span>
                          </div>
                      )}
                  </div>
                </div>
              </div>

              {doc.summary && (
                  <div className="mt-3">
                    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed glass-input p-2.5 rounded-xl border border-white/10 line-clamp-2">
                        {doc.summary}
                    </p>
                  </div>
              )}

              {doc.healthInsights && (
                  <div className="mt-3 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <HeartPulse className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">NHS Health Insights</h4>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                        {doc.healthInsights}
                    </p>
                  </div>
              )}
            </div>
          )})}

        {documents.length === 0 && !loading && (
          <div className="text-center py-12 border-2 border-dashed border-white/20 glass-panel rounded-2xl">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
            <p className="text-slate-600 dark:text-slate-400">No documents uploaded.</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Upload appointment letters to keep track.</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default DocumentVault;
