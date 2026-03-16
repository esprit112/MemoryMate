

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import express from 'express';
import dns from 'node:dns';
import { GoogleGenAI, Type } from '@google/genai';

dns.setDefaultResultOrder('ipv4first');

// Load .env file manually if it exists (for compatibility with older Node versions)
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key.trim()] = value;
      }
    }
  });
}

import sqlite3Init from 'sqlite3';
import cors from 'cors';
import chokidar from 'chokidar';
import { clerkMiddleware, getAuth } from '@clerk/express';

// Task 2: Fix the "Loaded: false" Issue & Environment Check
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!CLERK_SECRET_KEY || !GEMINI_API_KEY) {
  console.warn("⚠️ Warning: Missing CLERK_SECRET_KEY or GEMINI_API_KEY. Some features may not work until these are configured in Settings.");
} else {
  console.log("🚀 System Check: Clerk Auth & Gemini API keys verified.");
}

const sqlite3 = sqlite3Init.verbose();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Task 4: Database Pathing
const PERSISTENT_ROOT = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(PERSISTENT_ROOT, 'memorymate.db');
const USERS_BASE_DIR = process.env.USERS_BASE_DIR || (PERSISTENT_ROOT === '/data' ? '/data' : path.join(PERSISTENT_ROOT, 'users'));

// Ensure base directories exist
[PERSISTENT_ROOT, USERS_BASE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`Failed to create directory ${dir}:`, e);
    }
  }
});

// Task 1: Refactor Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' })); 
const clerkHandler = clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY
});

app.use(async (req, res, next) => {
  try {
    await clerkHandler(req, res, (err) => {
      if (err) {
        const errorString = err ? err.toString() : '';
        if (errorString.includes('fetch failed') || errorString.includes('EAI_AGAIN')) {
          console.error("Clerk Handshake Error (via next):", errorString);
          return res.status(503).json({
            error: "DNS_TIMEOUT",
            message: "MemoryMate cannot reach authentication servers. Please check your internet connection."
          });
        }
        return next(err);
      }
      next();
    });
  } catch (error) {
    const errorString = error ? error.toString() : '';
    if (errorString.includes('fetch failed') || errorString.includes('EAI_AGAIN')) {
      console.error("Clerk Handshake Error (via throw):", errorString);
      return res.status(503).json({
        error: "DNS_TIMEOUT",
        message: "MemoryMate cannot reach authentication servers. Please check your internet connection."
      });
    }
    next(error);
  }
});

// requireAuth helper
const requireAuth = () => (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  req.auth = auth; // Attach auth for downstream usage
  next();
};

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Database Setup
let db;
try {
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    } else {
      console.log(`Connected to the SQLite database at: ${DB_PATH}`);
      
      db.serialize(() => {
        const pragmas = [
          'PRAGMA journal_mode = WAL;',
          'PRAGMA synchronous = NORMAL;',
          'PRAGMA busy_timeout = 5000;',
          'PRAGMA foreign_keys = ON;',
          'PRAGMA secure_delete = ON;'
        ];
        
        let hasError = false;
        pragmas.forEach((pragma, index) => {
          db.run(pragma, (err) => {
            if (err && !hasError) {
              hasError = true;
              console.error(`Failed to apply PRAGMA: ${pragma}`, err.message);
              process.exit(1);
            }
            
            // On the last PRAGMA, if no errors occurred, proceed with setup
            if (index === pragmas.length - 1 && !hasError) {
              console.log('Database PRAGMAs applied successfully.');
              createTables();
              ensureUserDirectories();
            }
          });
        });
      });
    }
  });
} catch (error) {
  console.error('Critical failure during database initialization:', error);
  process.exit(1);
}

// Ensure user directories exist for all users in DB
function ensureUserDirectories() {
  db.all("SELECT name FROM users", [], (err, rows) => {
    if (err || !rows) return;
    rows.forEach(user => {
      const userDir = path.join(USERS_BASE_DIR, user.name);
      const folders = ['Uploaded', 'Analysed', 'Images', 'Documents'];
      try {
        if (!fs.existsSync(userDir)) {
          console.log(`Creating missing directory for user: ${user.name}`);
          fs.mkdirSync(userDir, { recursive: true });
          folders.forEach(f => {
            fs.mkdirSync(path.join(userDir, f), { recursive: true });
          });
        }
      } catch (err) {
        console.error(`Failed to ensure directories for ${user.name}:`, err);
      }
    });
  });
}

function createTables() {
  db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
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
      notificationFrequency TEXT,
      notificationLimit INTEGER
    )`);
    // Always attempt to add columns to handle old databases
    const userColumns = [
      { name: 'clerkUserId', type: 'TEXT' },
      { name: 'firstName', type: 'TEXT' },
      { name: 'surname', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'dateOfBirth', type: 'TEXT' },
      { name: 'nhsNumber', type: 'TEXT' },
      { name: 'telephone', type: 'TEXT' },
      { name: 'mobile', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'nokName', type: 'TEXT' },
      { name: 'nokAddress', type: 'TEXT' },
      { name: 'nokContact', type: 'TEXT' },
      { name: 'doctorName', type: 'TEXT' },
      { name: 'doctorAddress', type: 'TEXT' },
      { name: 'doctorContact', type: 'TEXT' },
      { name: 'pharmacyName', type: 'TEXT' },
      { name: 'pharmacyAddress', type: 'TEXT' },
      { name: 'pharmacyContact', type: 'TEXT' },
      { name: 'emergencyEmails', type: 'TEXT' },
      { name: 'emergencyPhones', type: 'TEXT' },
      { name: 'notificationFrequency', type: 'TEXT' },
      { name: 'notificationLimit', type: 'INTEGER' }
    ];
    userColumns.forEach(col => {
      db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, () => {});
    });

    // Reminders Table
    db.run(`CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      userId TEXT,
      title TEXT,
      time TEXT,
      date TEXT,
      type TEXT,
      completed INTEGER,
      notes TEXT,
      recurrence TEXT,
      notificationCount INTEGER DEFAULT 0,
      lastNotificationSent TEXT,
      sent4Day INTEGER DEFAULT 0,
      sent1Day INTEGER DEFAULT 0,
      sentDayOf INTEGER DEFAULT 0,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    // Migrations for new alerting logic
    db.run("ALTER TABLE reminders ADD COLUMN recurrence TEXT", () => {});
    db.run("ALTER TABLE reminders ADD COLUMN notificationCount INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE reminders ADD COLUMN lastNotificationSent TEXT", () => {});
    db.run("ALTER TABLE reminders ADD COLUMN sent4Day INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE reminders ADD COLUMN sent1Day INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE reminders ADD COLUMN sentDayOf INTEGER DEFAULT 0", () => {});

    // Caregivers Table
    db.run(`CREATE TABLE IF NOT EXISTS caregivers (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT,
      relationship TEXT,
      phoneNumber TEXT,
      alertsEnabled INTEGER
    )`);
    // Migrate old columns if they exist
    db.run("ALTER TABLE caregivers RENAME COLUMN user_id TO userId", () => {});
    db.run("ALTER TABLE caregivers RENAME COLUMN phone_number TO phoneNumber", () => {});
    db.run("ALTER TABLE caregivers RENAME COLUMN alerts_enabled TO alertsEnabled", () => {});

    // Activity Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      profileId TEXT,
      eventType TEXT,
      message TEXT,
      status TEXT,
      technicalDetails TEXT,
      timestamp DATETIME
    )`);

    // Documents Table
    db.run(`CREATE TABLE IF NOT EXISTS documents (
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
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    db.run("ALTER TABLE documents ADD COLUMN status TEXT DEFAULT 'active'", () => {});
    db.run("ALTER TABLE documents ADD COLUMN filePath TEXT", () => {});
    db.run("ALTER TABLE documents ADD COLUMN file_blob BLOB", () => {});
    const docColumns = [
      { name: 'category', type: 'TEXT' },
      { name: 'organization', type: 'TEXT' },
      { name: 'department', type: 'TEXT' },
      { name: 'contactName', type: 'TEXT' },
      { name: 'contactPhone', type: 'TEXT' },
      { name: 'contactEmail', type: 'TEXT' },
      { name: 'appointmentDate', type: 'TEXT' },
      { name: 'appointmentTime', type: 'TEXT' },
      { name: 'location', type: 'TEXT' }
    ];
    docColumns.forEach(col => {
      db.run(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`, () => {});
    });
    
    // Add unique constraint for duplicate filename prevention
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_file ON documents(userId, name)", () => {});

    // Support Cards Table
    db.run(`CREATE TABLE IF NOT EXISTS support_cards (
      id TEXT PRIMARY KEY,
      userId TEXT,
      condition TEXT,
      nhsUrl TEXT,
      charityUrl TEXT,
      category TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    // Activity Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action_type TEXT,
      subject_profile TEXT,
      performed_by TEXT,
      description TEXT,
      timestamp TEXT,
      reference_id TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    db.run("ALTER TABLE activity_logs ADD COLUMN deleted_data TEXT", () => {});

    // Medicines Table
    db.run(`CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT,
      strength TEXT,
      directions TEXT,
      image TEXT,
      createdAt TEXT,
      lastIssuedDate TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    db.run("ALTER TABLE medicines ADD COLUMN lastIssuedDate TEXT", () => {});
  });
}

// --- File Watcher Service ---
const watcher = chokidar.watch(USERS_BASE_DIR, {
  ignored: /(^|[/\\])\../, // ignore dotfiles
  persistent: true,
  depth: 2 // Watch up to Uploaded folder
});

watcher.on('add', async (filePath) => {
  // Expected path: .../users/{UserName}/Uploaded/{FileName}
  const relativePath = path.relative(USERS_BASE_DIR, filePath);
  const parts = relativePath.split(path.sep);

  if (parts.length === 3 && parts[1] === 'Uploaded') {
    const userName = parts[0];
    const fileName = parts[2];

    console.log(`New file detected for ${userName}: ${fileName}`);

    // Find user ID by name
    db.get("SELECT id FROM users WHERE name = ?", [userName], (err, user) => {
      if (err || !user) return;

      // Mark as pending analysis in DB
      const docId = 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const mimeType = path.extname(fileName).toLowerCase() === '.pdf' ? 'application/pdf' : 'image/jpeg';
      const type = mimeType === 'application/pdf' ? 'pdf' : 'image';

      // Read file data as base64
      try {
        const fileData = fs.readFileSync(filePath).toString('base64');
        const sql = `INSERT INTO documents (id, userId, name, type, mimeType, data, createdAt, status, filePath) VALUES (?,?,?,?,?,?,?,?,?)`;
        db.run(sql, [docId, user.id, fileName, type, mimeType, fileData, new Date().toISOString(), 'pending_analysis', filePath]);
      } catch (err) {
        console.error("Failed to read file for auto-processing:", err);
      }
    });
  }
});

// --- Background Notification Service ---

// 1. Run immediately on server start (Startup Sync)
setTimeout(() => {
  console.log("--> Performing startup reminder check (Offline Sync)...");
  checkRemindersAndNotify();
}, 2000); // Small delay to ensure DB is ready

// 2. Run every minute
setInterval(() => {
  checkRemindersAndNotify();
}, 60000);

function checkRemindersAndNotify() {
  // Logic: Select appointments that haven't been completed.
  const sql = `
    SELECT r.*, u.firstName, u.name as userName
    FROM reminders r
    JOIN users u ON r.userId = u.id
    WHERE r.completed = 0 
    AND (r.type = 'appointment' OR r.type = 'health' OR r.type = 'medication')
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return console.error("Notification Service Error:", err);

    rows.forEach(row => {
      // Calculate difference in milliseconds
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const targetDay = new Date(row.date);
      targetDay.setHours(0,0,0,0);
      
      const diffTime = targetDay.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      const currentHourGMT = new Date().getUTCHours();
      let triggerUpdateField = "";

      // --- LOGIC GATES ---

      // 1. Day Of Appointment (Trigger at 6am GMT or ASAP if app starts later)
      if (diffDays === 0 && !row.sentDayOf) {
        if (currentHourGMT >= 6) {
            triggerUpdateField = "sentDayOf";
        }
      } 
      // 2. 1 Day Before (Tomorrow)
      else if (diffDays === 1 && !row.sent1Day) {
         triggerUpdateField = "sent1Day";
      }
      // 3. 4 Days Before (Upcoming)
      else if (diffDays <= 4 && diffDays > 1 && !row.sent4Day) {
         triggerUpdateField = "sent4Day";
      }

      // --- SENDING LOGIC ---
      if (triggerUpdateField) {
        console.log("------------------------------------------------");
        console.log(`TRIGGERING ALERT FOR REMINDER ID: ${row.id}`);
        console.log("------------------------------------------------");

        // Update DB to prevent duplicate sends
        let updateSql = `UPDATE reminders SET ${triggerUpdateField} = 1, lastNotificationSent = ? WHERE id = ?`;
        
        if (triggerUpdateField === 'sentDayOf') {
            updateSql = `UPDATE reminders SET sentDayOf = 1, sent1Day = 1, sent4Day = 1, lastNotificationSent = ? WHERE id = ?`;
        }

        const newTime = new Date().toISOString();
        
        db.run(updateSql, [newTime, row.id], (err) => {
          if (err) console.error("Failed to update reminder status", err);
        });
      }
    });
  });
}

// Middleware to check if the requested userId belongs to the authenticated clerk user
const checkProfileOwnership = (req, res, next) => {
  const clerkUserId = req.auth.userId;
  // userId can be in params or body
  const userId = req.params.userId || req.body.userId;
  
  if (!userId) {
    // If no userId is provided, we can't check ownership, let the endpoint handle it or fail
    return next();
  }

  db.get("SELECT id FROM users WHERE id = ? AND clerkUserId = ?", [userId, clerkUserId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(403).json({ error: "Forbidden: You do not have access to this profile's data" });
    next();
  });
};

// Helper to verify if an item belongs to a user owned by the clerk user
const verifyItemOwnership = (tableName, itemId, clerkUserId, callback) => {
  const sql = `
    SELECT i.id 
    FROM ${tableName} i
    JOIN users u ON i.userId = u.id
    WHERE i.id = ? AND u.clerkUserId = ?
  `;
  db.get(sql, [itemId, clerkUserId], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, false);
    callback(null, true);
  });
};

// --- Support Cards ---
app.get('/api/support-cards/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  db.all("SELECT * FROM support_cards WHERE userId = ?", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/support-cards', requireAuth(), checkProfileOwnership, (req, res) => {
  const c = req.body;
  const sql = `INSERT INTO support_cards (id, userId, condition, nhsUrl, charityUrl, category) VALUES (?,?,?,?,?,?)`;
  db.run(sql, [c.id, c.userId, c.condition, c.nhsUrl, c.charityUrl, c.category], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(c);
  });
});

app.delete('/api/support-cards/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('support_cards', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    db.run("DELETE FROM support_cards WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// --- Activity Logs ---
app.get('/api/activity-logs/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  db.all("SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/activity-logs', requireAuth(), checkProfileOwnership, (req, res) => {
  const l = req.body;
  const sql = `INSERT INTO activity_logs (id, userId, action_type, subject_profile, performed_by, description, timestamp, reference_id, deleted_data) VALUES (?,?,?,?,?,?,?,?,?)`;
  db.run(sql, [l.id, l.userId, l.action_type, l.subject_profile, l.performed_by, l.description, l.timestamp, l.reference_id, l.deleted_data || null], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(l);
  });
});

// --- Restore Item ---
app.post('/api/restore-item', requireAuth(), (req, res) => {
  const { logId } = req.body;
  const clerkUserId = req.auth.userId;

  // Verify log ownership
  verifyItemOwnership('activity_logs', logId, clerkUserId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    db.get("SELECT * FROM activity_logs WHERE id = ?", [logId], (err, log) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!log) return res.status(404).json({ error: "Log not found" });
      if (log.action_type !== 'DELETE' || !log.deleted_data) {
        return res.status(400).json({ error: "Log is not a deletion or has no data to restore" });
      }

      let itemData;
      try {
        itemData = JSON.parse(log.deleted_data);
      } catch (e) {
        console.error("Failed to parse deleted data", e);
        return res.status(500).json({ error: "Failed to parse deleted data" });
      }

      // Determine which table to restore to based on the description or other logic
      // For this prototype, we'll use a simple heuristic based on the description
      let sql;
      let params;
      let tableName = "";

      if (log.description.startsWith("Deleted reminder:")) {
        tableName = "reminders";
        sql = `INSERT INTO reminders (id, userId, title, time, date, type, completed, notes, recurrence, notificationCount, lastNotificationSent, sent4Day, sent1Day, sentDayOf) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [itemData.id, itemData.userId, itemData.title, itemData.time, itemData.date, itemData.type, itemData.completed ? 1 : 0, itemData.notes || null, itemData.recurrence || 'none', itemData.notificationCount || 0, itemData.lastNotificationSent || null, itemData.sent4Day || 0, itemData.sent1Day || 0, itemData.sentDayOf || 0];
      } else if (log.description.startsWith("Deleted medicine:")) {
        tableName = "medicines";
        const imageJson = itemData.images && itemData.images.length > 0 ? JSON.stringify(itemData.images) : null;
        sql = `INSERT INTO medicines (id, userId, name, strength, directions, image, createdAt, lastIssuedDate) VALUES (?,?,?,?,?,?,?,?)`;
        params = [itemData.id, itemData.userId, itemData.name, itemData.strength || null, itemData.directions || null, imageJson, itemData.createdAt, itemData.lastIssuedDate || null];
      } else if (log.description.startsWith("Deleted document:")) {
        tableName = "documents";
        sql = `INSERT INTO documents (
          id, userId, name, type, mimeType, data, summary, createdAt,
          category, organization, department, contactName, contactPhone, 
          contactEmail, appointmentDate, appointmentTime, location, status, filePath
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [
          itemData.id, itemData.userId, itemData.name, itemData.type, itemData.mimeType, itemData.data, itemData.summary || null, itemData.createdAt,
          itemData.category || null, itemData.organization || null, itemData.department || null, itemData.contactName || null,
          itemData.contactPhone || null, itemData.contactEmail || null, itemData.appointmentDate || null, 
          itemData.appointmentTime || null, itemData.location || null, itemData.status || 'active', itemData.filePath || null
        ];
      } else {
        return res.status(400).json({ error: "Unsupported item type for restore" });
      }

      db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Log the restore action
        const restoreLogSql = `INSERT INTO activity_logs (id, userId, action_type, subject_profile, performed_by, description, timestamp, reference_id) VALUES (?,?,?,?,?,?,?,?)`;
        const restoreLogId = 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        db.run(restoreLogSql, [restoreLogId, log.userId, 'ADD', log.subject_profile, log.performed_by, `Restored ${tableName.slice(0, -1)}: ${itemData.title || itemData.name}`, new Date().toISOString(), itemData.id], (err) => {
          if (err) console.error("Failed to log restore action:", err);
        });

        res.json({ success: true, message: `Restored ${tableName.slice(0, -1)} successfully.` });
      });
    });
  });
});

// --- API Endpoints ---

// ADMIN: PING
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// ADMIN: BACKUP
app.get('/api/admin/backup', (req, res) => {
  res.download(DB_PATH, 'memorymate.db', (err) => {
    if (err) {
      console.error("Backup download error:", err);
      res.status(500).send("Could not download backup.");
    }
  });
});

// ADMIN: RESTORE
app.post('/api/admin/restore', (req, res) => {
  const { data } = req.body; // Expecting Base64 encoded file data
  if (!data) return res.status(400).json({ error: "No data provided" });

  // 1. Close the database connection to release the file lock
  db.close((err) => {
    if (err) {
      console.error("Error closing DB for restore:", err);
      return res.status(500).json({ error: "Could not close database for restore" });
    }

    // 2. Decode Base64 and Overwrite the file
    const buffer = Buffer.from(data, 'base64');
    fs.writeFile(DB_PATH, buffer, (writeErr) => {
       if (writeErr) {
         console.error("Error overwriting DB file:", writeErr);
         // Try to reopen DB anyway so server isn't dead
         db = new sqlite3.Database(DB_PATH);
         return res.status(500).json({ error: "Failed to write database file" });
       }

       // 3. Reopen the database
       db = new sqlite3.Database(DB_PATH, (openErr) => {
         if (openErr) {
           console.error("Error reopening DB:", openErr);
           return res.status(500).json({ error: "Failed to reopen database" });
         }
         console.log("Database restored and reopened successfully.");
         res.json({ success: true });
       });
    });
  });
});

// Get all users for the authenticated clerk user
app.get('/api/users', requireAuth(), (req, res) => {
  const clerkUserId = req.auth.userId;
  db.all("SELECT * FROM users WHERE clerkUserId = ?", [clerkUserId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const users = rows.map(u => ({
      ...u
    }));
    res.json(users);
  });
});

// Create User
app.post('/api/users', requireAuth(), (req, res) => {
  const u = req.body;
  const clerkUserId = req.auth.userId;
  const sql = `INSERT INTO users (
    id, clerkUserId, name, avatarColor, createdAt, firstName, surname, address, dateOfBirth, 
    nhsNumber, telephone, mobile, email, nokName, nokAddress, nokContact, 
    doctorName, doctorAddress, doctorContact, pharmacyName, pharmacyAddress, pharmacyContact,
    notificationFrequency, notificationLimit
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  
  const params = [
    u.id, clerkUserId, u.name, u.avatarColor, u.createdAt, u.firstName || null, u.surname || null, 
    u.address || null, u.dateOfBirth || null, u.nhsNumber || null, u.telephone || null, 
    u.mobile || null, u.email || null, u.nokName || null, u.nokAddress || null, 
    u.nokContact || null, u.doctorName || null, u.doctorAddress || null, 
    u.doctorContact || null, u.pharmacyName || null, u.pharmacyAddress || null, 
    u.pharmacyContact || null,
    u.notificationFrequency || 'hourly',
    u.notificationLimit || 3
  ];
  
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Create directory structure
    const userDir = path.join(USERS_BASE_DIR, u.name);
    const folders = [
      'Uploaded',
      'Analysed',
      'Images',
      'Documents'
    ];

    try {
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        folders.forEach(f => {
          fs.mkdirSync(path.join(userDir, f), { recursive: true });
        });
      }
    } catch (err) {
      console.error("Failed to create user directories:", err);
    }

    res.json(u);
  });
});

// Update User
app.put('/api/users/:id', requireAuth(), (req, res) => {
  const u = req.body;
  const clerkUserId = req.auth.userId; // Task 3: Matches clerk_user_id from token
  
  // Task 3: Ensure it correctly matches the clerk_user_id from the token with the owner_id (clerkUserId) in our SQLite database
  const sql = `UPDATE users SET 
    name=?, firstName=?, surname=?, address=?, dateOfBirth=?, nhsNumber=?, 
    telephone=?, mobile=?, email=?, nokName=?, nokAddress=?, nokContact=?, 
    doctorName=?, doctorAddress=?, doctorContact=?, pharmacyName=?, pharmacyAddress=?, pharmacyContact=?,
    notificationFrequency=?, notificationLimit=?
    WHERE id=? AND clerkUserId=?`;
    
  const params = [
    u.name, u.firstName || null, u.surname || null, u.address || null, 
    u.dateOfBirth || null, u.nhsNumber || null, u.telephone || null, 
    u.mobile || null, u.email || null, u.nokName || null, u.nokAddress || null, 
    u.nokContact || null, u.doctorName || null, u.doctorAddress || null, 
    u.doctorContact || null, u.pharmacyName || null, u.pharmacyAddress || null, 
    u.pharmacyContact || null,
    u.notificationFrequency || 'hourly',
    u.notificationLimit || 3,
    req.params.id,
    clerkUserId
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error("Profile Update Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(403).json({ error: "Unauthorized: You do not own this profile or it does not exist." });
    }
    res.json(u);
  });
});

// Delete User
app.delete('/api/users/:id', requireAuth(), (req, res) => {
  const userId = req.params.id;
  const clerkUserId = req.auth.userId;

  // First, get the user's name to delete their folder, and verify ownership
  db.get("SELECT name FROM users WHERE id = ? AND clerkUserId = ?", [userId, clerkUserId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "User not found or not authorized" });

    const userName = user.name;

    // Delete related records in a transaction-like manner (or sequentially)
    db.serialize(() => {
      db.run("DELETE FROM reminders WHERE userId = ?", [userId]);
      db.run("DELETE FROM medicines WHERE userId = ?", [userId]);
      db.run("DELETE FROM documents WHERE userId = ?", [userId]);
      
      // Finally, delete the user
      db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Delete the user's folder
        const userDir = path.join(USERS_BASE_DIR, userName);
        try {
          if (fs.existsSync(userDir)) {
            fs.rmSync(userDir, { recursive: true, force: true });
          }
        } catch (e) {
          console.error("Failed to delete user directory:", e);
        }

        res.json({ success: true });
      });
    });
  });
});

// Get Reminders
app.get('/api/reminders/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  db.all("SELECT * FROM reminders WHERE userId = ?", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const reminders = rows.map(r => ({ ...r, completed: !!r.completed }));
    res.json(reminders);
  });
});

// Create Reminder
app.post('/api/reminders', requireAuth(), checkProfileOwnership, (req, res) => {
  const r = req.body;
  const recurrence = r.recurrence || 'none';
  // Initialize sent flags to 0
  const sql = `INSERT INTO reminders (id, userId, title, time, date, type, completed, notes, recurrence, notificationCount, lastNotificationSent, sent4Day, sent1Day, sentDayOf) VALUES (?,?,?,?,?,?,?,?,?,0,null,0,0,0)`;
  const params = [r.id, r.userId, r.title, r.time, r.date, r.type, r.completed ? 1 : 0, r.notes || null, recurrence];

  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(r);
  });
});

// Toggle/Update Reminder
app.put('/api/reminders/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('reminders', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    const { completed } = req.body;
    
    if (typeof completed !== 'undefined') {
        // Just toggling completion status
        const sql = completed 
          ? "UPDATE reminders SET completed = ? WHERE id = ?"
          : "UPDATE reminders SET completed = ?, notificationCount = 0, lastNotificationSent = NULL WHERE id = ?"; // Re-arm if unchecked
          
        db.run(sql, [completed ? 1 : 0, req.params.id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
    } else {
        // Full Update
        const { title, time, date, type, notes, recurrence } = req.body;
        const sql = `UPDATE reminders SET title = ?, time = ?, date = ?, type = ?, notes = ?, recurrence = ? WHERE id = ?`;
        db.run(sql, [title, time, date, type, notes, recurrence, req.params.id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
    }
  });
});

// Delete Reminder
app.delete('/api/reminders/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('reminders', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    db.run("DELETE FROM reminders WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// Document/Medicine Endpoints
app.get('/api/documents/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  db.all("SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formattedRows = rows.map(row => {
      if (row.file_blob) {
        row.file_blob = Buffer.from(row.file_blob).toString('base64');
      }
      return row;
    });
    res.json(formattedRows);
  });
});
app.post('/api/documents', requireAuth(), checkProfileOwnership, (req, res) => {
  console.log(`--- Incoming Request: [${req.method}] [${req.url}] ---`);
  const d = req.body;
  
  // Check for duplicate filename
  db.get("SELECT id FROM documents WHERE userId = ? AND name = ?", [d.userId, d.name], (err, existingDoc) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existingDoc) {
      return res.status(409).json({ error: `A file named '${d.name}' already exists. Please rename the new file to continue.` });
    }

    const fileBlob = d.data ? Buffer.from(d.data, 'base64') : null;
    const sql = `INSERT INTO documents (
      id, userId, name, type, mimeType, data, summary, createdAt,
      category, organization, department, contactName, contactPhone, 
      contactEmail, appointmentDate, appointmentTime, location, file_blob
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    
    const params = [
      d.id, d.userId, d.name, d.type, d.mimeType, d.data, d.summary || null, d.createdAt,
      d.category || null, d.organization || null, d.department || null, d.contactName || null,
      d.contactPhone || null, d.contactEmail || null, d.appointmentDate || null, 
      d.appointmentTime || null, d.location || null, fileBlob
    ];

    db.run(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(d);
    });
  });
});
app.put('/api/documents/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('documents', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    const d = req.body;
    const docId = req.params.id;

    // Get current state to check for status change and filePath
    db.get("SELECT status, filePath, userId FROM documents WHERE id = ?", [docId], (err, currentDoc) => {
      if (err || !currentDoc) return res.status(404).json({ error: "Document not found" });

      let newFilePath = currentDoc.filePath;

      // Handle file move if status changes to active and we have a filePath in Uploaded
      if (currentDoc.status === 'pending_analysis' && d.status === 'active' && currentDoc.filePath) {
        const oldPath = currentDoc.filePath;
        // Check if it's in the Uploaded folder
        if (oldPath.includes(path.sep + 'Uploaded' + path.sep)) {
          const newPath = oldPath.replace(path.sep + 'Uploaded' + path.sep, path.sep + 'Analysed' + path.sep);
          
          try {
            // Ensure Analysed directory exists
            const analysedDir = path.dirname(newPath);
            if (!fs.existsSync(analysedDir)) {
              fs.mkdirSync(analysedDir, { recursive: true });
            }

            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
              newFilePath = newPath;
              console.log(`Moved file for analysis completion: ${path.basename(oldPath)} -> Analysed`);
            }
          } catch (moveErr) {
            console.error("Failed to move file after analysis:", moveErr);
          }
        }
      }

      const sql = `UPDATE documents SET 
        summary = ?, category = ?, organization = ?, department = ?, 
        contactName = ?, contactPhone = ?, contactEmail = ?, 
        appointmentDate = ?, appointmentTime = ?, location = ?, 
        status = ?, filePath = ?
        WHERE id = ?`;
      
      const params = [
        d.summary || null, d.category || null, d.organization || null, d.department || null,
        d.contactName || null, d.contactPhone || null, d.contactEmail || null,
        d.appointmentDate || null, d.appointmentTime || null, d.location || null,
        d.status || currentDoc.status, newFilePath, docId
      ];

      db.run(sql, params, () => {
        res.json({ success: true, filePath: newFilePath });
      });
    });
  });
});
app.delete('/api/documents/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('documents', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    const docId = req.params.id;
    db.get("SELECT filePath FROM documents WHERE id = ?", [docId], (err, row) => {
      if (row && row.filePath && fs.existsSync(row.filePath)) {
        try {
          fs.unlinkSync(row.filePath);
          console.log(`Deleted physical file: ${path.basename(row.filePath)}`);
        } catch (err) {
          console.error("Failed to delete physical file:", err);
        }
      }
      db.run("DELETE FROM documents WHERE id = ?", [docId], () => res.json({ success: true }));
    });
  });
});
app.get('/api/medicines/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  db.all("SELECT * FROM medicines WHERE userId = ? ORDER BY createdAt DESC", [req.params.userId], (err, rows) => {
    const medicines = rows.map(row => {
      let images = [];
      if (row.image) {
        if (row.image.trim().startsWith('[')) { try { images = JSON.parse(row.image); } catch (e) { console.error(e); images = [row.image]; } } 
        else { images = [row.image]; }
      }
      const { image, ...rest } = row;
      console.log(image ? "Image parsed" : "No image");
      return { ...rest, images };
    });
    res.json(medicines);
  });
});
app.post('/api/medicines', requireAuth(), checkProfileOwnership, (req, res) => {
  const m = req.body;
  const imageJson = m.images && m.images.length > 0 ? JSON.stringify(m.images) : null;
  const sql = `INSERT INTO medicines (id, userId, name, strength, directions, image, createdAt, lastIssuedDate) VALUES (?,?,?,?,?,?,?,?)`;
  db.run(sql, [m.id, m.userId, m.name, m.strength || null, m.directions || null, imageJson, m.createdAt, m.lastIssuedDate || null], () => res.json(m));
});
app.put('/api/medicines/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('medicines', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    const m = req.body;
    const imageJson = m.images && m.images.length > 0 ? JSON.stringify(m.images) : null;
    const sql = `UPDATE medicines SET name=?, strength=?, directions=?, image=?, lastIssuedDate=? WHERE id=?`;
    db.run(sql, [m.name, m.strength || null, m.directions || null, imageJson, m.lastIssuedDate || null, req.params.id], () => res.json(m));
  });
});
app.delete('/api/medicines/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('medicines', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    db.run("DELETE FROM medicines WHERE id = ?", [req.params.id], () => res.json({ success: true }));
  });
});

// Activity Logging Helper
const logActivity = (profileId, eventType, message, status, technicalDetails) => {
  const id = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();
  db.run(
    "INSERT INTO activity_logs (id, profileId, eventType, message, status, technicalDetails, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, profileId, eventType, message, status, technicalDetails, timestamp],
    (err) => {
      if (err) console.error("Failed to log activity:", err);
    }
  );
};

// Caregiver Alerts
const sendCaregiverSMS = async (phoneNumber, message, profileId, caregiverName) => {
  const jwt = process.env.SMS_WORKS_JWT;
  if (!jwt) {
    const msg = "SMS_WORKS_JWT not configured. Skipping SMS.";
    console.warn(msg);
    logActivity(profileId, 'SMS_DISPATCH', `Failed to send SMS to ${caregiverName}`, 'ERROR', msg);
    return { success: false, caregiverName, error: "Configuration missing" };
  }
  try {
    const response = await fetch('https://api.thesmsworks.co.uk/v1/message/send', {
      method: 'POST',
      headers: {
        'Authorization': jwt,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: 'MemoryMate',
        destination: phoneNumber,
        content: message
      })
    });
    const data = await response.json();
    
    if (response.ok && data.messageid) {
      logActivity(profileId, 'SMS_DISPATCH', `SMS sent to ${caregiverName}`, 'SUCCESS', JSON.stringify(data));
      return { success: true, caregiverName };
    } else {
      let errorMsg = data.message || "Unknown error";
      let displayMsg = `Alert Failed: ${errorMsg}. ${caregiverName} was not notified.`;
      
      if ((data.message && data.message.includes('Insufficient Credits')) || data.code === 4021) {
        displayMsg = `Alert Failed: Insufficient SMS credits. ${caregiverName} was not notified.`;
      } else if ((data.message && data.message.includes('Invalid Number')) || data.code === 4001) {
        displayMsg = `Alert Failed: Invalid phone number for ${caregiverName}.`;
      }
      
      logActivity(profileId, 'SMS_DISPATCH', displayMsg, 'ERROR', JSON.stringify(data));
      return { success: false, caregiverName, error: displayMsg };
    }
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    const displayMsg = `Alert Failed: Network error. ${caregiverName} was not notified.`;
    logActivity(profileId, 'SMS_DISPATCH', displayMsg, 'ERROR', errorStr);
    return { success: false, caregiverName, error: displayMsg };
  }
};

app.post('/api/analyze-document', requireAuth(), checkProfileOwnership, async (req, res) => {
  const { userId, base64Data, mimeType } = req.body;
  if (!base64Data || !mimeType || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    logActivity(userId, 'AI_ANALYSIS', 'Started document analysis', 'PENDING', `MimeType: ${mimeType}`);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const modelId = 'gemini-3.1-flash-lite-preview';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: "Analyze this document. Extract as much detail as possible to fill a contact/appointment form. If a health condition, illness, disorder, or medical term is identified, proactively provide a 'Health Insights' section. This section must be strictly grounded in NHS (National Health Service) guidelines. Provide a concise summary of the condition, typical next steps, and official NHS recommendations. Include a direct prompt for the user to confirm their appointment details. Tone: Empathetic, clinical, and authoritative. Constraint: Always include a disclaimer that this information is for educational purposes and is not a substitute for professional medical advice.\n\nDYNAMIC RESOURCE CURATOR PROTOCOL:\nMonitor inputs for signs of a specific medical diagnosis or condition (e.g., Epilepsy, Diabetes, Asthma).\nIf a condition is identified via medication names or clinical text, you MUST populate the 'supportCardSuggestion' field with the condition details to ask the user if they would like to add a 'Trusted Support Card' to their Help & Info section.\n\nCAREGIVER ALERT PROTOCOL:\nDetermine if the document contains critical information (e.g., new diagnosis, urgent appointment, medication change, or concerning test results). If so, set 'is_critical' to true and provide a brief, professional 'caregiver_sms' (max 140 chars) suitable for sending to a caregiver. Example: 'MemoryMate: A new prescription for [Med Name] was detected for [Name]. Please check the vault.'" }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A simple summary of the document." },
            category: { type: Type.STRING, description: "Type of document. MUST be one of: Medical, Appointment, Identification, Medicine, General, Household, Vehicle." },
            organization: { type: Type.STRING, description: "Name of the hospital, clinic, or organization (e.g. NHS, St Mary's Hospital)" },
            department: { type: Type.STRING, description: "Specific department (e.g. Cardiology, Radiology)" },
            contactName: { type: Type.STRING, description: "Name of the doctor or contact person." },
            contactPhone: { type: Type.STRING, description: "Phone number." },
            contactEmail: { type: Type.STRING, description: "Email address." },
            isAppointment: { type: Type.BOOLEAN, description: "True if the document is an appointment letter or card." },
            appointmentDate: { type: Type.STRING, description: "Date of the appointment in YYYY-MM-DD format." },
            appointmentTime: { type: Type.STRING, description: "Time of the appointment in HH:MM format." },
            location: { type: Type.STRING, description: "Full address or location of the appointment/service." },
            healthInsights: { type: Type.STRING, description: "If a health condition is identified, provide a professional, supportive summary grounded in NHS guidelines. Include a brief overview, commonly recommended NHS pathways/self-care tips, a prompt to confirm appointment details, and a mandatory disclaimer that it is for educational purposes." },
            supportCardSuggestion: {
              type: Type.OBJECT,
              description: "A suggestion to add a Trusted Support Card to the user's Help & Info section if a condition is detected.",
              properties: {
                detected_condition: { type: Type.STRING, description: "The medical condition (e.g., Epilepsy)." },
                suggest_card: { type: Type.BOOLEAN, description: "Must be true." },
                nhs_url: { type: Type.STRING, description: "The official NHS URL for the condition." },
                charity_url: { type: Type.STRING, description: "A leading UK-based organization for that condition." },
                message: { type: Type.STRING, description: "A message confirming the card is being added." },
                category: { type: Type.STRING, description: "Which 'Trusted Health Information' category it belongs to (e.g., 'Understanding Epilepsy')." }
              },
              required: ["detected_condition", "suggest_card", "nhs_url", "charity_url", "message", "category"]
            },
            is_critical: { type: Type.BOOLEAN, description: "Set to true if the document mentions a new medication, a change in dosage, a new diagnosis, or an urgent upcoming appointment." },
            caregiver_sms: { type: Type.STRING, description: "A concise, empathetic summary (max 140 characters)." }
          },
          required: ["summary", "category", "isAppointment"],
        }
      }
    });

    const analysis = JSON.parse(response.text || '{}');
    logActivity(userId, 'AI_ANALYSIS', `Finished document analysis. Critical: ${!!analysis.is_critical}`, 'SUCCESS', response.text);
    
    let smsResults = [];
    if (analysis.is_critical && analysis.caregiver_sms) {
      const caregivers = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM caregivers WHERE userId = ? AND alertsEnabled = 1", [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      for (const caregiver of caregivers) {
        const result = await sendCaregiverSMS(caregiver.phoneNumber, analysis.caregiver_sms, userId, caregiver.name);
        smsResults.push(result);
      }
    }
    
    res.json({ ...analysis, smsResults });

  } catch (error) {
    console.error("Document Analysis Error:", error);
    const errorStr = error instanceof Error ? error.message : String(error);
    logActivity(userId, 'AI_ANALYSIS', 'Failed document analysis', 'ERROR', errorStr);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

app.post('/api/caregiver-alert', requireAuth(), checkProfileOwnership, (req, res) => {
  const { userId, smsSummary } = req.body;

  if (!smsSummary) {
    return res.status(400).json({ error: "smsSummary is required" });
  }

  db.all("SELECT * FROM caregivers WHERE userId = ? AND alertsEnabled = 1", [userId], async (err, caregivers) => {
    if (err) {
      console.error("Error fetching caregivers:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!caregivers || caregivers.length === 0) {
      console.log(`No active caregivers found for user ${userId}. Skipping SMS alerts.`);
      return res.json({ success: true, message: "No active caregivers found" });
    }

    let successCount = 0;
    for (const caregiver of caregivers) {
      const success = await sendCaregiverSMS(caregiver.phoneNumber, smsSummary);
      if (success) successCount++;
    }

    res.json({ success: true, sentCount: successCount, totalCaregivers: caregivers.length });
  });
});

// Caregiver CRUD
app.get('/api/caregivers/:userId', requireAuth(), checkProfileOwnership, (req, res) => {
  console.log(`--- Incoming Request: [${req.method}] [${req.url}] ---`);
  db.all("SELECT * FROM caregivers WHERE userId = ?", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/caregivers', requireAuth(), checkProfileOwnership, (req, res) => {
  console.log(`--- Incoming Request: [${req.method}] [${req.url}] ---`);
  console.log(`[POST /api/caregivers] req.body:`, req.body);
  console.log(`[POST /api/caregivers] req.auth:`, req.auth);
  const { id, userId, name, phoneNumber, relationship, alertsEnabled } = req.body;
  const sql = `INSERT INTO caregivers (id, userId, name, phoneNumber, relationship, alertsEnabled) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, userId, name, phoneNumber, relationship, alertsEnabled === false ? 0 : 1], function(err) {
    if (err) {
      console.error(`[POST /api/caregivers] Database Insert Error:`, err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.put('/api/caregivers/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('caregivers', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    const { name, phoneNumber, relationship, alertsEnabled } = req.body;
    const sql = `UPDATE caregivers SET name=?, phoneNumber=?, relationship=?, alertsEnabled=? WHERE id=?`;
    db.run(sql, [name, phoneNumber, relationship, alertsEnabled === false ? 0 : 1, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

app.delete('/api/caregivers/:id', requireAuth(), (req, res) => {
  verifyItemOwnership('caregivers', req.params.id, req.auth.userId, (err, isOwner) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isOwner) return res.status(403).json({ error: "Forbidden" });

    db.run("DELETE FROM caregivers WHERE id=?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// Activity Logs Endpoint
app.get('/api/logs/:profileId', requireAuth(), checkProfileOwnership, (req, res) => {
  const { profileId } = req.params;
  db.all(
    "SELECT * FROM activity_logs WHERE profileId = ? ORDER BY timestamp DESC LIMIT 50",
    [profileId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Vite middleware for development (MUST be after API routes)
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*all', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Bind to 0.0.0.0 to allow network access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});