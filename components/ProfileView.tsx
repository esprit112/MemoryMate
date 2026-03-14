import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, Save, User, Phone, HeartPulse, Stethoscope, MapPin, Hash, Building2, Search, Loader2, Map, BellRing, Mail, Trash2, Send } from 'lucide-react';
import { searchPlace } from '../services/geminiService';
import * as api from '../services/api';

interface ProfileViewProps {
  user: UserProfile;
  onSave: (updatedUser: UserProfile) => void;
  onClose: () => void;
  onDelete?: (userId: string) => void;
  onNavigate?: (tab: string) => void;
}

interface AddressFieldProps {
  label: string;
  name: keyof UserProfile;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSearch: (name: keyof UserProfile) => void;
}

const AddressField: React.FC<AddressFieldProps> = ({ label, name, placeholder, value, onChange, onSearch }) => (
  <div>
      <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <div className="relative">
          <textarea
              name={name}
              value={value || ''}
              onChange={onChange}
              placeholder={placeholder}
              rows={3}
              className="w-full p-3 pr-12 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none resize-none shadow-inner"
          />
          <button
              type="button"
              onClick={() => onSearch(name)}
              className="absolute top-3 right-3 p-2 glass-panel border border-indigo-200/30 dark:border-indigo-700/30 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
              title="Search address on map"
          >
              <Search className="w-5 h-5" />
          </button>
      </div>
  </div>
);

const ProfileView: React.FC<ProfileViewProps> = React.memo(({ user, onSave, onClose, onDelete, onNavigate }) => {
  const [formData, setFormData] = useState<UserProfile>(user);
  const [age, setAge] = useState<number | null>(null);
  
  // Notification States
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<keyof UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const diff_ms = Date.now() - dob.getTime();
      const age_dt = new Date(diff_ms);
      setAge(Math.abs(age_dt.getUTCFullYear() - 1970));
    } else {
      setAge(null);
    }
  }, [formData.dateOfBirth]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = {
      ...formData,
      // Ensure we clean up any emergencyPhones if they exist in state, though we don't display them
      emergencyPhones: [],
      name: formData.firstName || formData.name
    };
    onSave(updatedUser);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(user.id);
      onDelete(user.id);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user account. Please try again.');
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // --- Notification Handlers ---

  const handleTestAlert = async () => {
    // Check for browser permission first
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          alert("We cannot show notifications because permission was denied.");
          return;
        }
      }
    }

    setIsTestingAlert(true);
    try {
        await api.sendTestNotification(user.id, formData.firstName || formData.name);
        alert("Test push notification sent to server. You should receive it shortly.");
    } catch (error) {
        console.error(error);
        alert("Test Failed: Check the server terminal/console.");
    } finally {
        setIsTestingAlert(false);
    }
  };

  // --- Map Search Handlers ---

  const handleOpenSearch = (field: keyof UserProfile) => {
    setSearchTarget(field);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(true);
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await searchPlace(searchQuery);
      setSearchResults(Array.isArray(results) ? results : [results]);
    } catch (error) {
      console.error(error);
      alert("Could not find locations. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const applySearchResult = (result: any) => {
    if (searchTarget && result.address) {
        // 1. Update Address
        setFormData(prev => ({ ...prev, [searchTarget]: result.address }));
        
        // 2. Auto-fill Phone Number if applicable
        if (result.phone) {
          let phoneField: keyof UserProfile | null = null;
          
          if (searchTarget === 'doctorAddress') phoneField = 'doctorContact';
          else if (searchTarget === 'pharmacyAddress') phoneField = 'pharmacyContact';
          else if (searchTarget === 'nokAddress') phoneField = 'nokContact';
          
          if (phoneField) {
             setFormData(prev => ({ ...prev, [phoneField]: result.phone }));
          }
        }

        setIsSearchOpen(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 border-b border-indigo-100 dark:border-indigo-900 pb-2 mb-4 mt-6">
      <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
      <h3 className="text-lg font-bold">{title}</h3>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md z-50 flex flex-col">
      {/* Address Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="glass-panel w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-white/20">
                <div className="p-4 bg-indigo-600/90 backdrop-blur-md text-white flex justify-between items-center shrink-0 border-b border-indigo-400/30">
                    <h3 className="font-bold text-lg flex items-center gap-2 drop-shadow-sm">
                        <Map className="w-5 h-5" /> Find Address
                    </h3>
                    <button onClick={() => setIsSearchOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-hidden flex flex-col bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                    <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">Enter the name of the place, postcode, or town.</p>
                    <div className="flex gap-2 mb-4 shrink-0">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                            placeholder="e.g. Boots Pharmacy, Hull"
                            className="flex-1 p-3 border border-white/20 rounded-xl glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner placeholder-slate-500/70"
                        />
                        <button 
                            onClick={performSearch}
                            disabled={isSearching}
                            className="bg-indigo-600/90 backdrop-blur-md text-white px-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md border border-indigo-400/30 transition-colors"
                        >
                            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {searchResults.length > 0 ? (
                        searchResults.map((result, idx) => (
                          <div key={idx} className="glass-panel p-4 rounded-xl border border-white/20 hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-colors shadow-sm">
                              <h4 className="text-slate-900 dark:text-white font-bold mb-1 drop-shadow-sm">{result.name}</h4>
                              <p className="text-slate-700 dark:text-slate-300 text-sm mb-2 font-medium">{result.address}</p>
                              {result.phone && (
                                <p className="text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 mb-3">
                                  <Phone className="w-3 h-3" /> {result.phone}
                                </p>
                              )}
                              <button 
                                  onClick={() => applySearchResult(result)}
                                  className="w-full py-2 glass-panel text-indigo-700 dark:text-indigo-300 font-bold rounded-lg hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors text-sm border border-indigo-200/30 dark:border-indigo-700/30 shadow-sm"
                              >
                                  Select this Address
                              </button>
                          </div>
                        ))
                      ) : (
                        !isSearching && searchQuery && <div className="text-center text-slate-500 dark:text-slate-400 py-4 font-medium">No results found.</div>
                      )}
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-3xl mx-auto min-h-screen flex flex-col">
          {/* Header */}
        <div className="glass-panel sticky top-0 z-10 px-4 py-4 border-b border-white/20 flex justify-between items-center shadow-sm backdrop-blur-md">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 drop-shadow-sm">
            <User className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            My Profile
          </h2>
          <button 
            onClick={onClose}
            className="p-2 glass-panel rounded-full hover:bg-white/30 dark:hover:bg-slate-700/50 transition-colors border border-white/20 shadow-sm"
          >
            <X className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </button>
        </div>

        {/* Form */}
        <form id="profile-form" onSubmit={handleSubmit} className="p-4 space-y-8 flex-1">
          
          <div className="glass-panel p-4 rounded-xl border border-orange-200/30 dark:border-orange-800/30 shadow-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-orange-500/5 dark:bg-orange-500/10 pointer-events-none" />
             <div className="flex items-center justify-between mb-3 border-b border-orange-200/50 dark:border-orange-800/50 pb-2 relative z-10">
                 <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-bold drop-shadow-sm">
                    <BellRing className="w-5 h-5" />
                    Automatic Alerts
                 </div>
                 <div className="flex items-center gap-2">
                   {onNavigate && (
                     <button
                       type="button"
                       onClick={() => onNavigate('CAREGIVERS')}
                       className="text-xs glass-panel hover:bg-white/30 dark:hover:bg-slate-700/50 text-indigo-800 dark:text-indigo-200 px-3 py-1.5 rounded-lg border border-indigo-300/50 dark:border-indigo-700/50 font-bold flex items-center gap-1 transition-colors shadow-sm"
                     >
                       <User className="w-3 h-3" />
                       Manage Caregivers
                     </button>
                   )}
                   <button 
                      type="button" 
                      onClick={handleTestAlert}
                      disabled={isTestingAlert}
                      className="text-xs glass-panel hover:bg-white/30 dark:hover:bg-slate-700/50 text-orange-800 dark:text-orange-200 px-3 py-1.5 rounded-lg border border-orange-300/50 dark:border-orange-700/50 font-bold flex items-center gap-1 transition-colors shadow-sm"
                      title="Send a real test notification to your browser"
                   >
                      {isTestingAlert ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Test Push Notification
                   </button>
                 </div>
             </div>
             <p className="text-sm text-orange-900 dark:text-orange-100 mb-4 font-medium relative z-10">
               MemoryMate sends web-push notifications to your browser when important reminders are due.
             </p>

             <div className="space-y-4 relative z-10">
               {/* Settings */}
               <div className="grid grid-cols-2 gap-4 pt-2">
                 <div>
                   <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 drop-shadow-sm">Message Frequency</label>
                   <select 
                     name="notificationFrequency"
                     value={formData.notificationFrequency || 'hourly'}
                     onChange={handleChange}
                     className="w-full p-2 rounded-lg border border-white/20 glass-input text-slate-900 dark:text-white text-sm focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
                   >
                     <option value="immediately">Immediately (approx)</option>
                     <option value="hourly">Every Hour</option>
                     <option value="daily">Once a Day</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 drop-shadow-sm">Max Messages</label>
                   <select 
                     name="notificationLimit"
                     value={formData.notificationLimit || 3}
                     onChange={(e) => setFormData(prev => ({...prev, notificationLimit: parseInt(e.target.value)}))}
                     className="w-full p-2 rounded-lg border border-white/20 glass-input text-slate-900 dark:text-white text-sm focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
                   >
                     <option value="1">1 Message</option>
                     <option value="3">3 Messages</option>
                     <option value="5">5 Messages</option>
                     <option value="10">10 Messages</option>
                   </select>
                 </div>
               </div>
             </div>
          </div>

          <SectionHeader icon={User} title="Personal Details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">First Name</label>
              <input
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
                placeholder="First Name"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Surname</label>
              <input
                name="surname"
                value={formData.surname || ''}
                onChange={handleChange}
                placeholder="Surname"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="md:col-span-2">
               <AddressField 
                 label="Address" 
                 name="address" 
                 value={formData.address || ''} 
                 placeholder="Your full address" 
                 onChange={handleChange}
                 onSearch={handleOpenSearch}
               />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Date of Birth</label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
                />
                {age !== null && (
                  <span className="glass-panel border border-indigo-200/30 dark:border-indigo-700/30 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-lg font-bold text-sm whitespace-nowrap shadow-sm">
                    {age} Years Old
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">NHS Number</label>
              <div className="relative">
                <Hash className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  name="nhsNumber"
                  value={formData.nhsNumber || ''}
                  onChange={handleChange}
                  placeholder="XXX XXX XXXX"
                  className="w-full pl-10 p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
                />
              </div>
            </div>
          </div>

          <SectionHeader icon={Phone} title="Contact Details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Telephone (Home)</label>
              <input
                type="tel"
                name="telephone"
                value={formData.telephone || ''}
                onChange={handleChange}
                placeholder="Home Number"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Mobile</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile || ''}
                onChange={handleChange}
                placeholder="Mobile Number"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                placeholder="email@example.com"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 outline-none shadow-inner"
              />
            </div>
          </div>

          <SectionHeader icon={HeartPulse} title="Next of Kin" />
          <div className="space-y-4 glass-panel p-4 rounded-xl border border-pink-200/30 dark:border-pink-800/30 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-pink-500/5 dark:bg-pink-500/10 pointer-events-none" />
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input
                name="nokName"
                value={formData.nokName || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Number</label>
              <input
                name="nokContact"
                value={formData.nokContact || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <AddressField 
                  label="Address" 
                  name="nokAddress" 
                  value={formData.nokAddress || ''} 
                  placeholder="Next of Kin Address" 
                  onChange={handleChange}
                  onSearch={handleOpenSearch}
              />
            </div>
          </div>

          <SectionHeader icon={Stethoscope} title="Doctor / GP" />
          <div className="space-y-4 glass-panel p-4 rounded-xl border border-blue-200/30 dark:border-blue-800/30 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10 pointer-events-none" />
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Doctor's Name / Surgery</label>
              <input
                name="doctorName"
                value={formData.doctorName || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Surgery Contact</label>
              <input
                name="doctorContact"
                value={formData.doctorContact || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <AddressField 
                  label="Surgery Address" 
                  name="doctorAddress" 
                  value={formData.doctorAddress || ''} 
                  placeholder="Surgery Address" 
                  onChange={handleChange}
                  onSearch={handleOpenSearch}
              />
            </div>
          </div>

          <SectionHeader icon={Building2} title="Pharmacy" />
          <div className="space-y-4 glass-panel p-4 rounded-xl border border-emerald-200/30 dark:border-emerald-800/30 shadow-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none" />
             <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Pharmacy Name</label>
              <input
                name="pharmacyName"
                value={formData.pharmacyName || ''}
                onChange={handleChange}
                placeholder="e.g. Boots"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Pharmacy Contact</label>
              <input
                name="pharmacyContact"
                value={formData.pharmacyContact || ''}
                onChange={handleChange}
                placeholder="Tel number"
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 outline-none shadow-inner"
              />
            </div>
            <div className="relative z-10">
              <AddressField 
                  label="Pharmacy Address" 
                  name="pharmacyAddress" 
                  value={formData.pharmacyAddress || ''} 
                  placeholder="Pharmacy Address" 
                  onChange={handleChange}
                  onSearch={handleOpenSearch}
              />
            </div>
          </div>

        </form>
        
        {/* Delete Account Section */}
        {onDelete && (
          <div className="p-4 pb-8 max-w-3xl mx-auto w-full">
            <div className="glass-panel p-6 rounded-2xl border border-red-200/30 dark:border-red-800/30 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5 dark:bg-red-500/10 pointer-events-none" />
              <Trash2 className="w-8 h-8 text-red-500 mb-3 relative z-10 drop-shadow-sm" />
              <h3 className="text-lg font-bold text-red-900 dark:text-red-300 mb-2 relative z-10 drop-shadow-sm">Danger Zone</h3>
              <p className="text-red-800 dark:text-red-300 text-sm mb-4 font-medium relative z-10">
                Deleting this account will permanently remove all associated reminders, documents, images, and personal information. This action cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="glass-panel hover:bg-white/30 dark:hover:bg-slate-700/50 text-red-700 dark:text-red-300 font-bold py-3 px-6 rounded-xl transition-colors border border-red-300/50 dark:border-red-700/50 shadow-sm relative z-10"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 glass-panel border-t border-white/20 backdrop-blur-md z-[60]">
        <button
          type="submit"
          form="profile-form"
          className="w-full max-w-3xl mx-auto bg-indigo-600/90 backdrop-blur-md dark:bg-indigo-500/90 text-white font-bold text-lg p-4 rounded-xl shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors flex items-center justify-center gap-2 border border-indigo-400/30 active:scale-[0.98]"
        >
          <Save className="w-6 h-6" /> Save Profile
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="glass-panel w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 drop-shadow-sm">Delete Account?</h3>
              <p className="text-slate-700 dark:text-slate-300 mb-6 font-medium">
                Are you absolutely sure you want to delete <strong>{user.firstName || user.name}</strong>'s account? All data, including documents and reminders, will be permanently erased.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 glass-panel hover:bg-white/30 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors border border-white/20 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-red-600/90 backdrop-blur-md hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-red-400/30 shadow-md active:scale-[0.98]"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ProfileView;