import React, { useState, useEffect } from 'react';
import { Upload, Camera, Loader2, Volume2, Image as ImageIcon, X, Bot, Sparkles, FileText, Pill } from 'lucide-react';
import { SupportCardSuggestion } from '../types';
import * as api from '../services/api';
import { analyzeImage, generateSpeech } from '../services/geminiService';
import { playAudio } from '../utils/audioUtils';
import { compressImage, generateId } from '../utils/helpers';

interface VisionAssistantProps {
  userId: string;
}

type ScanType = 'letter' | 'bottle';

const VisionAssistant: React.FC<VisionAssistantProps> = React.memo(({ userId }) => {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [supportCardSuggestion, setSupportCardSuggestion] = useState<SupportCardSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [prompt, setPrompt] = useState("What is in this image? Explain it simply.");
  const [scanType, setScanType] = useState<ScanType>('letter');
  const [statusMessage, setStatusMessage] = useState<string>("Ready to scan");

  // Simulate real-time status messages during loading
  useEffect(() => {
    if (isLoading) {
      const statuses = [
        "Aligning " + (scanType === 'letter' ? "letter" : "bottle") + "...",
        "Enhancing image...",
        "Text detected...",
        "Analyzing medical terms...",
        "Finalizing results..."
      ];
      let i = 0;
      setStatusMessage(statuses[0]);
      const interval = setInterval(() => {
        i++;
        if (i < statuses.length) {
          setStatusMessage(statuses[i]);
        }
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setStatusMessage("Ready to scan");
    }
  }, [isLoading, scanType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
           const compressed = await compressImage(base64String, 1024, 0.8);
           const base64Data = compressed.split(',')[1];
           setImage(base64Data);
           setAnalysis(null);
        } catch (e) {
           console.error("Compression failed", e);
           alert("Failed to process image.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    
    setIsLoading(true);
    try {
      const result = await analyzeImage(image, prompt, mimeType);
      setAnalysis(result.text || "I couldn't clearly see what was in the image.");
      if (result.supportCardSuggestion) {
        setSupportCardSuggestion(result.supportCardSuggestion);
      }
    } catch (error) {
      console.error(error);
      setAnalysis("Sorry, I had trouble analyzing that image. Please try again or check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadAloud = async () => {
    if (!analysis || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioData = await generateSpeech(analysis);
      if (audioData) await playAudio(audioData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpeaking(false);
    }
  };

  const reset = () => {
    setImage(null);
    setAnalysis(null);
    setSupportCardSuggestion(null);
    setMimeType('image/jpeg');
  };

  const handleAddSupportCard = async () => {
    if (!supportCardSuggestion) return;
    try {
      await api.createSupportCard({
        id: generateId(),
        userId: userId,
        condition: supportCardSuggestion.detected_condition,
        nhsUrl: supportCardSuggestion.nhs_url,
        charityUrl: supportCardSuggestion.charity_url,
        category: supportCardSuggestion.category
      });
      alert(`Added ${supportCardSuggestion.detected_condition} to your Help & Info section.`);
      setSupportCardSuggestion(null);
    } catch (error) {
      console.error("Failed to add support card", error);
      alert("Failed to add support card. Please try again.");
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6 animate-fade-in pb-28">
      
      <div className="glass-panel p-6 rounded-[32px] text-center border border-white/10 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">Vision Assistant</h2>
        <p className="text-slate-300 font-medium">Align your document or medication in the frame to get help understanding it.</p>
      </div>

      {!image ? (
        <div className="space-y-4">
          {/* Scan Type Selector */}
          <div className="flex gap-2 p-1 glass-panel rounded-2xl border border-white/10">
            <button 
              onClick={() => { setScanType('letter'); setPrompt("Summarize this medical letter."); }}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${scanType === 'letter' ? 'bg-soft-sage text-deep-dusk shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <FileText className="w-5 h-5" /> Medical Letter
            </button>
            <button 
              onClick={() => { setScanType('bottle'); setPrompt("Identify this pill bottle and its instructions."); }}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${scanType === 'bottle' ? 'bg-mist-blue text-deep-dusk shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Pill className="w-5 h-5" /> Pill Bottle
            </button>
          </div>

          {/* Viewfinder Simulator */}
          <label className="relative flex flex-col items-center justify-center w-full h-96 border border-white/10 bg-black/40 rounded-[32px] cursor-pointer hover:bg-black/50 transition-colors group active:scale-95 overflow-hidden shadow-2xl">
            
            {/* Camera Background Simulation (Darker) */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-0"></div>

            {/* Ghost Overlay */}
            <div className={`absolute z-10 border-2 border-dashed border-white/50 transition-all duration-500 ease-in-out ${
              scanType === 'letter' 
                ? 'w-3/4 h-4/5 rounded-lg' // Tall rectangle for letter
                : 'w-1/2 h-3/4 rounded-[40px]' // Cylinder-ish for bottle
            }`}>
              {/* Soft Pulse Focus Ring */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-soft-sage rounded-full animate-soft-pulse"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-soft-sage rounded-full"></div>
            </div>

            <div className="relative z-20 flex flex-col items-center justify-center mt-auto pb-8">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-full mb-4 group-hover:bg-white/20 transition-colors shadow-inner border border-white/20">
                 <Camera className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-semibold text-white drop-shadow-sm">Tap to scan {scanType === 'letter' ? 'letter' : 'bottle'}</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative rounded-[32px] overflow-hidden shadow-2xl border border-white/20 glass-panel aspect-video md:aspect-auto">
             <img 
               src={`data:${mimeType};base64,${image}`} 
               alt="Uploaded" 
               className={`w-full h-full md:h-auto max-h-[500px] object-contain mx-auto transition-opacity duration-300 ${isLoading ? 'opacity-40' : 'opacity-100'}`}
             />
             
             {/* Scanning Animation Overlay */}
             {isLoading && (
               <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-soft-sage rounded-full animate-soft-pulse"></div>
                 <div className="bg-deep-dusk/80 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-xl border border-white/10 mt-32">
                    <Sparkles className="w-5 h-5 text-soft-sage animate-pulse" />
                    <span className="font-bold tracking-wide">{statusMessage}</span>
                 </div>
               </div>
             )}

             <button 
               onClick={reset}
               disabled={isLoading}
               className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white shadow-md hover:bg-black/70 disabled:opacity-0 transition-opacity z-20 backdrop-blur-md border border-white/20"
             >
               <X className="w-6 h-6" />
             </button>
          </div>

          {!analysis && (
            <div className="space-y-4">
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full bg-soft-sage/90 backdrop-blur-md text-deep-dusk text-xl font-bold py-4 rounded-[24px] hover:bg-soft-sage flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg border border-soft-sage/30 active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="animate-spin w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                {isLoading ? "Analysing..." : "Analyse Image"}
              </button>
            </div>
          )}
        </div>
      )}

      {analysis && (
        <div className="glass-panel p-6 rounded-[32px] shadow-xl border border-white/10 animate-slide-up">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 drop-shadow-sm">
            <Bot className="w-6 h-6 text-mist-blue" />
            Analysis Result
          </h3>
          <p className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap mb-6 font-medium">
            {analysis}
          </p>
          
          {supportCardSuggestion && (
            <div className="bg-mist-blue/10 p-5 rounded-2xl border border-mist-blue/30 mb-6">
              <p className="text-sm font-semibold text-mist-blue mb-3">
                {supportCardSuggestion.message}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleAddSupportCard}
                  className="flex-1 bg-mist-blue hover:bg-mist-blue/90 text-deep-dusk py-3 rounded-xl text-sm font-bold transition-colors"
                >
                  Yes, Add to Help
                </button>
                <button 
                  onClick={() => setSupportCardSuggestion(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-bold border border-white/10 transition-colors"
                >
                  No Thanks
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleReadAloud}
            disabled={isSpeaking}
            className="w-full glass-panel text-white font-bold py-4 rounded-[24px] hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait transition-colors border border-white/10 shadow-sm"
          >
            {isSpeaking ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> Speaking...
                </>
            ) : (
                <>
                  <Volume2 className="w-6 h-6" /> Read Aloud
                </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

export default VisionAssistant;