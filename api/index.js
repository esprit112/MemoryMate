import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import express from 'express';
import dns from 'node:dns';
import { GoogleGenAI, Type } from '@google/genai';
import cors from 'cors';
import chokidar from 'chokidar';
import { clerkMiddleware, getAuth } from '@clerk/express';
import pg from 'pg';
import sqlite3 from 'sqlite3';

dns.setDefaultResultOrder('ipv4first');

// Load .env file manually if it exists
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

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!CLERK_SECRET_KEY || !GEMINI_API_KEY) {
  console.warn("⚠️ Warning: Missing CLERK_SECRET_KEY or GEMINI_API_KEY.");
} else {
  console.log("🚀 System Check: Clerk Auth & Gemini API keys verified.");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isDev = process.env.NODE_ENV !== 'production';

// Task 4: Database Pathing
const PERSISTENT_ROOT = fs.existsSync('/data') ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH || path.join(PERSISTENT_ROOT, 'memorymate.db');
const USERS_BASE_DIR = process.env.USERS_BASE_DIR || (PERSISTENT_ROOT === '/data' ? '/data' : path.join(PERSISTENT_ROOT, 'users'));

// Task 1: Hybrid Database Adapter (REFACTORED WITH SCRUBBER)
const usePostgres = !!process.env.POSTGRES_URL;
let dbPool = null;
let sqliteDb = null;

if (usePostgres) {
  // 1. Scrub the connection string to remove hidden spaces/newlines
  const rawConnectionString = process.env.POSTGRES_URL || '';
  const cleanConnectionString = rawConnectionString.replace(/\s+/g, '').trim();

  // 2. Initialize the Postgres Pool
  dbPool = new pg.Pool({
    connectionString: cleanConnectionString,
    ssl: {
      rejectUnauthorized: false // Required for Supabase
    },
    connectionTimeoutMillis: 5000 
  });
  
  console.log(`[SYSTEM] Database Status: Supabase/Postgres Cloud Mode Active.`);
} else {
  sqliteDb = new sqlite3.Database(DB_PATH);
  console.log(`Database initialized: Local SQLite mode active.`);
}

/**
 * Universal Query Wrapper
 */
async function dbQuery(text, params = []) {
  if (usePostgres) {
    try {
      const result = await dbPool.query(text, params);
      return { rows: result.rows, rowsAffected: result.rowCount };
    } catch (err) {
      console.error(`[POSTGRES ERROR] Code: ${err.code} | Message: ${err.message}`);
      throw err;
    }
  } else {
    const sqliteText = text.replace(/\$\d+/g, '?');
    return new Promise((resolve, reject) => {
      const trimmedQuery = sqliteText.trim().toUpperCase();
      const isSelect = trimmedQuery.startsWith('SELECT') || trimmedQuery.startsWith('WITH') || trimmedQuery.startsWith('PRAGMA');
      
      if (isSelect) {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowsAffected: (rows || []).length });
        });
      } else {
        sqliteDb.run(sqliteText, params, function(err) {
          if (err) return reject(err);
          resolve({ rows: [], rowsAffected: this.changes });
        });
      }
    });
  }
}

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' })); 

const clerkHandler = clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY
});

app.use(async (req, res, next) => {
  try {
    await clerkHandler(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } catch (error) {
    next(error);
  }
});

const requireAuth = () => (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthenticated' });
  req.auth = auth;
  next();
};

// Database Setup
async function initializeDatabase() {
  try {
    if (!usePostgres) {
      await dbQuery('PRAGMA journal_mode = WAL;');
      await dbQuery('PRAGMA synchronous = NORMAL;');
    }
    await createTables();
    console.log('Database setup complete.');
  } catch (error) {
    console.error('Critical failure during database initialization:', error);
  }
}

initializeDatabase();

// --- Rest of your functions (createTables, API routes, etc) follow below ---
// (The rest of the file remains as you had it, starting from createTables)

async function createTables() {
  const blobType = usePostgres ? 'BYTEA' : 'BLOB';
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      clerkUserId TEXT UNIQUE,
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
    // ... logic for reminders, medicines, activity_logs, etc. (Keep your existing code here)
  } catch (err) {
    console.error("Failed to create tables:", err);
  }
}

// (Maintain all your existing app.get, app.post, and watcher logic here)

export default app;