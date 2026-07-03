export const DB_NAME = 'AlewoodMeetingDB';
export const STORE_NAME = 'audioChunks';
export const SESSION_STORE_NAME = 'sessions';

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

export async function saveAudioChunk(sessionId: string, chunk: Blob, index: number) {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ sessionId, index, chunk });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAudioChunks(sessionId: string): Promise<Blob[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const allChunks = request.result || [];
      const sessionChunks = allChunks
        .filter((c: any) => c.sessionId === sessionId)
        .sort((a: any, b: any) => a.index - b.index)
        .map((c: any) => c.chunk);
      resolve(sessionChunks);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearAudioChunks(sessionId: string) {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const all = request.result || [];
      all.forEach((item: any) => {
        if (item.sessionId === sessionId) {
          store.delete(item.id);
        }
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getStrandedSessions(): Promise<{sessionId: string, timestamp: number, chunksCount: number}[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const all = request.result || [];
      const sessionMap = new Map<string, {sessionId: string, timestamp: number, chunksCount: number}>();
      
      all.forEach((item: any) => {
        if (!sessionMap.has(item.sessionId)) {
          // Assuming sessionId is a stringified timestamp (e.g., from Date.now())
          const ts = parseInt(item.sessionId, 10);
          sessionMap.set(item.sessionId, { sessionId: item.sessionId, timestamp: isNaN(ts) ? 0 : ts, chunksCount: 0 });
        }
        sessionMap.get(item.sessionId)!.chunksCount++;
      });
      
      resolve(Array.from(sessionMap.values()).sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
}
