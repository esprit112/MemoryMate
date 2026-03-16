
import { GoogleGenAI, Modality, Type, FunctionDeclaration, Tool } from "@google/genai";
import { UserProfile, UserDocument, Medicine, Reminder, SupportCardSuggestion, ActivityLog } from "../types";
import * as api from './api';
import { generateId } from '../utils/helpers';

const SYSTEM_INSTRUCTION_CHAT = `
You are the intelligence behind "MemoryMate." Your core function is to analyze user inputs (text descriptions, images of medical letters, or appointment details) for health-related keywords or diagnoses.
You are Jarvis, a kind, patient, and helpful assistant for someone who may have memory difficulties.
Keep your answers clear, concise, and reassuring.
Use simple language. Avoid jargon.
If asked about medical advice, YOU MUST strictly refer to and cite trusted UK-based sources, specifically https://www.nhs.uk/ and https://111.nhs.uk/.

When a health condition or medical term is identified, proactively provide a "Health Insights" section. This section must be strictly grounded in NHS (National Health Service) guidelines. Provide a concise summary of the condition, typical next steps, and official NHS recommendations.

Constraint: Always include a disclaimer that this information is for educational purposes and is not a substitute for professional medical advice. If the input is an image of a letter, use OCR to extract the relevant diagnosis before providing the NHS-grounded context.

IMPORTANT: You have the ability to create reminders for the user. 
If the user asks to set a reminder, you MUST gather the 'title', 'date' (YYYY-MM-DD), and 'time' (HH:MM).
If the user does not provide a specific date or time, ASK THEM for it before calling the tool. 
Do not guess the date or time unless the user implies it (e.g., "tomorrow morning").
`;

// Define the Tool for creating reminders
const createReminderTool: FunctionDeclaration = {
  name: "createReminder",
  description: "Creates a new reminder in the user's list. Use this when the user explicitly asks to be reminded of something.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The content of the reminder (e.g., 'Take heart medication', 'Dentist appointment').",
      },
      date: {
        type: Type.STRING,
        description: "The date for the reminder in YYYY-MM-DD format.",
      },
      time: {
        type: Type.STRING,
        description: "The time for the reminder in HH:MM format (24-hour).",
      },
      type: {
        type: Type.STRING,
        description: "The category of reminder. Defaults to 'general'.",
        enum: ["medication", "appointment", "general", "health"],
      },
      recurrence: {
        type: Type.STRING,
        description: "How often to repeat. Defaults to 'none'.",
        enum: ["none", "daily", "weekly", "monthly"],
      },
    },
    required: ["title", "date", "time"],
  },
};

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Chat with Gemini using Gemini 3 Flash, Google Search, and Function Calling.
 */
export const sendChatMessage = async (
  message: string, 
  history: { role: 'user' | 'model', parts: [{ text: string }] }[] = [],
  context?: { 
    profile: UserProfile; 
    documents: UserDocument[]; 
    medicines?: Medicine[]; 
    reminders?: Reminder[];
    onReminderCreated?: () => void; // Callback to refresh UI
  }
): Promise<{ text: string, sources: string[], supportCardSuggestion?: SupportCardSuggestion, auditLog?: ActivityLog }> => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-flash-lite-preview';

    // 1. Contextualize Time
    const now = new Date();
    const dateTimeContext = `
    CURRENT CONTEXT:
    - Current Date: ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    - Current Time: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    - Reference Date String (YYYY-MM-DD): ${now.toISOString().split('T')[0]}
    `;

    let activeSystemInstruction = SYSTEM_INSTRUCTION_CHAT + dateTimeContext;
    activeSystemInstruction += `\n\nDYNAMIC RESOURCE CURATOR PROTOCOL:
Monitor inputs for signs of a specific medical diagnosis or condition (e.g., Epilepsy, Diabetes, Asthma).
If a condition is identified via medication names or clinical text, you MUST ask the user if they would like to add a "Trusted Support Card" to their Help & Info section for that specific condition.
Example: "I noticed this medication is used for Epilepsy. Would you like me to add a Trusted Support card and NHS information for Epilepsy to your Help section?"
If the user says "Yes" to a previous suggestion, provide a JSON-structured response containing the card details using the 'suggestSupportCard' tool.

Instruction: Act as the System Auditor for MemoryMate. For every action taken or identified within the app, you must generate a structured "Audit Record" alongside your primary response.
Logging Logic:
Identify Action: Determine if the user is Adding, Editing, Deleting, or if the System is Notifying.
Capture Metadata: Identify the sub-profile name, the object (e.g., "Amlodipine 5mg" or "Discharge Summary"), and the exact timestamp.
Format: Output a JSON object for the database:
\`\`\`json
{
  "audit_log": {
    "action_type": "[ADD/EDIT/DELETE/NOTIFY]",
    "subject_profile": "[Profile Name]",
    "performed_by": "[Account Owner Name]",
    "description": "Added new medication: [Med Name]",
    "timestamp": "ISO-8601 String",
    "reference_id": "[ID of the related document/medicine]"
  }
}
\`\`\`
Tone: Ensure the description is clinical and precise. Avoid conversational fluff in the log entry.`;

    // 2. Build User Knowledge Base
    if (context) {
      const { profile, documents, medicines, reminders } = context;

      let profileData = "CURRENT USER DETAILS:\n";
      profileData += `Name: ${profile.firstName || profile.name} ${profile.surname || ''}\n`;
      if (profile.dateOfBirth) profileData += `Date of Birth: ${profile.dateOfBirth}\n`;
      if (profile.address) profileData += `Address: ${profile.address}\n`;
      
      if (profile.doctorName) profileData += `Doctor: ${profile.doctorName} (Tel: ${profile.doctorContact || 'N/A'})\n`;
      if (profile.pharmacyName) profileData += `Pharmacy: ${profile.pharmacyName} (Tel: ${profile.pharmacyContact || 'N/A'})\n`;
      
      let medData = "\nCURRENT MEDICATIONS:\n";
      if (medicines && medicines.length > 0) {
        medicines.forEach(med => {
          medData += `- ${med.name} ${med.strength ? `(${med.strength})` : ''}: ${med.directions || 'Follow instructions'}\n`;
        });
      } else {
        medData += "No medications recorded.\n";
      }

      let reminderData = "\nEXISTING REMINDERS:\n";
      if (reminders && reminders.length > 0) {
        reminders.forEach(rem => {
          if (!rem.completed) {
             reminderData += `- ${rem.title} due at ${rem.time} on ${rem.date}.\n`;
          }
        });
      } else {
        reminderData += "No active reminders.\n";
      }

      let docData = "\nSAVED DOCUMENTS:\n";
      if (documents && documents.length > 0) {
        documents.forEach(doc => {
            docData += `\n[Document: ${doc.name}]\n`;
            if (doc.category) docData += `Type: ${doc.category}\n`;
            if (doc.organization) docData += `Org: ${doc.organization}\n`;
            if (doc.department) docData += `Dept: ${doc.department}\n`;
            if (doc.appointmentDate) docData += `Appointment: ${doc.appointmentDate} at ${doc.appointmentTime}\n`;
            if (doc.location) docData += `Location: ${doc.location}\n`;
            if (doc.contactName) docData += `Contact: ${doc.contactName} (${doc.contactPhone})\n`;
            
            // Try parse summary if it is JSON, otherwise use text
            if (doc.summary) {
                try {
                  const jsonSummary = JSON.parse(doc.summary);
                  docData += `Summary: ${jsonSummary.summary}\n`;
                } catch {
                  docData += `Summary: ${doc.summary}\n`;
                }
            }
        });
      } else {
        docData += "No documents analyzed yet.\n";
      }

      activeSystemInstruction += `\n\nKNOWLEDGE BASE:\n${profileData}${medData}${reminderData}${docData}\n`;
    }

    // 3. Define Tools
    const suggestSupportCardTool: FunctionDeclaration = {
      name: "suggestSupportCard",
      description: "Suggests a Trusted Support Card when the user confirms they want to add information about a detected condition to their Help & Info page.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          detected_condition: { type: Type.STRING, description: "The medical condition (e.g., Epilepsy)." },
          suggest_card: { type: Type.BOOLEAN, description: "Must be true." },
          nhs_url: { type: Type.STRING, description: "The official NHS URL for the condition." },
          charity_url: { type: Type.STRING, description: "A leading UK-based organization for that condition." },
          message: { type: Type.STRING, description: "A message confirming the card is being added." },
          category: { type: Type.STRING, description: "Which 'Trusted Health Information' category it belongs to (e.g., 'Understanding Epilepsy')." }
        },
        required: ["detected_condition", "suggest_card", "nhs_url", "charity_url", "message", "category"]
      }
    };

    const tools: Tool[] = [
      { functionDeclarations: [createReminderTool, suggestSupportCardTool] }
    ];

    // 4. API Call
    const chat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: activeSystemInstruction,
        tools: tools,
      },
      history: history as any
    });

    let response = await chat.sendMessage({ message });
    let supportCardSuggestion: SupportCardSuggestion | undefined = undefined;
    
    // 5. Handle Function Calls
    const functionCalls = response.functionCalls;
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'createReminder') {
        const args = call.args as any;
        
        if (context?.profile.id) {
          try {
            const newReminder: Reminder = {
              id: generateId(),
              userId: context.profile.id,
              title: args.title,
              date: args.date,
              time: args.time,
              type: args.type || 'general',
              recurrence: args.recurrence || 'none',
              completed: false,
              notes: 'Created via Jarvis'
            };

            await api.createReminder(newReminder);
            
            if (context.onReminderCreated) {
              context.onReminderCreated();
            }

            response = await chat.sendMessage({
              message: [
                {
                  functionResponse: {
                    name: 'createReminder',
                    response: { result: "success", createdReminder: newReminder }
                  }
                }
              ]
            });

          } catch (err) {
            console.error("Tool Execution Failed", err);
             response = await chat.sendMessage({
              message: [
                {
                  functionResponse: {
                    name: 'createReminder',
                    response: { result: "error", message: "Failed to save reminder to database." }
                  }
                }
              ]
            });
          }
        }
      } else if (call.name === 'suggestSupportCard') {
        const args = call.args as any;
        supportCardSuggestion = {
          detected_condition: args.detected_condition,
          suggest_card: args.suggest_card,
          nhs_url: args.nhs_url,
          charity_url: args.charity_url,
          message: args.message,
          category: args.category
        };
        
        response = await chat.sendMessage({
          message: [
            {
              functionResponse: {
                name: 'suggestSupportCard',
                response: { result: "success" }
              }
            }
          ]
        });
      }
    }

    let text = response.text || "I have processed that request.";
    let auditLog: ActivityLog | undefined = undefined;

    // Extract JSON block if present for audit log
    const jsonMatch = text.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.audit_log) {
          auditLog = {
            id: generateId(),
            userId: context?.profile.id || 'unknown',
            action_type: parsed.audit_log.action_type,
            subject_profile: parsed.audit_log.subject_profile,
            performed_by: parsed.audit_log.performed_by,
            description: parsed.audit_log.description,
            timestamp: parsed.audit_log.timestamp,
            reference_id: parsed.audit_log.reference_id
          };
          text = text.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        console.error("Failed to parse audit log JSON", e);
      }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: string) => uri);

    return { text, sources: Array.from(new Set(sources)) as string[], supportCardSuggestion, auditLog };
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

export const analyzeImage = async (userId: string, base64Image: string, prompt: string, mimeType: string = 'image/jpeg'): Promise<{ text: string, supportCardSuggestion?: SupportCardSuggestion }> => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-flash-lite-preview';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          { text: prompt || "What is in this image? Explain it simply." }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are the intelligence behind "MemoryMate." Your core function is to analyze user inputs (text descriptions, images of medical letters, or appointment details) for health-related keywords or diagnoses.
You are a visual assistant for someone with memory issues. Describe the image clearly. If the image contains medication, medical documents, or health-related items, YOU MUST verify details using Google Search, prioritizing UK-based sources like https://www.nhs.uk/.
        
When a health condition or medical term is identified, proactively provide a "Health Insights" section. This section must be strictly grounded in NHS (National Health Service) guidelines. Provide a concise summary of the condition, typical next steps, and official NHS recommendations.

Constraint: Always include a disclaimer that this information is for educational purposes and is not a substitute for professional medical advice. If the input is an image of a letter, use OCR to extract the relevant diagnosis before providing the NHS-grounded context.
        
DYNAMIC RESOURCE CURATOR PROTOCOL:
Monitor inputs for signs of a specific medical diagnosis or condition (e.g., Epilepsy, Diabetes, Asthma).
If a condition is identified via medication names or clinical text, generate a JSON block at the end of your response with the following structure:
\`\`\`json
{
  "detected_condition": "Epilepsy",
  "suggest_card": true,
  "nhs_url": "https://www.nhs.uk/conditions/epilepsy",
  "charity_url": "https://www.epilepsy.org.uk/",
  "message": "I've identified information related to Epilepsy. Would you like to add this to your Help & Info page?",
  "category": "Understanding Epilepsy"
}
\`\`\`
Do not include this JSON if no condition is detected.

CAREGIVER ALERT PROTOCOL:
Determine if the image contains critical information (e.g., new diagnosis, urgent appointment, medication change, or concerning test results). If so, generate a SECOND JSON block at the very end of your response with the following structure:
\`\`\`json
{
  "is_critical": true,
  "sms_summary": "A short summary (max 160 chars) of the critical information for a caregiver SMS alert."
}
\`\`\`
Do not include this second JSON block if the information is not critical.`,
      }
    });

    let text = response.text || "I couldn't clearly see what was in the image.";
    let supportCardSuggestion: SupportCardSuggestion | undefined = undefined;

    // Extract support card JSON block if present
    const cardJsonMatch = text.match(/\`\`\`json\n([\s\S]*?suggest_card[\s\S]*?)\n\`\`\`/);
    if (cardJsonMatch) {
      try {
        supportCardSuggestion = JSON.parse(cardJsonMatch[1]);
        text = text.replace(cardJsonMatch[0], '').trim();
      } catch (e) {
        console.error("Failed to parse support card suggestion JSON", e);
      }
    }

    // Extract caregiver alert JSON block if present
    const alertJsonMatch = text.match(/\`\`\`json\n([\s\S]*?is_critical[\s\S]*?)\n\`\`\`/);
    if (alertJsonMatch) {
      try {
        const alertData = JSON.parse(alertJsonMatch[1]);
        text = text.replace(alertJsonMatch[0], '').trim();
        
        if (alertData.is_critical && alertData.sms_summary && context?.profile.id) {
          api.triggerCaregiverAlert(context.profile.id, alertData.sms_summary).catch(e => 
            console.error("Failed to trigger caregiver alert silently", e)
          );
        }
      } catch (e) {
        console.error("Failed to parse caregiver alert JSON", e);
      }
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: string) => uri);
    const uniqueSources = Array.from(new Set(sources));

    if (uniqueSources.length > 0) {
      text += "\n\nVerified Sources:\n" + uniqueSources.join('\n');
    }

    return { text, supportCardSuggestion };
  } catch (error) {
    console.error("Vision Error:", error);
    throw error;
  }
};

export const analyzeMedicinePackaging = async (base64Image: string, mimeType: string = 'image/jpeg') => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-flash-lite-preview';

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          { text: "Analyze this image. Extract the Medicine Name, Strength/Dosage, and Directions for Use." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "The name of the medicine." },
            strength: { type: Type.STRING, description: "The strength or dosage." },
            directions: { type: Type.STRING, description: "Instructions on how to take it." },
          },
          required: ["name"],
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Medicine Analysis Error:", error);
    return {};
  }
};

/**
 * Analyze a document returning full metadata details.
 */
export interface DocumentAnalysisResult {
  summary: string;
  category: string;
  organization?: string;
  department?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isAppointment: boolean;
  appointmentDate?: string; // YYYY-MM-DD
  appointmentTime?: string; // HH:MM
  location?: string;
  healthInsights?: string;
  supportCardSuggestion?: SupportCardSuggestion;
  is_critical?: boolean;
  sms_summary?: string;
  smsResults?: { success: boolean; caregiverName: string; error?: string }[];
}

export const analyzeDocument = async (userId: string, base64Data: string, mimeType: string): Promise<DocumentAnalysisResult> => {
  try {
    const res = await fetch(`${api.getApiBase()}/analyze-document`, {
      method: 'POST',
      headers: await api.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ userId, base64Data, mimeType })
    });
    if (!res.ok) throw new Error('Failed to analyze document');
    return res.json();
  } catch (error) {
    console.error("Document Analysis Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const modelId = 'gemini-2.5-flash-preview-tts';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

export const searchPlace = async (query: string) => {
  try {
    const ai = getAI();
    const modelId = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Find places matching: "${query}". 
      Return a pure JSON string array (no markdown formatting, no \`\`\`json wrappers) containing up to 3 results.
      The JSON objects should strictly follow this schema:
      {
        "name": "string",
        "address": "string",
        "phone": "string"
      }
      If a field is unknown, use an empty string.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    let text = response.text || '[]';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
        text = text.substring(start, end + 1);
    }

    const json = JSON.parse(text);
    return json;
  } catch (error) {
    console.error("Map Search Error:", error);
    return [];
  }
};

export const generateSmartSummary = async (documents: UserDocument[], medicines: Medicine[]) => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-pro-preview';

    let contextData = "DOCUMENT VAULT CONTENT:\n";
    documents.forEach(doc => {
      contextData += `\nDocument: ${doc.name}\nSummary: ${doc.summary || ''}\nInsights: ${doc.healthInsights || ''}\n`;
    });

    contextData += "\nCURRENT MEDICATIONS:\n";
    medicines.forEach(med => {
      contextData += `- ${med.name} ${med.strength || ''}: ${med.directions || ''}\n`;
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Generate a structured one-page summary using the SBAR framework based on the following context.
      
      ${contextData}`,
      config: {
        systemInstruction: `Act as a Clinical Preparation Assistant. When the user requests a "Consultation Prep" or "Summary," scan the Document Vault for the most recent letters and medications related to the upcoming appointment.
Output Format: Generate a structured one-page summary using the SBAR framework:

Situation: The primary reason for the visit and current symptoms.

Background: Relevant medical history and current medications extracted from the vault.

Assessment: A concise list of recent changes or concerns the AI has identified in the documents.

Recommendation: 3–5 high-value questions for the user to ask their doctor (e.g., "Based on my last blood test in the vault, should we adjust my dosage?").
Tone: Clinical, efficient, and empowering.`,
      }
    });

    return response.text || "Unable to generate a summary at this time.";
  } catch (error) {
    console.error("Smart Summary Error:", error);
    throw error;
  }
};

export const generateHealthTrends = async (documents: UserDocument[]) => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-pro-preview';

    let contextData = "DOCUMENT VAULT CONTENT:\n";
    documents.forEach(doc => {
      contextData += `\nDocument: ${doc.name}\nDate: ${doc.createdAt}\nSummary: ${doc.summary || ''}\nInsights: ${doc.healthInsights || ''}\n`;
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Cross-reference all documents in the "Document Vault" to identify longitudinal trends based on the following context.
      
      ${contextData}`,
      config: {
        systemInstruction: `Act as a Proactive Health Analyst. Periodically or upon request, cross-reference all documents in the "Document Vault" to identify longitudinal trends.
Logic: 
1. Data Extraction: Identify recurring metrics (BP, glucose, weight) or repeated mentions of specific symptoms across different letters.
2. Anomaly Detection: Flag if a metric is trending outside of NHS-standard healthy ranges or if a symptom frequency is increasing.
3. Insight Generation: "I’ve noticed your last three letters mention 'fatigue' as a side effect. This has been consistent since your medication change in January."
Safety Constraint: Never suggest a diagnosis. Frame insights as "Observations to discuss with a professional."`,
      }
    });

    return response.text || "Unable to generate health trends at this time.";
  } catch (error) {
    console.error("Health Trends Error:", error);
    throw error;
  }
};

export const generateMedicalID = async (profile: UserProfile, documents: UserDocument[], medicines: Medicine[]) => {
  try {
    const ai = getAI();
    const modelId = 'gemini-3.1-pro-preview';

    let contextData = "USER PROFILE:\n";
    contextData += `Name: ${profile.firstName || profile.name} ${profile.surname || ''}\n`;
    contextData += `DOB: ${profile.dateOfBirth || 'Unknown'}\n`;
    contextData += `NHS Number: ${profile.nhsNumber || 'Unknown'}\n`;
    contextData += `Emergency Contact: ${profile.nokName || 'Unknown'} (${profile.nokContact || 'Unknown'})\n`;

    contextData += "\nDOCUMENT VAULT CONTENT:\n";
    documents.forEach(doc => {
      contextData += `\nDocument: ${doc.name}\nSummary: ${doc.summary || ''}\nInsights: ${doc.healthInsights || ''}\n`;
    });

    contextData += "\nCURRENT MEDICATIONS:\n";
    medicines.forEach(med => {
      contextData += `- ${med.name} ${med.strength || ''}: ${med.directions || ''}\n`;
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Generate a "Digital Medical ID" based on the most vital information in the Document Vault and Profile.
      
      ${contextData}`,
      config: {
        systemInstruction: `Act as an Emergency Protocol Coordinator. Your task is to generate a "Digital Medical ID" based on the most vital information in the Document Vault.
Required Fields: 
* Critical Alerts: Allergies, Pacemakers, or "Do Not Intubate" (DNI) orders if found in documents.
* Active Medications: A list of life-sustaining medications (e.g., Insulin, Anticoagulants).
* Primary Diagnosis: Any chronic conditions (e.g., Type 1 Diabetes, Epilepsy).
* Emergency Contact: Extracted from the user profile or recent letters.
Output: Format this into a high-contrast, easy-to-read "Emergency Card" layout. Use markdown.
Grounding: Ensure terminology matches standard UK emergency medicine shorthand.`,
      }
    });

    return response.text || "Unable to generate Medical ID at this time.";
  } catch (error) {
    console.error("Medical ID Error:", error);
    throw error;
  }
};
