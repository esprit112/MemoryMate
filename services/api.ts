import { Reminder, UserProfile, UserDocument, Medicine, SupportCard, ActivityLog } from '../types';

export const getApiBase = () => {
  const stored = localStorage.getItem('MEMORYMATE_API_URL');
  if (stored) return stored;
  return '/api';
};

let getTokenFn: (() => Promise<string | null>) | null = null;
export const setGetToken = (fn: () => Promise<string | null>) => { getTokenFn = fn; };

export const getHeaders = async (additionalHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...additionalHeaders };
  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// --- Users ---

export const fetchUsers = async (): Promise<UserProfile[]> => {
  const res = await fetch(`${getApiBase()}/users`, {
    headers: await getHeaders()
  });
  if (!res.ok) {
    if (res.status === 503) {
      const errData = await res.json().catch(() => null);
      if (errData && errData.error === "DNS_TIMEOUT") {
        throw new Error(JSON.stringify(errData));
      }
    }
    throw new Error('Failed to fetch users');
  }
  return res.json();
};

export const createUser = async (user: UserProfile): Promise<UserProfile> => {
  const res = await fetch(`${getApiBase()}/users`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
};

export const updateUser = async (user: UserProfile): Promise<UserProfile> => {
  const res = await fetch(`${getApiBase()}/users/${user.id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
};

export const deleteUser = async (userId: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/users/${userId}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete user');
};

// --- Reminders ---

export const fetchReminders = async (userId: string): Promise<Reminder[]> => {
  const res = await fetch(`${getApiBase()}/reminders/${userId}`, {
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch reminders');
  return res.json();
};

export const createReminder = async (reminder: Reminder): Promise<Reminder> => {
  const res = await fetch(`${getApiBase()}/reminders`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(reminder),
  });
  if (!res.ok) throw new Error('Failed to create reminder');
  return res.json();
};

export const updateReminder = async (reminder: Reminder): Promise<void> => {
  const res = await fetch(`${getApiBase()}/reminders/${reminder.id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(reminder),
  });
  if (!res.ok) throw new Error('Failed to update reminder');
};

export const toggleReminderComplete = async (id: string, completed: boolean): Promise<void> => {
  const res = await fetch(`${getApiBase()}/reminders/${id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error('Failed to update reminder');
};

export const deleteReminder = async (id: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/reminders/${id}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete reminder');
};

// --- Documents ---

export const fetchDocuments = async (userId: string): Promise<UserDocument[]> => {
  const res = await fetch(`${getApiBase()}/documents/${userId}`, {
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
};

export const createDocument = async (doc: UserDocument): Promise<UserDocument> => {
  const res = await fetch(`${getApiBase()}/documents`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload document');
  }
  return res.json();
};

export const updateDocument = async (doc: UserDocument): Promise<void> => {
  const res = await fetch(`${getApiBase()}/documents/${doc.id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error('Failed to update document');
};

export const updateDocumentSummary = async (id: string, summary: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/documents/${id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ summary }),
  });
  if (!res.ok) throw new Error('Failed to update document summary');
};

export const deleteDocument = async (id: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/documents/${id}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete document');
};

// --- Medicines ---

export const fetchMedicines = async (userId: string): Promise<Medicine[]> => {
  const res = await fetch(`${getApiBase()}/medicines/${userId}`, {
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch medicines');
  return res.json();
};

export const createMedicine = async (medicine: Medicine): Promise<Medicine> => {
  const res = await fetch(`${getApiBase()}/medicines`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(medicine),
  });
  if (!res.ok) throw new Error('Failed to create medicine');
  return res.json();
};

export const updateMedicine = async (medicine: Medicine): Promise<Medicine> => {
  const res = await fetch(`${getApiBase()}/medicines/${medicine.id}`, {
    method: 'PUT',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(medicine),
  });
  if (!res.ok) throw new Error('Failed to update medicine');
  return res.json();
};

export const deleteMedicine = async (id: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/medicines/${id}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete medicine');
};

// --- Activity Logs ---
export const fetchActivityLogs = async (userId: string): Promise<ActivityLog[]> => {
  const res = await fetch(`${getApiBase()}/activity-logs/${userId}`, {
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
};

export const createActivityLog = async (log: ActivityLog): Promise<ActivityLog> => {
  const res = await fetch(`${getApiBase()}/activity-logs`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(log)
  });
  if (!res.ok) throw new Error('Failed to create activity log');
  return res.json();
};

export const restoreItem = async (logId: string): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${getApiBase()}/restore-item`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ logId }),
  });
  if (!res.ok) throw new Error('Failed to restore item');
  return res.json();
};
export const fetchSupportCards = async (userId: string): Promise<SupportCard[]> => {
  const res = await fetch(`${getApiBase()}/support-cards/${userId}`, {
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch support cards');
  return res.json();
};

export const createSupportCard = async (card: SupportCard): Promise<SupportCard> => {
  const res = await fetch(`${getApiBase()}/support-cards`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error('Failed to create support card');
  return res.json();
};

export const deleteSupportCard = async (id: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/support-cards/${id}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete support card');
};

// --- System ---

export const sendTestNotification = async (userId: string, name: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/test-notification`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, name }),
  });
  if (!res.ok) throw new Error('Failed to send test notification');
};

export const pingServer = async (baseUrl: string): Promise<boolean> => {
  try {
    const res = await fetch(`${baseUrl}/ping`, {
      headers: await getHeaders()
    });
    return res.ok;
  } catch (e) {
    return false;
  }
};

export const downloadBackup = async (): Promise<void> => {
  // Use window.open or create an anchor to trigger download
  const url = `${getApiBase()}/admin/backup`;
  const link = document.createElement('a');
  link.href = url;
  link.download = 'memorymate.db';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const restoreBackup = async (base64Data: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/admin/restore`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data: base64Data }),
  });
  if (!res.ok) throw new Error('Restore failed');
};

export const triggerCaregiverAlert = async (userId: string, smsSummary: string): Promise<void> => {
  const res = await fetch(`${getApiBase()}/caregiver-alert`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, smsSummary }),
  });
  if (!res.ok) throw new Error('Failed to trigger caregiver alert');
};
