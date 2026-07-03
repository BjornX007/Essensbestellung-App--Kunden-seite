// lib/storage/localCache.ts
type CacheEnvelope<T> = { value: T; savedAt: number; ttlMs?: number };

export function saveToStorage<T>(key: string, value: T, ttlMs?: number) {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelope<T> = { value, savedAt: Date.now(), ttlMs };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (e) {
    console.warn(`[localCache] Failed to save "${key}":`, e);
  }
}

export function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    if (envelope.ttlMs && Date.now() - envelope.savedAt > envelope.ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return envelope.value;
  } catch (e) {
    console.warn(`[localCache] Failed to load "${key}":`, e);
    return null;
  }
}

export function clearStorage(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}