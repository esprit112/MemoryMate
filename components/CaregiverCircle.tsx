import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/react';
import { Caregiver, UserProfile } from '../types';
import { UserPlus, Trash2, Bell, BellOff, Phone, User, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CaregiverCircleProps {
  user: UserProfile;
}

const CaregiverCircle: React.FC<CaregiverCircleProps> = ({ user }) => {
  const { getToken } = useAuth();
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Daughter');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const relationships = ['Daughter', 'Son', 'Spouse', 'Neighbor', 'Professional', 'Other'];

  const getApiUrl = () => {
    const stored = localStorage.getItem('MEMORYMATE_API_URL');
    return stored || '/api';
  };

  const getAuthHeaders = async () => {
    const token = await getToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const fetchCaregivers = async () => {
    try {
      setIsLoading(true);
      const config = await getAuthHeaders();
      const response = await axios.get(`${getApiUrl()}/caregivers/${user.id}`, config);
      setCaregivers(response.data);
    } catch (error) {
      console.error(error);
      showToast('Failed to load caregivers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCaregivers();
  }, [user.id]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const validatePhone = (phone: string) => {
    const regex = /^\+[1-9]\d{1,14}$/;
    return regex.test(phone);
  };

  const handleAddCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    if (!validatePhone(phoneNumber)) {
      setPhoneError('Phone number must be in international format (e.g., +447123456789)');
      return;
    }

    try {
      setIsAdding(true);
      const config = await getAuthHeaders();
      const newCaregiver = {
        id: crypto.randomUUID(),
        userId: user.id,
        name,
        phoneNumber: phoneNumber,
        relationship,
        alertsEnabled: true
      };

      const response = await axios.post(`${getApiUrl()}/caregivers`, newCaregiver, config);
      
      if (response.status === 200) {
        showToast('Caregiver added successfully', 'success');
        setName('');
        setPhoneNumber('');
        setRelationship('Daughter');
        fetchCaregivers();
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to add caregiver', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleAlerts = async (caregiver: Caregiver) => {
    try {
      const config = await getAuthHeaders();
      const updated = { ...caregiver, alertsEnabled: !caregiver.alertsEnabled };
      
      // Optimistic update
      setCaregivers(prev => prev.map(c => c.id === caregiver.id ? updated : c));
      
      await axios.put(`${getApiUrl()}/caregivers/${caregiver.id}`, updated, config);
      showToast(`Alerts ${updated.alertsEnabled ? 'enabled' : 'disabled'} for ${caregiver.name}`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to update alert settings', 'error');
      fetchCaregivers(); // Revert on failure
    }
  };

  const [caregiverToDelete, setCaregiverToDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const config = await getAuthHeaders();
      await axios.delete(`${getApiUrl()}/caregivers/${id}`, config);
      setCaregivers(prev => prev.filter(c => c.id !== id));
      showToast('Caregiver removed', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to remove caregiver', 'error');
    } finally {
      setCaregiverToDelete(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 animate-fade-in">
      <header className="mb-6 glass-panel p-4 rounded-2xl border border-white/20 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 drop-shadow-sm">
          <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Caregiver Circle
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">
          Manage trusted contacts who will receive automated SMS alerts when critical health information is detected.
        </p>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-4 right-4 z-[9999] p-4 rounded-xl shadow-lg flex items-center gap-3 text-white ${
              toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Caregiver Form */}
      <div className="glass-panel p-6 rounded-2xl border border-white/20 shadow-md mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          Add New Caregiver
        </h2>
        <form onSubmit={handleAddCaregiver} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-400/50 outline-none"
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/20 glass-input text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-400/50 outline-none"
              >
                {relationships.map(rel => (
                  <option key={rel} value={rel} className="text-slate-900">{rel}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={`w-full p-3 rounded-xl border glass-input text-slate-900 dark:text-white focus:ring-2 outline-none ${
                phoneError ? 'border-red-400 focus:ring-red-400/50' : 'border-white/20 focus:ring-indigo-400/50'
              }`}
              placeholder="+447123456789"
            />
            {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Must include country code (e.g., +44 for UK).</p>
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            {isAdding ? 'Adding...' : 'Add Caregiver'}
          </button>
        </form>
      </div>

      {/* Caregiver List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-500" />
          Active Caregivers
        </h2>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : caregivers.length === 0 ? (
          <div className="text-center p-8 glass-panel rounded-2xl border border-white/20">
            <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
            <p className="text-slate-600 dark:text-slate-400">No caregivers added yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caregivers.map(caregiver => (
              <motion.div
                key={caregiver.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-5 rounded-2xl border border-white/20 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{caregiver.name}</h3>
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
                      {caregiver.relationship}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm mb-4">
                    <Phone className="w-4 h-4" />
                    {caregiver.phoneNumber}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700/50">
                  <button
                    onClick={() => toggleAlerts(caregiver)}
                    className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      caregiver.alertsEnabled 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {caregiver.alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    {caregiver.alertsEnabled ? 'Alerts On' : 'Alerts Off'}
                  </button>
                  
                  <button
                    onClick={() => setCaregiverToDelete(caregiver.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove Caregiver"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {caregiverToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-6 bg-white/90 dark:bg-slate-900/90"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-red-500" />
                Remove Caregiver
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Are you sure you want to remove this caregiver? They will no longer receive automated alerts.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCaregiverToDelete(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(caregiverToDelete)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaregiverCircle;
