import React from 'react';
import { TabView } from '../types';
import { Clock, Eye, Home, Activity, HeartHandshake, Users } from 'lucide-react';

interface NavigationProps {
  currentTab: TabView;
  onTabChange: (tab: TabView) => void;
}

const Navigation: React.FC<NavigationProps> = React.memo(({ currentTab, onTabChange }) => {
  const tabs = [
    { id: TabView.HOME, label: 'Home', icon: Home },
    { id: TabView.REMINDERS, label: 'Reminders', icon: Clock },
    { id: TabView.HEALTHCARE, label: 'Health', icon: Activity },
    { id: TabView.PERSONAL_INFO, label: 'Personal', icon: Users },
    { id: TabView.VISION, label: 'Vision', icon: Eye },
    { id: TabView.RESOURCES, label: 'Help', icon: HeartHandshake },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md glass-panel rounded-[32px] border border-white/10 backdrop-blur-xl p-2 z-50 shadow-2xl">
      <div className="flex justify-between items-center w-full">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all min-w-[50px] flex-1 ${
                isActive 
                ? 'text-mist-blue bg-white/10 shadow-inner border border-white/5' 
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px] drop-shadow-sm' : 'stroke-2'}`} />
              <span className={`text-[10px] font-semibold whitespace-nowrap ${isActive ? 'text-mist-blue drop-shadow-sm' : 'text-slate-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default Navigation;