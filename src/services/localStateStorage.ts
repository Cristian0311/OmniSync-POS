/**
 * Persistencia local del estado de la aplicación.
 * IndexedDB evita que un POS offline dependa de localStorage para un objeto enorme.
 * Las escrituras se agrupan brevemente para evitar serializar el store en cada set().
 */
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'omnisync-pos-local-state';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'zustand';
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;
let writeChain: Promise<void> = Promise.resolve();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function read(): Promise<string | null> {
  const fallback = () => {
    try { return localStorage.getItem('pos-store-storage'); } catch { return null; }
  };

  const db = await openDb();
  if (!db) return fallback();

  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => {
      const value = typeof req.result === 'string' ? req.result : null;
      // Si IndexedDB aún no tiene un valor válido, conservar el respaldo
      // local evita arrancar el POS con un estado vacío tras una recuperación.
      resolve(value ?? fallback());
    };
    req.onerror = () => resolve(fallback());
    tx.oncomplete = () => db.close();
  });
}

async function writeNow(value: string): Promise<void> {
  const operation = writeChain.then(async () => {
    const db = await openDb();
    if (!db) {
      try { localStorage.setItem('pos-store-storage', value); } catch {}
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    db.close();
  });

  // Mantener la cadena reutilizable aunque una escritura concreta falle.
  writeChain = operation.catch(error => {
    console.error('[localStateStorage] Error escribiendo estado local:', error);
  });
  await operation;
}

export async function flushLocalStateStorage(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    const next = pendingValue;
    pendingValue = null;
    if (next != null) await writeNow(next);
    return;
  }
  try { await writeChain; } catch {}
}

export const localStateStorage: StateStorage = {
  getItem: async () => {
    const value = await read();
    // Migración transparente desde la persistencia antigua de Zustand.
    if (value && typeof indexedDB !== 'undefined' && localStorage.getItem('pos-store-storage')) {
      void writeNow(value).then(() => {
        try { localStorage.removeItem('pos-store-storage'); } catch {}
      });
    }
    return value;
  },
  setItem: async (_name, value) => {
    pendingValue = value;
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      const next = pendingValue;
      pendingValue = null;
      if (next != null) void writeNow(next);
    }, 250);
  },
  removeItem: async () => {
    const db = await openDb();
    if (!db) {
      try { localStorage.removeItem('pos-store-storage'); } catch {}
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  }
};

export async function clearLocalStateStorage(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    pendingValue = null;
  }

  // Esperar a cualquier escritura que ya esté en vuelo. Sin esto, un put()
  // pendiente podía terminar después del delete() y reconstituir una caché vieja.
  try { await writeChain; } catch {}

  const db = await openDb();
  if (db) {
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    db.close();
  }

  // El respaldo legacy debe limpiarse siempre, incluso cuando IndexedDB no esté
  // disponible, para que una recuperación posterior no restaure datos antiguos.
  try { localStorage.removeItem('pos-store-storage'); } catch {}
}
