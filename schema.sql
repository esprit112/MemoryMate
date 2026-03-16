-- MemoryMate Database Schema
-- Optimized for Turso (libsql)

-- Profiles (Users) Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerkUserId TEXT,
  name TEXT,
  avatarColor TEXT,
  createdAt TEXT,
  firstName TEXT,
  surname TEXT,
  address TEXT,
  dateOfBirth TEXT,
  nhsNumber TEXT,
  telephone TEXT,
  mobile TEXT,
  email TEXT,
  nokName TEXT,
  nokAddress TEXT,
  nokContact TEXT,
  doctorName TEXT,
  doctorAddress TEXT,
  doctorContact TEXT,
  pharmacyName TEXT,
  pharmacyAddress TEXT,
  pharmacyContact TEXT,
  emergencyEmails TEXT,
  emergencyPhones TEXT,
  notificationFrequency TEXT DEFAULT 'hourly',
  notificationLimit INTEGER DEFAULT 3
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  userId TEXT,
  title TEXT,
  time TEXT,
  date TEXT,
  type TEXT,
  completed INTEGER DEFAULT 0,
  notes TEXT,
  recurrence TEXT DEFAULT 'none',
  notificationCount INTEGER DEFAULT 0,
  lastNotificationSent TEXT,
  sent4Day INTEGER DEFAULT 0,
  sent1Day INTEGER DEFAULT 0,
  sentDayOf INTEGER DEFAULT 0,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Caregivers Table
CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT,
  relationship TEXT,
  phoneNumber TEXT,
  alertsEnabled INTEGER DEFAULT 1,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  userId TEXT,
  action_type TEXT,
  subject_profile TEXT,
  performed_by TEXT,
  description TEXT,
  timestamp TEXT,
  reference_id TEXT,
  deleted_data TEXT,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT,
  type TEXT,
  mimeType TEXT,
  data TEXT,
  summary TEXT,
  createdAt TEXT,
  category TEXT,
  organization TEXT,
  department TEXT,
  contactName TEXT,
  contactPhone TEXT,
  contactEmail TEXT,
  appointmentDate TEXT,
  appointmentTime TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  filePath TEXT,
  file_blob BLOB,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Support Cards Table
CREATE TABLE IF NOT EXISTS support_cards (
  id TEXT PRIMARY KEY,
  userId TEXT,
  condition TEXT,
  nhsUrl TEXT,
  charityUrl TEXT,
  category TEXT,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT,
  strength TEXT,
  directions TEXT,
  image TEXT,
  createdAt TEXT,
  lastIssuedDate TEXT,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_userId ON reminders(userId);
CREATE INDEX IF NOT EXISTS idx_medicines_userId ON medicines(userId);
CREATE INDEX IF NOT EXISTS idx_documents_userId ON documents(userId);
CREATE INDEX IF NOT EXISTS idx_caregivers_userId ON caregivers(userId);
CREATE INDEX IF NOT EXISTS idx_activity_logs_userId ON activity_logs(userId);
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_file ON documents(userId, name);
