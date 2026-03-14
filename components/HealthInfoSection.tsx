
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, ShieldCheck, Users, Scale, Info, HeartPulse } from 'lucide-react';
import { SupportCard } from '../types';

interface InfoCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  items: {
    subtitle: string;
    content: string;
    source: string;
    url?: string;
  }[];
}

interface HealthInfoSectionProps {
  supportCards?: SupportCard[];
}

const HealthInfoSection: React.FC<HealthInfoSectionProps> = ({ supportCards = [] }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const categories: InfoCategory[] = [
    {
      id: 'understanding',
      title: 'Understanding Dementia',
      icon: BookOpen,
      items: [
        {
          subtitle: 'What is Dementia?',
          content: 'Dementia is not a single disease; it is an umbrella term for a range of progressive neurological conditions. It affects memory, thinking, and social abilities severely enough to interfere with daily life.',
          source: 'NHS England'
        },
        {
          subtitle: 'Common Symptoms',
          content: 'Symptoms include memory loss, difficulty concentrating, finding it hard to carry out familiar daily tasks, struggling to follow a conversation, and changes in mood.',
          source: 'Alzheimer\'s Society'
        },
        {
          subtitle: 'Types of Dementia',
          content: 'Alzheimer\'s disease is the most common type. Other types include vascular dementia, dementia with Lewy bodies, and frontotemporal dementia.',
          source: 'NHS England'
        }
      ]
    },
    {
      id: 'daily-living',
      title: 'Daily Living & Safety',
      icon: ShieldCheck,
      items: [
        {
          subtitle: 'Staying Active',
          content: 'Regular physical activity and social stimulation can help slow the progression of symptoms and improve mood and sleep quality.',
          source: 'NHS England'
        },
        {
          subtitle: 'Home Safety',
          content: 'Keep the home well-lit, remove trip hazards like loose rugs, and consider using simple labels on cupboards or doors to help with orientation.',
          source: 'Alzheimer\'s Society'
        },
        {
          subtitle: 'Eating Well',
          content: 'A balanced diet is crucial. If appetite is low, try smaller, more frequent meals. Ensure adequate hydration throughout the day.',
          source: 'Dementia UK'
        }
      ]
    },
    {
      id: 'caregivers',
      title: 'Caregiver Support',
      icon: Users,
      items: [
        {
          subtitle: 'Look After Yourself',
          content: 'Caring for someone with dementia can be physically and emotionally demanding. It is essential to take regular breaks and seek support for your own mental health.',
          source: 'Dementia UK'
        },
        {
          subtitle: 'Respite Care',
          content: 'Respite care allows you to take a break while the person you care for is looked after by someone else for a short period.',
          source: 'NHS England'
        },
        {
          subtitle: 'Connecting with Others',
          content: 'Joining a support group can help you share experiences and feel less alone. Many charities offer local and online groups.',
          source: 'Alzheimer\'s Society'
        }
      ]
    },
    {
      id: 'legal',
      title: 'Legal & Financial',
      icon: Scale,
      items: [
        {
          subtitle: 'Power of Attorney',
          content: 'A Lasting Power of Attorney (LPA) is a legal document that lets you appoint people to make decisions on your behalf if you lose mental capacity.',
          source: 'Gov.uk / Age UK'
        },
        {
          subtitle: 'Benefits & Funding',
          content: 'You may be eligible for benefits such as Attendance Allowance or Carer\'s Allowance. Your local council can also provide a care needs assessment.',
          source: 'NHS England'
        }
      ]
    }
  ];

  if (supportCards.length > 0) {
    categories.unshift({
      id: 'my-conditions',
      title: 'My Conditions',
      icon: HeartPulse,
      items: supportCards.map(card => ({
        subtitle: card.condition,
        content: `Trusted information and support for ${card.condition}.`,
        source: 'NHS & Charity Partners',
        url: card.nhsUrl
      }))
    });
  }

  const toggleCategory = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Trusted Health Information</h2>
      </div>

      <div className="space-y-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;

          return (
            <div 
              key={category.id}
              className="glass-panel rounded-2xl border border-white/20 overflow-hidden shadow-sm transition-all"
            >
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/10 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100/50 dark:bg-indigo-900/50 backdrop-blur-sm rounded-xl border border-indigo-200/50 dark:border-indigo-800/50">
                    <Icon className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">{category.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="p-4 pt-0 space-y-4 animate-fade-in">
                  <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mb-4" />
                  {category.items.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.subtitle}</h4>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {item.content}
                      </p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline block mt-1">
                          Read more on NHS
                        </a>
                      )}
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-1">
                        <span>Source:</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{item.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 glass-panel rounded-2xl border border-indigo-200/30 dark:border-indigo-800/30 mt-6 shadow-sm">
        <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed italic font-medium">
          Disclaimer: This information is for educational purposes and is grounded in guidelines from the NHS and leading dementia charities. Always consult with a qualified healthcare professional for medical advice.
        </p>
      </div>
    </div>
  );
};

export default HealthInfoSection;
