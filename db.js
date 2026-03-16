
import { createClient } from '@libsql/client';
import sqlite3Init from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const sqlite3 = sqlite3Init.verbose();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PERSISTENT_ROOT = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(PERSISTENT_ROOT, 'memorymate.db');

if (!fs.existsSync(PERSISTENT_ROOT)) {
  fs.mkdirSync(PERSISTENT_ROOT, { recursive: true });
}

let db;
let connectionType = 'Local';

if (process.env.TURSO_DATABASE_URL) {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  
  connectionType = 'Cloud (Turso)';
  
  db = {
    execute: async (sql, params = []) => {
      const result = await client.execute({ sql, args: params });
      return result;
    },
    run: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = client.execute({ sql, args: params });
      if (callback) {
        promise.then(res => callback.call({ lastID: res.lastInsertRowid, changes: res.rowsAffected }, null))
               .catch(err => callback(err));
      }
      return promise;
    },
    all: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = client.execute({ sql, args: params }).then(res => res.rows);
      if (callback) {
        promise.then(rows => callback(null, rows)).catch(err => callback(err));
      }
      return promise;
    },
    get: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = client.execute({ sql, args: params }).then(res => res.rows[0]);
      if (callback) {
        promise.then(row => callback(null, row)).catch(err => callback(err));
      }
      return promise;
    },
    close: () => client.close(),
    isCloud: true
  };
} else {
  const localDb = new sqlite3.Database(DB_PATH);
  
  // Apply PRAGMAs for local SQLite
  localDb.serialize(() => {
    localDb.run('PRAGMA journal_mode = WAL;');
    localDb.run('PRAGMA synchronous = NORMAL;');
    localDb.run('PRAGMA foreign_keys = ON;');
  });

  db = {
    execute: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        localDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
    },
    run: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = new Promise((resolve, reject) => {
        localDb.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
      if (callback) {
        localDb.run(sql, params, callback);
      }
      return promise;
    },
    all: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = new Promise((resolve, reject) => {
        localDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      if (callback) {
        localDb.all(sql, params, callback);
      }
      return promise;
    },
    get: function(sql, params = [], callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const promise = new Promise((resolve, reject) => {
        localDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (callback) {
        localDb.get(sql, params, callback);
      }
      return promise;
    },
    close: () => new Promise((resolve, reject) => {
      localDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
    reopen: () => {
      const newLocalDb = new sqlite3.Database(DB_PATH);
      newLocalDb.serialize(() => {
        newLocalDb.run('PRAGMA journal_mode = WAL;');
        newLocalDb.run('PRAGMA synchronous = NORMAL;');
        newLocalDb.run('PRAGMA foreign_keys = ON;');
      });
      
      // Update the methods to use the new localDb instance
      db.execute = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          newLocalDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        });
      };
      db.run = function(sql, params = [], callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        const promise = new Promise((resolve, reject) => {
          newLocalDb.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
          });
        });
        if (callback) {
          newLocalDb.run(sql, params, callback);
        }
        return promise;
      };
      db.all = function(sql, params = [], callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        const promise = new Promise((resolve, reject) => {
          newLocalDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        if (callback) {
          newLocalDb.all(sql, params, callback);
        }
        return promise;
      };
      db.get = function(sql, params = [], callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        const promise = new Promise((resolve, reject) => {
          newLocalDb.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        if (callback) {
          newLocalDb.get(sql, params, callback);
        }
        return promise;
      };
      db.close = () => new Promise((resolve, reject) => {
        newLocalDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      return Promise.resolve();
    },
    isCloud: false
  };
}

export const connectionInfo = {
  type: connectionType,
  path: DB_PATH
};

export async function initDatabase() {
  console.log(`Initializing ${connectionType} database...`);
  
  const tables = [
    // Users Table
    `CREATE TABLE IF NOT EXISTS users (
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
    )`,
    // Reminders Table
    `CREATE TABLE IF NOT EXISTS reminders (
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
    )`,
    // Caregivers Table
    `CREATE TABLE IF NOT EXISTS caregivers (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT,
      relationship TEXT,
      phoneNumber TEXT,
      alertsEnabled INTEGER,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`,
    // Activity Logs Table
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action_type TEXT,
      subject_profile TEXT,
      performed_by TEXT,
      description TEXT,
      timestamp TEXT,
      reference_id TEXT,
      deleted_data TEXT,
      profileId TEXT,
      eventType TEXT,
      message TEXT,
      status TEXT,
      technicalDetails TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`,
    // Documents Table
    `CREATE TABLE IF NOT EXISTS documents (
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
    )`,
    // Support Cards Table
    `CREATE TABLE IF NOT EXISTS support_cards (
      id TEXT PRIMARY KEY,
      userId TEXT,
      condition TEXT,
      nhsUrl TEXT,
      charityUrl TEXT,
      category TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`,
    // Medicines Table
    `CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT,
      strength TEXT,
      directions TEXT,
      image TEXT,
      createdAt TEXT,
      lastIssuedDate TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`
  ];

  for (const tableSql of tables) {
    await db.run(tableSql);
  }

  // Add indices and columns that might be missing (migrations)
  const migrations = [
    "CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_file ON documents(userId, name)",
    "ALTER TABLE activity_logs ADD COLUMN deleted_data TEXT",
    "ALTER TABLE medicines ADD COLUMN lastIssuedDate TEXT",
    "ALTER TABLE reminders ADD COLUMN recurrence TEXT",
    "ALTER TABLE reminders ADD COLUMN notificationCount INTEGER DEFAULT 0",
    "ALTER TABLE reminders ADD COLUMN lastNotificationSent TEXT",
    "ALTER TABLE reminders ADD COLUMN sent4Day INTEGER DEFAULT 0",
    "ALTER TABLE reminders ADD COLUMN sent1Day INTEGER DEFAULT 0",
    "ALTER TABLE reminders ADD COLUMN sentDayOf INTEGER DEFAULT 0"
  ];

    for (const migration of migrations) {
      try {
        await db.run(migration);
      } catch (_) {
        // Column likely already exists, safe to ignore
        console.debug(`Migration skipped: ${migration}`);
      }
    }

  console.log(`${connectionType} database initialized successfully.`);
}

export default db;
