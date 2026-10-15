import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { allRecords, openDatabase } from './database';

export const STORAGE_PREFIX = 'atoa-leticia:';
export type StateRecord = { key: string; version: 1; value: unknown; updatedAt: number };
const cache = new Map<string, StateRecord>();
const failed = new Map<string, StateRecord>();
let ready = false;
let queue: Promise<void> = Promise.resolve();
function decode(raw: unknown): unknown { return raw && typeof raw === 'object' && 'version' in raw && 'value' in raw ? (raw as StateRecord).value : raw; }
export async function initializeStorage() {
  if (ready) return;
  const persisted = await allRecords<StateRecord>('state');
  persisted.forEach(record => cache.set(record.key, record));
  const legacy: StateRecord[] = [];
  try {
    for (const fullKey of Object.keys(localStorage)) {
      if (!fullKey.startsWith(STORAGE_PREFIX)) continue;
      const key = fullKey.slice(STORAGE_PREFIX.length); if (cache.has(key)) continue;
      try { const value = decode(JSON.parse(localStorage.getItem(fullKey)!)); const record: StateRecord = { key, version: 1, value, updatedAt: Date.now() }; cache.set(key, record); legacy.push(record); } catch { /* Preserve corrupt originals. */ }
    }
  } catch { /* IndexedDB still works when localStorage is unavailable. */ }
  if (legacy.length) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite'); legacy.forEach(record => tx.objectStore('state').put(record));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  ready = true;
}
export function readStored<T>(key: string, fallback: T): T { const record = cache.get(key); return record ? record.value as T : fallback; }
export function getStateRecords(): StateRecord[] { return [...cache.values()]; }
export function updateCache(records: StateRecord[]) { records.forEach(r => { cache.set(r.key, r); failed.delete(r.key); }); window.dispatchEvent(new Event('atoa-state-restored')); }
function writeRecord(record: StateRecord) {
  cache.set(record.key, record);
  queue = queue.catch(() => {}).then(async () => {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(record);
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
      failed.delete(record.key);
    } catch (error) {
      failed.set(record.key, cache.get(record.key) ?? record);
      window.dispatchEvent(new CustomEvent('atoa-storage-error', { detail: { key: record.key, error } }));
    }
  });
}
export async function flushStorage() { await queue; }
export async function retryStorage() { [...failed.values()].forEach(writeRecord); await queue; return failed.size === 0; }
export function hasUnsavedChanges() { return failed.size > 0; }
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const initialRef = useRef<T>(typeof initial === 'function' ? (initial as () => T)() : initial);
  const [state, setState] = useState<T>(() => readStored(key, initialRef.current));
  const stateRef = useRef(state);
  const update = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function' ? (action as (prev: T) => T)(stateRef.current) : action;
    stateRef.current = next; setState(next); writeRecord({ key, version: 1, value: next, updatedAt: Date.now() });
  }, [key]);
  useEffect(() => {
    if (!cache.has(key)) writeRecord({ key, version: 1, value: stateRef.current, updatedAt: Date.now() });
    const restored = () => { const value = readStored(key, initialRef.current); stateRef.current = value; setState(value); };
    window.addEventListener('atoa-state-restored', restored); return () => window.removeEventListener('atoa-state-restored', restored);
  }, [key]);
  return [state, update] as const;
}
export function useHistory<T>(initial: T, limit = 60) {
  const [past, setPast] = useState<T[]>([]); const [present, setPresent] = useState(initial);
  const update = useCallback((next: T) => { setPast(p => [...p.slice(-limit + 1), present]); setPresent(next); }, [present, limit]);
  const undo = useCallback(() => { if (!past.length) return; setPresent(past[past.length - 1]); setPast(p => p.slice(0, -1)); }, [past]);
  return { value: present, update, undo, canUndo: past.length > 0 };
}
