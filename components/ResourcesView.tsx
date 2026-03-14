import React, { useState, useEffect } from 'react';
import { ExternalLink, Phone, Heart, LifeBuoy, Trash2 } from 'lucide-react';
import HealthInfoSection from './HealthInfoSection';
import * as api from '../services/api';
import { SupportCard } from '../types';

interface ResourcesViewProps {
  userId: string;
}

const ResourcesView: React.FC<ResourcesViewProps> = React.memo(({ userId }) => {
  const [supportCards, setSupportCards] = useState<SupportCard[]>([]);

  useEffect(() => {
    const loadCards = async () => {
      try {
        const cards = await api.fetchSupportCards(userId);
        setSupportCards(cards);
      } catch (error) {
        console.error("Failed to load support cards", error);
      }
    };
    loadCards();
  }, [userId]);

  const handleDeleteCard = async (id: string) => {
    if (window.confirm("Remove this support card?")) {
      try {
        await api.deleteSupportCard(id);
        setSupportCards(prev => prev.filter(c => c.id !== id));
      } catch (error) {
        console.error("Failed to delete support card", error);
      }
    }
  };
  const resources = [
    {
      title: "Alzheimer's Society",
      desc: "Support and research for dementia.",
      url: "https://www.alzheimers.org.uk/",
      color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-100"
    },
    {
      title: "Dementia UK",
      desc: "Specialist dementia nurse support.",
      url: "https://www.dementiauk.org/",
      color: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-100"
    },
    {
      title: "NHS 111",
      desc: "Medical help and advice.",
      url: "https://111.nhs.uk/",
      color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100"
    }
  ];

  return (
    <div className="p-4 space-y-8 pb-24 max-w-3xl mx-auto">
      {/* Header Section */}
      <div className="glass-panel p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-pink-100/50 dark:bg-pink-900/50 backdrop-blur-sm rounded-xl border border-pink-200/50 dark:border-pink-800/50">
            <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Resources & Support</h2>
        </div>
        <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
          Access trusted information and support services grounded in NHS and dementia charity guidelines.
        </p>
      </div>

      {/* Health Information Section */}
      <HealthInfoSection supportCards={supportCards} />

      {/* Trusted Organizations Links */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <LifeBuoy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Trusted Support Services</h2>
        </div>
        
        <div className="grid gap-4">
          {supportCards.map((card) => (
            <div key={card.id} className="relative block p-5 rounded-2xl border-2 transition-all hover:shadow-lg glass-panel backdrop-blur-md bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-100">
              <a
                href={card.charityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-start pr-8"
              >
                <div>
                  <h3 className="text-lg font-bold mb-1">{card.condition} Support</h3>
                  <p className="text-sm font-medium opacity-90">Trusted charity organization for {card.condition}.</p>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60" />
              </a>
              <button 
                onClick={() => handleDeleteCard(card.id)}
                className="absolute top-4 right-4 p-2 text-indigo-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                title="Remove Card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {resources.map((res) => (
            <a
              key={res.title}
              href={res.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-5 rounded-2xl border-2 transition-all hover:shadow-lg active:scale-[0.98] glass-panel backdrop-blur-md ${res.color}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold mb-1">{res.title}</h3>
                  <p className="text-sm font-medium opacity-90">{res.desc}</p>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Emergency Section */}
      <div className="bg-red-600/90 backdrop-blur-md text-white p-6 rounded-3xl shadow-xl border border-red-400/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold drop-shadow-sm">Emergency?</h3>
        </div>
        <p className="text-lg font-medium mb-4 opacity-90">
          If it is a medical emergency or someone is in immediate danger, please dial:
        </p>
        <a 
          href="tel:999"
          className="block w-full bg-white/90 backdrop-blur-sm text-red-600 text-center py-4 rounded-2xl text-3xl font-black shadow-lg border border-white/50 active:scale-95 transition-transform hover:bg-white"
        >
          999
        </a>
      </div>
    </div>
  );
});

export default ResourcesView;
