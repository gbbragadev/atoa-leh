import { useCallback, useEffect, useState } from 'react';
import type { Creation } from './types';
import { openDatabase, allRecords } from './database';

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('creations', mode);
    const request = operation(tx.objectStore('creations'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Não foi possível guardar.'));
  });
}
export function useGallery() {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const items = await allRecords<Creation>('creations');
      setCreations(items.sort((a, b) => b.createdAt - a.createdAt));
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }, []);
  useEffect(() => { void refresh(); const restored = () => { void refresh(); }; window.addEventListener('atoa-state-restored', restored); return () => window.removeEventListener('atoa-state-restored', restored); }, []);
  async function save(creation: Omit<Creation, 'id' | 'createdAt'>) {
    const item: Creation = { ...creation, version: 1, id: crypto.randomUUID(), createdAt: Date.now() };
    await transaction('readwrite', store => store.put(item));
    setCreations(prev => [item, ...prev]); return item;
  }
  async function remove(id: string) {
    await transaction('readwrite', store => store.delete(id));
    setCreations(prev => prev.filter(item => item.id !== id));
  }
  async function restore(items: Creation[]) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('creations', 'readwrite');
      items.forEach(item => tx.objectStore('creations').put(item));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const restored = await transaction('readonly', store => store.getAll()) as Creation[];
    setCreations(restored.sort((a, b) => b.createdAt - a.createdAt));
  }
  return { creations, save, remove, restore, refresh, error };
}
