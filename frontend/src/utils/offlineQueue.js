import { openDB } from 'idb';

const DB_NAME = 'gestionale-offline';
const STORE_NAME = 'sync_queue';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

const BACKOFF_BASE_MS = 10_000   // 10s base
const BACKOFF_MAX_MS  = 300_000  // 5 min cap

function nextRetryDelay(retries) {
  const exp = Math.min(BACKOFF_BASE_MS * 2 ** retries, BACKOFF_MAX_MS)
  const jitter = Math.random() * 2000  // fino a 2s di jitter
  return exp + jitter
}

export async function addToQueue({ url, method, body, label = 'Operazione offline' }) {
  const db = await getDB();
  return db.add(STORE_NAME, {
    url,
    method,
    body,
    timestamp: Date.now(),
    retries: 0,
    nextRetryAt: 0,  // 0 = pronto subito
    label,
  });
}

export async function getAllItems() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getCount() {
  const db = await getDB();
  return db.count(STORE_NAME);
}

export async function removeItem(id) {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
}

export async function incrementRetry(id) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.retries += 1;
    item.nextRetryAt = Date.now() + nextRetryDelay(item.retries)
    await tx.store.put(item);
  }
  await tx.done;
}

export async function clearQueue() {
  const db = await getDB();
  return db.clear(STORE_NAME);
}
