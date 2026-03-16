import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useAuth
} from "@clerk/react";
import Navigation from './components/Navigation';
import HomeView from './components/HomeView';
import ReminderList from './components/ReminderList';
import HealthcareView from './components/HealthcareView';
import AddReminderForm from './components/AddReminderForm';
import ChatInterface from './components/ChatInterface';
import VisionAssistant from './components/VisionAssistant';
import ActivityFeed from './components/ActivityFeed';
import ResourcesView from './components/ResourcesView';
import UserSelection from './components/UserSelection';
import DocumentVault from './components/DocumentVault';
import ProfileView from './components/ProfileView';
import PersonalInfoView from './components/PersonalInfoView';
import SettingsModal from './components/SettingsModal';
import CaregiverCircle from './components/CaregiverCircle';
import Header from './components/Header';
import { Reminder, TabView, UserProfile, UserDocument } from './types';
import { Plus, LogOut, UserCog, Sun, Moon, Settings, MessageCircle, X } from 'lucide-react';
import * as api from './services/api';
import { generateSpeech, analyzeDocument } from './services/geminiService';
import { generateId } from './utils/helpers';
import { playAudio } from './utils/audioUtils';
import { motion, AnimatePresence } from 'motion/react';
import { SpeedInsights } from "@vercel/speed-insights/react";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>(TabView.HOME);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [handshakeError, setHandshakeError] = useState<{message: string, technical: string} | null>(null);
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();

  // Set the auth token getter for API calls
  useEffect(() => {
    api.setGetToken(getToken);
  }, [getToken]);

  // Force login for new sessions
  useEffect(() => {
    if (isAuthLoaded) {
      if (!sessionStorage.getItem('app_session_active')) {
        if (isSignedIn) {
          signOut();
        }
        sessionStorage.setItem('app_session_active', 'true');
      }
    }
  }, [isAuthLoaded, isSignedIn, signOut]);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply Dark Mode Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  // Track reminders we've already alerted for in this session to prevent spamming
  const notifiedReminders = useRef<Set<string>>(new Set());

  // Cleanup notified reminders periodically (e.g., every 24 hours) to prevent memory growth
  useEffect(() => {
    const cleanup = setInterval(() => {
      notifiedReminders.current.clear();
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(cleanup);
  }, []);

  const loadReminders = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await api.fetchReminders(currentUser.id);
      setReminders(data);
    } catch (error) {
      console.error("Failed to load reminders:", error);
    }
  }, [currentUser]);

  // Load reminders when user changes
  useEffect(() => {
    if (!currentUser) return;
    loadReminders();
    setActiveTab(TabView.HOME); // Reset to home on user change
    notifiedReminders.current.clear();
    
    // Request Notification Permission on login
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, [currentUser, loadReminders]);

  // Background Document Analysis
  useEffect(() => {
    if (!currentUser) return;

    const checkPendingDocs = async () => {
      try {
        const docs = await api.fetchDocuments(currentUser.id);
        const pending = docs.filter(d => d.status === 'pending_analysis');

        for (const doc of pending) {
          try {
            const analysis = await analyzeDocument(currentUser.id, doc.data, doc.mimeType);
            if (analysis) {
              const updatedDoc: UserDocument = {
                ...doc,
                ...analysis,
                status: 'active'
              };
              await api.updateDocument(updatedDoc);
              
              // If appointment, notify
              if (analysis.appointmentDate && analysis.appointmentTime) {
                new Notification("New Appointment Found", {
                  body: `Jarvis found an appointment on ${analysis.appointmentDate} for ${analysis.organization || doc.name}.`
                });
              }
            }
          } catch (e) {
            console.error("Background analysis failed for doc", doc.id, e);
          }
        }
      } catch (e) {
        console.error("Failed to check pending docs", e);
      }
    };

    const interval = setInterval(checkPendingDocs, 60000); // Check every minute
    checkPendingDocs();
    return () => clearInterval(interval);
  }, [currentUser]);

  // Real-time Reminder Checker
  useEffect(() => {
    if (!currentUser || reminders.length === 0) return;

    const checkReminders = async () => {
      const now = new Date();
      const currentLocalDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Filter reminders for today that are not completed
      const todayReminders = reminders.filter(r => !r.completed && r.date === currentLocalDate);

      for (const reminder of todayReminders) {
        const [rHours, rMinutes] = reminder.time.split(':').map(Number);
        
        // Check if time matches (within the current minute)
        if (rHours === currentHours && rMinutes === currentMinutes) {
          if (!notifiedReminders.current.has(reminder.id)) {
            // Mark as notified
            notifiedReminders.current.add(reminder.id);
            
            // 1. Trigger Browser Notification
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`MemoryMate: ${reminder.title}`, {
                  body: `It's ${reminder.time}. ${reminder.notes || ''}`,
                });
              } catch (e) {
                console.error("Notification error:", e);
              }
            }

            // 2. Play Audio Alert (TTS)
            try {
              const speechText = `Excuse me ${currentUser.firstName || currentUser.name}. You have a reminder: ${reminder.title}.`;
              const audioData = await generateSpeech(speechText);
              if (audioData) await playAudio(audioData);
            } catch (err) {
              console.error("Failed to play reminder audio", err);
            }
          }
        }
      }
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkReminders, 30000);
    // Initial check
    checkReminders();
    
    return () => clearInterval(intervalId);
  }, [reminders, currentUser]);

  const addReminder = useCallback(async (reminder: Omit<Reminder, 'userId'>) => {
    if (!currentUser) return;
    try {
      if (editingReminder) {
        // Update existing
        const updatedReminder: Reminder = { ...reminder, userId: currentUser.id };
        await api.updateReminder(updatedReminder);
        
        await api.createActivityLog({
          id: generateId(),
          userId: currentUser.id,
          action_type: 'EDIT',
          subject_profile: currentUser.name,
          performed_by: currentUser.name,
          description: `Edited reminder: ${updatedReminder.title}`,
          timestamp: new Date().toISOString(),
          reference_id: updatedReminder.id
        });

        setEditingReminder(null);
      } else {
        // Create new
        const newReminder: Reminder = { ...reminder, userId: currentUser.id };
        await api.createReminder(newReminder);
        
        await api.createActivityLog({
          id: generateId(),
          userId: currentUser.id,
          action_type: 'ADD',
          subject_profile: currentUser.name,
          performed_by: currentUser.name,
          description: `Added new reminder: ${newReminder.title}`,
          timestamp: new Date().toISOString(),
          reference_id: newReminder.id
        });
      }
      await loadReminders();
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to save reminder:", error);
    }
  }, [currentUser, loadReminders, editingReminder]);

  const handleEditReminder = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowAddForm(true);
  }, []);

  const toggleReminder = useCallback(async (id: string) => {
    setReminders(prev => {
      const reminder = prev.find(r => r.id === id);
      if (!reminder) return prev;
      return prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    });

    try {
      const reminder = reminders.find(r => r.id === id);
      if (reminder) {
        await api.toggleReminderComplete(id, !reminder.completed);
        
        await api.createActivityLog({
          id: generateId(),
          userId: currentUser!.id,
          action_type: 'EDIT',
          subject_profile: currentUser!.name,
          performed_by: currentUser!.name,
          description: `Marked reminder as ${!reminder.completed ? 'completed' : 'incomplete'}: ${reminder.title}`,
          timestamp: new Date().toISOString(),
          reference_id: reminder.id
        });
      }
    } catch (error) {
      console.error("Failed to toggle reminder:", error);
      loadReminders(); // Revert on error
    }
  }, [reminders, loadReminders]);

  const deleteReminder = useCallback(async (id: string) => {
    if (window.confirm("Are you sure you want to delete this reminder?")) {
      try {
        const reminderToDelete = reminders.find(r => r.id === id);
        await api.deleteReminder(id);
        
        if (reminderToDelete && currentUser) {
          await api.createActivityLog({
            id: generateId(),
            userId: currentUser.id,
            action_type: 'DELETE',
            subject_profile: currentUser.name,
            performed_by: currentUser.name,
            description: `Deleted reminder: ${reminderToDelete.title}`,
            timestamp: new Date().toISOString(),
            reference_id: id,
            deleted_data: JSON.stringify(reminderToDelete)
          });
        }

        setReminders(prev => prev.filter(r => r.id !== id));
      } catch (error) {
        console.error("Failed to delete reminder:", error);
      }
    }
  }, [reminders, currentUser]);

  const handleUpdateProfile = useCallback(async (updatedUser: UserProfile) => {
    try {
      await api.updateUser(updatedUser);
      setCurrentUser(updatedUser);
      setShowProfile(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to save profile changes.");
    }
  }, []);

  if (!isClerkLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const renderContent = (user: UserProfile) => {
    switch (activeTab) {
      case TabView.HOME:
        return (
          <HomeView 
            user={user} 
            onNavigate={setActiveTab} 
          />
        );
      case TabView.HEALTHCARE:
        return (
          <HealthcareView 
            user={user}
            reminders={reminders}
            toggleReminder={toggleReminder}
            deleteReminder={deleteReminder}
            onEditReminder={handleEditReminder}
          />
        );
      case TabView.REMINDERS:
        return (
          <div className="p-4 max-w-3xl mx-auto animate-fade-in">
             <div className="flex justify-between items-center mb-6 mt-2 glass-panel p-4 rounded-2xl border border-white/20 shadow-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 drop-shadow-sm">
                      Reminders
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-lg">
                      {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-indigo-600/90 backdrop-blur-md dark:bg-indigo-500/90 text-white p-3 rounded-full shadow-lg border border-indigo-400/30 hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-transform active:scale-95"
                  aria-label="Add new reminder"
                >
                  <Plus className="w-8 h-8" />
                </button>
             </div>
             <ReminderList 
               reminders={reminders}
               toggleReminder={toggleReminder}
               deleteReminder={deleteReminder}
               onEdit={handleEditReminder}
             />
          </div>
        );
      case TabView.PERSONAL_INFO:
        return (
          <PersonalInfoView 
            user={user} 
            onRefreshReminders={loadReminders} 
          />
        );
      case TabView.DOCUMENTS:
        return (
           <div className="max-w-3xl mx-auto animate-fade-in">
             <header className="p-4 glass-panel backdrop-blur-md border-b border-white/20 shadow-sm z-10 sticky top-16">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 drop-shadow-sm">Documents</h1>
            </header>
            <DocumentVault user={user} />
           </div>
        );
      case TabView.VISION:
         return (
          <div className="max-w-3xl mx-auto animate-fade-in">
             <header className="p-4 glass-panel backdrop-blur-md border-b border-white/20 shadow-sm z-10 sticky top-16">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 drop-shadow-sm">Vision Helper</h1>
            </header>
            <VisionAssistant userId={user.id} />
          </div>
         );
      case TabView.ACTIVITY_FEED:
        return (
          <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <ActivityFeed user={user} onNavigate={setActiveTab} />
          </div>
        );
      case TabView.RESOURCES:
        return (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <header className="p-4 glass-panel backdrop-blur-md border-b border-white/20 shadow-sm z-10 sticky top-16">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 drop-shadow-sm">Help & Info</h1>
            </header>
            <ResourcesView userId={user.id} />
          </div>
        );
      case TabView.CAREGIVERS:
        return (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <CaregiverCircle user={user} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-300">
      {handshakeError && (
        <div 
          className="fixed top-0 left-0 right-0 bg-red-500 text-white p-4 text-center shadow-lg flex justify-between items-center" 
          style={{ zIndex: 9999 }}
        >
          <div className="flex-1">
            <p className="font-bold">Login Error: {handshakeError.message}. Please try again.</p>
            {handshakeError.technical && <p className="text-sm opacity-80">Technical: {handshakeError.technical}</p>}
          </div>
          <button onClick={() => setHandshakeError(null)} className="p-2 hover:bg-red-600 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <Show when="signed-out">
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl shadow-2xl border border-white/20 text-center relative z-10">
            <div className="w-20 h-20 bg-indigo-600/90 backdrop-blur-md border border-indigo-400/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
              <Sun className="w-12 h-12 text-white drop-shadow-sm" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 drop-shadow-sm">MemoryMate</h1>
            <p className="text-slate-700 dark:text-slate-300 mb-8 text-lg font-medium drop-shadow-sm">Your personal assistant for a clearer mind and organized life.</p>
            
            <div className="flex flex-col gap-4">
              <SignInButton mode="modal">
                <button className="w-full py-3 px-6 bg-indigo-600/90 backdrop-blur-md hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 border border-indigo-400/30">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="w-full py-3 px-6 glass-panel border border-indigo-400/50 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl transition-all hover:bg-white/30 dark:hover:bg-slate-700/50 active:scale-95 shadow-sm">
                  Create Account
                </button>
              </SignUpButton>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10 dark:border-slate-700/50">
              <p className="text-sm text-slate-600 dark:text-slate-400 italic font-medium">"Helping you remember the things that matter most."</p>
            </div>
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        {!currentUser ? (
          <UserSelection 
            onSelect={setCurrentUser} 
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            onHandshakeError={(err) => {
              signOut();
              setHandshakeError({ message: err.message, technical: err.technical });
            }}
          />
        ) : (
          <div className="pb-20 pt-16">
            <Header 
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
              onShowSettings={() => setShowSettings(true)}
              onShowProfile={() => setShowProfile(true)}
              onSwitchUser={() => setCurrentUser(null)}
            />

            <motion.div layout className="relative z-10">
              {renderContent(currentUser!)}
            </motion.div>
            
            <Navigation currentTab={activeTab} onTabChange={setActiveTab} />
            
            {/* Floating AI Orb */}
            <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end">
              <AnimatePresence>
                {isChatOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    className="mb-4 w-[90vw] max-w-md h-[60vh] max-h-[600px] glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/20"
                  >
                    <header className="p-4 bg-indigo-600/90 backdrop-blur-md text-white flex justify-between items-center">
                      <h2 className="font-bold flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Jarvis AI
                      </h2>
                      <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </header>
                    <div className="flex-1 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                      <ChatInterface user={currentUser} onReminderUpdate={loadReminders} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow border border-white/20 backdrop-blur-md"
              >
                {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
              </motion.button>
            </div>
            
            {showAddForm && (
              <AddReminderForm 
                user={currentUser}
                onAdd={addReminder} 
                onCancel={() => {
                  setShowAddForm(false);
                  setEditingReminder(null);
                }}
                initialData={editingReminder || undefined}
                isEditing={!!editingReminder}
              />
            )}

            {showProfile && (
              <ProfileView 
                user={currentUser} 
                onSave={handleUpdateProfile} 
                onClose={() => setShowProfile(false)} 
                onDelete={(userId) => {
                  setCurrentUser(null);
                  setShowProfile(false);
                }}
                onNavigate={(tab) => {
                  setActiveTab(tab as TabView);
                  setShowProfile(false);
                }}
              />
            )}

            {showSettings && (
              <SettingsModal onClose={() => setShowSettings(false)} />
            )}
          </div>
        )}
      </Show>
      <SpeedInsights />
    </div>
  );
};

export default App;