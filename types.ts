

export interface Caregiver {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  alertsEnabled: boolean;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action_type: 'ADD' | 'EDIT' | 'DELETE' | 'NOTIFY';
  subject_profile: string;
  performed_by: string;
  description: string;
  timestamp: string;
  reference_id?: string;
  deleted_data?: string;
}

export interface SupportCard {
  id: string;
  userId: string;
  condition: string;
  nhsUrl: string;
  charityUrl: string;
  category: string;
}

export interface SupportCardSuggestion {
  detected_condition: string;
  suggest_card: boolean;
  nhs_url: string;
  charity_url: string;
  message: string;
  category: string;
}

export interface Reminder {
  id: string;
  userId: string; // Foreign key
  title: string;
  time: string; // HH:mm format
  date: string; // YYYY-MM-DD format
  type: 'medication' | 'appointment' | 'general' | 'health';
  completed: boolean;
  notes?: string;
  recurrence?: string;
  
  // Notification State
  notificationCount?: number;
  lastNotificationSent?: string;
}

export interface Medicine {
  id: string;
  userId: string;
  name: string;
  strength?: string;
  directions?: string;
  images?: string[]; // Array of Base64 strings
  createdAt: string;
  lastIssuedDate?: string; // YYYY-MM-DD
}

export enum TabView {
  HOME = 'HOME',
  REMINDERS = 'REMINDERS',
  HEALTHCARE = 'HEALTHCARE',
  PERSONAL_INFO = 'PERSONAL_INFO',
  CHAT = 'CHAT',
  VISION = 'VISION',
  DOCUMENTS = 'DOCUMENTS',
  RESOURCES = 'RESOURCES',
  ACTIVITY_FEED = 'ACTIVITY_FEED',
  CAREGIVERS = 'CAREGIVERS'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: string[]; // For Search Grounding URLs
  isThinking?: boolean;
  supportCardSuggestion?: SupportCardSuggestion;
  auditLog?: ActivityLog;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: string;

  // Personal Details
  firstName?: string;
  surname?: string;
  address?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  nhsNumber?: string;

  // Contact Details
  telephone?: string;
  mobile?: string;
  email?: string;

  // Next of Kin
  nokName?: string;
  nokAddress?: string;
  nokContact?: string;

  // Doctor Details
  doctorName?: string;
  doctorAddress?: string;
  doctorContact?: string;

  // Pharmacy Details
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyContact?: string;

  // Notification System Settings
  notificationFrequency?: 'immediately' | 'hourly' | 'daily';
  notificationLimit?: number; // Max number of messages to send
}

export interface UserDocument {
  id: string;
  userId: string;
  name: string; // Filename or User defined title
  type: 'pdf' | 'image';
  mimeType: string;
  data: string; // Base64
  summary?: string;
  createdAt: string;
  status?: 'active' | 'pending_analysis';
  filePath?: string;

  // Enhanced Metadata
  category?: string; // e.g. Appointment, Test Result, General, Medical, Identification, Medicine, Household, Vehicle
  organization?: string; // e.g. NHS, St Mary's Hospital
  department?: string; // e.g. Cardiology
  contactName?: string; // Specific person mentioned
  contactPhone?: string;
  contactEmail?: string;
  appointmentDate?: string; // YYYY-MM-DD
  appointmentTime?: string; // HH:MM
  location?: string;
  healthInsights?: string; // NHS-grounded health insights
}