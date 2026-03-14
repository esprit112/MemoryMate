import React, { useState, useEffect } from 'react';
import { UserProfile, UserDocument, Medicine } from '../types';
import { generateSmartSummary, generateHealthTrends } from '../services/geminiService';
import { Brain, Activity, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface HealthInsightsTabProps {
  user: UserProfile;
  documents: UserDocument[];
  medicines: Medicine[];
}

const HealthInsightsTab: React.FC<HealthInsightsTabProps> = ({ user, documents, medicines }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [trends, setTrends] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const handleGenerateSummary = async () => {
    setLoadingSummary(true);
    try {
      const result = await generateSmartSummary(documents, medicines);
      setSummary(result);
    } catch (error) {
      console.error(error);
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateTrends = async () => {
    setLoadingTrends(true);
    try {
      const result = await generateHealthTrends(documents);
      setTrends(result);
    } catch (error) {
      console.error(error);
      setTrends("Failed to generate trends. Please try again.");
    } finally {
      setLoadingTrends(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart Summaries for Clinical Visits */}
      <div className="glass-panel p-6 rounded-2xl shadow-lg border border-white/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl backdrop-blur-sm border border-indigo-500/30">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Clinical Prep Summary</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Generate an SBAR summary for your next visit.</p>
          </div>
        </div>
        
        {!summary ? (
          <button 
            onClick={handleGenerateSummary}
            disabled={loadingSummary}
            className="w-full py-3 bg-indigo-600/90 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 backdrop-blur-md border border-indigo-500/30 shadow-md"
          >
            {loadingSummary ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
            {loadingSummary ? 'Analyzing Vault...' : 'Generate Smart Summary'}
          </button>
        ) : (
          <div className="glass-input p-4 rounded-xl border border-white/10">
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
            <button 
              onClick={handleGenerateSummary}
              disabled={loadingSummary}
              className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              {loadingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Regenerate Summary
            </button>
          </div>
        )}
      </div>

      {/* Proactive Health Monitoring & Trends */}
      <div className="glass-panel p-6 rounded-2xl shadow-lg border border-white/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl backdrop-blur-sm border border-teal-500/30">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Health Trends & Monitoring</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Identify patterns across your medical documents.</p>
          </div>
        </div>
        
        {!trends ? (
          <button 
            onClick={handleGenerateTrends}
            disabled={loadingTrends}
            className="w-full py-3 bg-teal-600/90 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 backdrop-blur-md border border-teal-500/30 shadow-md"
          >
            {loadingTrends ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
            {loadingTrends ? 'Analyzing Trends...' : 'Analyze Health Trends'}
          </button>
        ) : (
          <div className="glass-input p-4 rounded-xl border border-white/10">
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
              <ReactMarkdown>{trends}</ReactMarkdown>
            </div>
            <button 
              onClick={handleGenerateTrends}
              disabled={loadingTrends}
              className="mt-4 text-sm text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1"
            >
              {loadingTrends ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              Regenerate Trends
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthInsightsTab;
