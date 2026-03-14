
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Globe, Volume2, Mic } from 'lucide-react';
import { ChatMessage, UserProfile, UserDocument, Medicine, Reminder } from '../types';
import { sendChatMessage, generateSpeech } from '../services/geminiService';
import { playAudio } from '../utils/audioUtils';
import { generateId } from '../utils/helpers';
import * as api from '../services/api';

interface ChatInterfaceProps {
  user: UserProfile;
  onReminderUpdate: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = React.memo(({ user, onReminderUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: `Hello ${user.firstName || user.name}. I am Jarvis. I have access to your profile, medicines, reminders, and document summaries. How can I help you today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const [userDocs, setUserDocs] = useState<UserDocument[]>([]);
  const [userMeds, setUserMeds] = useState<Medicine[]>([]);
  const [userReminders, setUserReminders] = useState<Reminder[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load documents, medicines, and reminders for context
  useEffect(() => {
    const loadContext = async () => {
      try {
        const [docs, meds, rems] = await Promise.all([
          api.fetchDocuments(user.id),
          api.fetchMedicines(user.id),
          api.fetchReminders(user.id)
        ]);
        setUserDocs(docs);
        setUserMeds(meds);
        setUserReminders(rems);
      } catch (e) {
        console.error("Failed to load user context for chat", e);
      }
    };
    loadContext();
  }, [user.id, messages.length]); // Reload context when messages change (e.g. after adding a reminder)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-GB';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      };
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      recognition.start();
    } else {
      alert("Voice input not supported in this browser.");
    }
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    
    // Prevent empty sends or double sends
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: trimmedInput
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Filter out the initial static greeting (id '1') to avoid Gemini API validation errors
      const history = messages
        .filter(m => m.id !== '1')
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));
      
      const response = await sendChatMessage(
        userMsg.text, 
        history as any,
        { 
          profile: user, 
          documents: userDocs, 
          medicines: userMeds, 
          reminders: userReminders,
          onReminderCreated: onReminderUpdate 
        }
      );
      
      const botMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: response.text,
        sources: response.sources,
        supportCardSuggestion: response.supportCardSuggestion,
        auditLog: response.auditLog
      };

      if (response.auditLog) {
        await api.createActivityLog(response.auditLog);
      }

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: "I'm having trouble connecting to the service right now. Please try again in a moment."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReadAloud = async (text: string, msgId: string) => {
    if (playingId) return; // Prevent multiple clicks
    setPlayingId(msgId);
    try {
      const audioData = await generateSpeech(text);
      if (audioData) {
        await playAudio(audioData);
      }
    } catch (error) {
      console.error("Audio playback error", error);
    } finally {
      setPlayingId(null);
    }
  };

  const handleAddSupportCard = async (suggestion: any, msgId: string) => {
    try {
      await api.createSupportCard({
        id: generateId(),
        userId: user.id,
        condition: suggestion.detected_condition,
        nhsUrl: suggestion.nhs_url,
        charityUrl: suggestion.charity_url,
        category: suggestion.category
      });
      
      // Update the message to remove the suggestion so it can't be added twice
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, supportCardSuggestion: undefined } : m
      ));
      
      alert(`Added ${suggestion.detected_condition} to your Help & Info section.`);
    } catch (error) {
      console.error("Failed to add support card", error);
      alert("Failed to add support card. Please try again.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-5 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600/90 backdrop-blur-md text-white rounded-br-none border border-indigo-500/30'
                  : 'glass-panel text-slate-800 dark:text-slate-100 rounded-bl-none'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 opacity-80 border-b border-white/10 pb-2">
                {msg.role === 'user' ? (
                  <>
                    <span className="text-sm font-semibold">You</span>
                    <User className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span className="text-sm font-semibold">Jarvis</span>
                  </>
                )}
              </div>
              
              <div className="text-base leading-relaxed whitespace-pre-wrap">
                {msg.text}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Globe className="w-4 h-4" /> Sources verified:
                  </p>
                  <ul className="text-sm space-y-1">
                    {msg.sources.map((source, idx) => (
                      <li key={idx} className="truncate">
                        <a href={source} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 block">
                          {new URL(source).hostname}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msg.role === 'model' && (
                <div className="mt-3 flex flex-col gap-2">
                  {msg.supportCardSuggestion && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/40 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50">
                      <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2">
                        {msg.supportCardSuggestion.message}
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAddSupportCard(msg.supportCardSuggestion, msg.id)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Yes, Add to Help
                        </button>
                        <button 
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, supportCardSuggestion: undefined } : m))}
                          className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-600 transition-colors"
                        >
                          No Thanks
                        </button>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => handleReadAloud(msg.text, msg.id)}
                    disabled={playingId !== null}
                    className={`flex items-center justify-center gap-2 font-semibold px-3 py-2 rounded-lg transition-colors ${
                      playingId === msg.id 
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 cursor-wait' 
                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                    }`}
                  >
                    {playingId === msg.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Speaking...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5" />
                        Read Aloud
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-[fadeIn_0.3s_ease-out]">
            <div className="glass-panel p-4 rounded-2xl rounded-bl-none flex items-center gap-4 shadow-md">
              <div className="relative">
                <Bot className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </div>
              <div>
                 <span className="text-slate-800 dark:text-slate-200 font-bold block">Jarvis is thinking...</span>
                 <span className="text-slate-500 dark:text-slate-400 text-sm">Consulting medical knowledge base</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white/10 dark:bg-slate-900/10 backdrop-blur-md border-t border-white/10">
        <form onSubmit={handleSend} className="flex gap-2">
          <button
            type="button"
            onClick={startListening}
            disabled={isLoading || isListening}
            className={`p-3 rounded-xl transition-colors ${
              isListening ? 'bg-red-500/80 text-white animate-pulse' : 'glass-panel text-slate-600 dark:text-slate-300 hover:bg-white/20'
            }`}
            aria-label="Voice input"
          >
            <Mic className="w-6 h-6" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Ask Jarvis..."}
            className="flex-1 text-base p-3 glass-input text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600/90 backdrop-blur-md text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-indigo-500/30"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          </button>
        </form>
      </div>
    </div>
  );
});

export default ChatInterface;
