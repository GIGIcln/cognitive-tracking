import { openDB } from 'idb';

const DB_NAME = 'cognitive-tracking-offline';
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

export async function addToQueue({ url, method, body, label = 'Operazione offline' }) {
  const db = await getDB();
  return db.add(STORE_NAME, {
    url,
    method,
    body,
    timestamp: Date.now(),
    retries: 0,
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
    await tx.store.put(item);
  }
  await tx.done;
}
