import React, { useState, useEffect } from 'react';
import { UserProfile, TabView, Medicine } from '../types';
import { motion } from 'motion/react';
import { Check, Pill, Stethoscope, Building2, Clock, Activity, Loader2 } from 'lucide-react';
import * as api from '../services/api';

interface HomeViewProps {
  user: UserProfile;
  onNavigate: (tab: TabView) => void;
}

const HomeView: React.FC<HomeViewProps> = React.memo(({ user, onNavigate }) => {
  const [medTaken, setMedTaken] = useState(false);
  const [nextMed, setNextMed] = useState<Medicine | null>(null);
  const [loadingMeds, setLoadingMeds] = useState(true);

  useEffect(() => {
    const fetchMeds = async () => {
      try {
        const meds = await api.getMedicines(user.id);
        if (meds && meds.length > 0) {
          setNextMed(meds[0]);
        }
      } catch (err) {
        console.error("Failed to fetch medicines", err);
      } finally {
        setLoadingMeds(false);
      }
    };
    fetchMeds();
  }, [user.id]);

  // Theme shifting based on user.id (simulating active_profile_id)
  const getThemeColor = (id: string) => {
    const charCode = id.charCodeAt(0) || 0;
    if (charCode % 2 === 0) return 'text-soft-sage bg-soft-sage/10 border-soft-sage/20';
    return 'text-mist-blue bg-mist-blue/10 border-mist-blue/20';
  };

  const themeClass = getThemeColor(user.id);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2 mt-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 drop-shadow-sm">
            Good Morning, {user.firstName || user.name}
          </h1>
          <p className="text-slate-400 font-medium mt-1 text-lg">
            Let's check your daily health plan.
          </p>
        </div>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-inner border glass-panel ${themeClass}`}>
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Primary Tile: Next Medication */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="col-span-2 glass-panel p-6 rounded-[32px] border border-white/10 relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 text-soft-sage mb-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold uppercase tracking-wider text-sm">Morning Meds</span>
              </div>
              {loadingMeds ? (
                <div className="flex items-center gap-2 text-slate-300 mt-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading medications...</span>
                </div>
              ) : nextMed ? (
                <>
                  <h2 className="text-3xl font-bold text-white">{nextMed.name} {nextMed.strength || ''}</h2>
                  <p className="text-slate-300 mt-1 text-lg">{nextMed.directions || 'Take as directed'}</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white">No medications added yet</h2>
                  <p className="text-slate-300 mt-1 text-base">Go to Healthcare to add your first medication.</p>
                </>
              )}
            </div>
            <div className={`p-4 rounded-3xl ${themeClass}`}>
              <Pill className="w-8 h-8" />
            </div>
          </div>
          
          <button 
            onClick={() => {
              if (!nextMed) {
                onNavigate(TabView.HEALTHCARE);
              } else {
                setMedTaken(!medTaken);
              }
            }}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              !nextMed
                ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-400/20'
                : medTaken 
                  ? 'bg-soft-sage/20 text-soft-sage border border-soft-sage/30' 
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            {!nextMed ? (
              'Add Medication'
            ) : medTaken ? (
              <>
                <Check className="w-6 h-6" />
                Taken at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </>
            ) : (
              'Mark as Taken'
            )}
          </button>
        </motion.div>

        {/* Secondary Tile: My Doctor */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(TabView.PERSONAL_INFO)}
          className="col-span-1 glass-panel p-6 rounded-[32px] border border-white/10 flex flex-col justify-between aspect-square cursor-pointer"
        >
          <div className="bg-mist-blue/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-mist-blue/20">
            <Stethoscope className="w-7 h-7 text-mist-blue" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">My Doctor</h3>
            <p className="text-xl font-bold text-white leading-tight">{user.doctorName || 'Not Set'}</p>
          </div>
        </motion.div>

        {/* Secondary Tile: My Pharmacy */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(TabView.PERSONAL_INFO)}
          className="col-span-1 glass-panel p-6 rounded-[32px] border border-white/10 flex flex-col justify-between aspect-square cursor-pointer"
        >
          <div className="bg-soft-sage/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-soft-sage/20">
            <Building2 className="w-7 h-7 text-soft-sage" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Pharmacy</h3>
            <p className="text-xl font-bold text-white leading-tight">{user.pharmacyName || 'Not Set'}</p>
          </div>
        </motion.div>

        {/* Additional Tile: Quick Actions */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(TabView.HEALTHCARE)}
          className="col-span-2 glass-panel p-6 rounded-[32px] border border-white/10 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/10 w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Health Overview</h3>
              <p className="text-slate-400 text-base">View all conditions & records</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
});

export default HomeView;