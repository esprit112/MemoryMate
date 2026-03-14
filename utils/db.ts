import { UserDocument } from '../types';

const DB_NAME = 'MemoryMateDB';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';

// Open IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        const store = db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveDocument = async (doc: UserDocument): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DOCS], 'readwrite');
    const store = transaction.objectStore(STORE_DOCS);
    const request = store.put(doc);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getDocumentsByUser = async (userId: string): Promise<UserDocument[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DOCS], 'readonly');
    const store = transaction.objectStore(STORE_DOCS);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteDocument = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DOCS], 'readwrite');
    const store = transaction.objectStore(STORE_DOCS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
